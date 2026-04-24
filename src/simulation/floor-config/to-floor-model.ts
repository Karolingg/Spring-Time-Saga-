/**
 * Adapter: FloorConfig (hand-authored per-floor config) → FloorModel (nav graph).
 *
 * Produces the NavNode/NavEdge/HazardZone structures that the autonomous engine
 * consumes, so every floor authored in `floor-config/buildings/` can be
 * simulated without hand-maintaining a parallel model.
 *
 * Strategy for keeping agents inside legal corridors:
 *  1. Use explicit `corridorNodes` + `neighbors` when the floor provides them.
 *  2. Otherwise synthesize corridor nodes from consecutive `primaryPaths` /
 *     `reroutes` waypoints — those polylines already trace the legal paths.
 *  3. Rooms attach to their declared `corridorEntryNode` when present; if not,
 *     they fall back to the nearest corridor/junction node.
 */

import type { FloorModel, HazardZone, NavEdge, NavNode } from '../building-model'
import type { BuildingModel } from '../building-model'
import { BUILDING_FLOORS } from './buildings'
import type { CorridorNode, FloorConfig, Point } from './types'

interface AdapterOptions {
  buildingId: string
  floorIdx: number
  floorplanSrc: string
}

const POSITION_TOLERANCE = 2
const PX_PER_METER = 10
const ROOM_CAPACITY_DEFAULT = 40
const CORRIDOR_CAPACITY = 15
const EXIT_CAPACITY = 8
const JUNCTION_CAPACITY = 18

function slugify(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'n'
}

function pxDistance(a: Point, b: Point): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.sqrt(dx * dx + dy * dy) / PX_PER_METER
}

function samePoint(a: Point, b: Point): boolean {
  return Math.abs(a.x - b.x) <= POSITION_TOLERANCE && Math.abs(a.y - b.y) <= POSITION_TOLERANCE
}

function hazardGrowth(type: 'fire' | 'smoke' | 'debris'): number {
  switch (type) {
    case 'fire':
      return 5
    case 'smoke':
      return 8
    case 'debris':
      return 2
  }
}

/** Per-hazard-type growth cap expressed as a multiple of the authored
 *  initial radius. Smoke is allowed to billow further than fire so the
 *  look-and-feel matches real life, but nothing is allowed to consume the
 *  floorplan. The absolute floor of 80px prevents tiny authored hazards
 *  from being clamped below their own starting radius. */
function hazardMaxRadius(type: 'fire' | 'smoke' | 'debris', initial: number): number {
  const multiplier = type === 'smoke' ? 3 : type === 'fire' ? 2.5 : 2
  return Math.max(80, initial * multiplier)
}

export function floorConfigToFloorModel(
  config: FloorConfig,
  { buildingId, floorIdx, floorplanSrc }: AdapterOptions,
): FloorModel {
  const prefix = `${buildingId}-f${floorIdx}`
  const nodes: NavNode[] = []
  const edgeSeen = new Set<string>()
  const edges: NavEdge[] = []

  const addEdge = (fromId: string, toId: string, width = 2.0, blockable = true) => {
    if (fromId === toId) return
    const key = fromId < toId ? `${fromId}|${toId}` : `${toId}|${fromId}`
    if (edgeSeen.has(key)) return
    const from = nodes.find(n => n.id === fromId)
    const to = nodes.find(n => n.id === toId)
    if (!from || !to) return
    edgeSeen.add(key)
    edges.push({
      from: fromId,
      to: toId,
      distance: Math.max(1, pxDistance(from, to)),
      width,
      blockable,
    })
  }

  // 1. Exits
  const exitIdByKey = new Map<string, string>()
  for (const [key, exit] of Object.entries(config.exits)) {
    const id = `${prefix}-exit-${slugify(key)}`
    nodes.push({
      id,
      label: exit.label,
      x: exit.x,
      y: exit.y,
      type: 'exit',
      capacity: EXIT_CAPACITY,
    })
    exitIdByKey.set(key, id)
  }

  // 2. Corridor nodes — explicit if available
  const corridorIdByLabel = new Map<string, string>()
  const corridorNodes: CorridorNode[] = config.corridorNodes ?? []
  for (const cn of corridorNodes) {
    // If an exit sits at this exact position, reuse it instead of duplicating.
    const existingExit = nodes.find(n => n.type === 'exit' && samePoint(n, cn))
    if (existingExit) {
      corridorIdByLabel.set(cn.label, existingExit.id)
      continue
    }
    const id = `${prefix}-corr-${slugify(cn.label)}`
    nodes.push({
      id,
      label: cn.label,
      x: cn.x,
      y: cn.y,
      type: 'corridor',
      capacity: CORRIDOR_CAPACITY,
    })
    corridorIdByLabel.set(cn.label, id)
  }
  // Edges from explicit neighbors
  for (const cn of corridorNodes) {
    const fromId = corridorIdByLabel.get(cn.label)
    if (!fromId) continue
    for (const neighborLabel of cn.neighbors ?? []) {
      const toId =
        corridorIdByLabel.get(neighborLabel) ??
        nodes.find(n => n.label === neighborLabel)?.id
      if (!toId) continue
      addEdge(fromId, toId)
    }
  }

  // 3. Synthesize waypoints from primary paths + reroutes
  const waypointIdByPos = new Map<string, string>()
  const posKey = (p: Point) => `${Math.round(p.x)}|${Math.round(p.y)}`

  const resolvePoint = (p: Point): string => {
    // Reuse any node already at this position (exit or declared corridor).
    const existing = nodes.find(n => samePoint(n, p))
    if (existing) {
      waypointIdByPos.set(posKey(p), existing.id)
      return existing.id
    }
    const cached = waypointIdByPos.get(posKey(p))
    if (cached) return cached
    const id = `${prefix}-wp-${waypointIdByPos.size + 1}`
    nodes.push({
      id,
      label: `Waypoint ${waypointIdByPos.size + 1}`,
      x: p.x,
      y: p.y,
      type: 'corridor',
      capacity: CORRIDOR_CAPACITY,
    })
    waypointIdByPos.set(posKey(p), id)
    return id
  }

  const walkPolyline = (polyline: Point[], terminalExitKey?: string) => {
    if (!polyline || polyline.length === 0) return
    const ids = polyline.map(resolvePoint)
    for (let i = 0; i < ids.length - 1; i++) {
      addEdge(ids[i], ids[i + 1])
    }
    if (terminalExitKey) {
      const exitId = exitIdByKey.get(terminalExitKey)
      if (exitId && ids.length > 0) {
        addEdge(ids[ids.length - 1], exitId)
      }
    }
  }

  for (const [exitKey, path] of Object.entries(config.primaryPaths)) {
    walkPolyline(path, exitKey)
  }
  for (const [, reroute] of Object.entries(config.reroutes)) {
    walkPolyline(reroute.path, reroute.to)
  }

  // Ensure startPos is a reachable node (hub) even if no path uses it.
  if (config.startPos && (config.startPos.x !== 0 || config.startPos.y !== 0)) {
    resolvePoint(config.startPos)
  }

  // 4. Rooms
  for (const [roomKey, room] of Object.entries(config.rooms)) {
    if (roomKey === 'corridor') continue
    const id = `${prefix}-room-${slugify(roomKey)}`
    nodes.push({
      id,
      label: room.label,
      x: room.x,
      y: room.y,
      type: 'room',
      capacity: ROOM_CAPACITY_DEFAULT,
    })

    // Prefer explicit corridorEntryNode (by label).
    let entryId: string | undefined
    if (room.corridorEntryNode) {
      entryId =
        corridorIdByLabel.get(room.corridorEntryNode) ??
        nodes.find(n => n.label === room.corridorEntryNode)?.id
    }
    if (!entryId) {
      // Fallback: nearest corridor/junction/exit node.
      const candidates = nodes.filter(
        n => n.id !== id && (n.type === 'corridor' || n.type === 'junction' || n.type === 'exit'),
      )
      let best: { id: string; d: number } | null = null
      for (const c of candidates) {
        const dx = c.x - room.x
        const dy = c.y - room.y
        const d = dx * dx + dy * dy
        if (!best || d < best.d) best = { id: c.id, d }
      }
      entryId = best?.id
    }
    if (entryId) {
      addEdge(id, entryId, 1.5, true)
    }
  }

  // 5. Hazards
  const hazards: Record<string, HazardZone[]> = { fire: [], earthquake: [] }
  for (const disasterType of ['fire', 'earthquake'] as const) {
    const list = config.obstacles[disasterType] ?? []
    for (const obs of list) {
      const cx = obs.x + obs.w / 2
      const cy = obs.y + obs.h / 2
      const radius = Math.max(obs.w, obs.h) / 2
      hazards[disasterType].push({
        id: `${prefix}-${obs.id}`,
        type: obs.type,
        x: cx,
        y: cy,
        radius,
        growthRate: hazardGrowth(obs.type),
        appearsAt: 0,
        maxRadius: hazardMaxRadius(obs.type, radius),
      })
    }
  }

  return {
    id: `${prefix}`,
    label: config.floorLabel,
    floorplanSrc,
    nodes,
    edges,
    hazards,
  }
}

/** Floorplan resolution per building — maps floor labels to served SVG assets. */
const FLOORPLAN_SRC_BY_BUILDING: Record<string, Record<string, string>> = {
  'admin-building': {
    '1st Floor': '/floorplans/admin-building-f1.svg',
  },
  'science-building': {
    '1st Floor': '/floorplans/CSB 1st floor.svg',
    '2nd Floor': '/floorplans/CSB%202nd%20floor.svg',
    '3rd Floor': '/floorplans/CSB%203rd%20floor.svg',
    '4th Floor': '/floorplans/CSB%204th%20floor.svg',
    '5th Floor': '/floorplans/CSB%205th%20floor.svg',
    '6th Floor': '/floorplans/CSB%206th%20floor.svg',
  },
  'up-cebu-library': {
    '1st Floor': '/floorplans/Library%201st%20floor.svg',
  },
}

function resolveFloorplanSrc(buildingId: string, floorLabel: string): string {
  return FLOORPLAN_SRC_BY_BUILDING[buildingId]?.[floorLabel] ?? ''
}

const BUILDING_NAMES: Record<string, string> = {
  'admin-building': 'Administration Building',
  'as-west-wing': 'Arts & Sciences West Wing',
  'as-east-wing': 'Arts & Sciences East Wing',
  'som-admin': 'School of Management Admin',
  'som-building-1': 'School of Management Building 1',
  'cultural-center': 'Cultural Center',
  'social-sciences': 'Social Sciences Building',
  'science-building': 'College of Science Building',
  'liadlaw-hall': 'Liadlaw Hall',
  'up-cebu-library': 'UP Cebu Library',
  'up-high-school': 'UP High School',
}

/**
 * Build a BuildingModel for the given buildingId using the adapter.
 * Returns null if the building has no registered FloorConfigs.
 */
export function buildBuildingModel(buildingId: string): BuildingModel | null {
  const floorConfigs = BUILDING_FLOORS[buildingId]
  if (!floorConfigs || floorConfigs.length === 0) return null

  const floors: FloorModel[] = floorConfigs.map((cfg, idx) =>
    floorConfigToFloorModel(cfg, {
      buildingId,
      floorIdx: idx,
      floorplanSrc: resolveFloorplanSrc(buildingId, cfg.floorLabel),
    }),
  )

  return {
    id: buildingId,
    name: BUILDING_NAMES[buildingId] ?? buildingId,
    floors,
  }
}
