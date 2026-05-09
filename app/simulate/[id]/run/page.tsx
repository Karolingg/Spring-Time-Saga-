'use client'

import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { useAuth } from '@/src/hooks/useAuth'
import { BUILDING_FLOOR_COUNT } from '@/src/config/building-floor-counts'
import { makePlaceholderFloor } from '@/src/simulation/floor-config/placeholder'
import { BUILDING_FLOORS } from '@/src/simulation/floor-config/buildings'
import { getHazardStorageKey, loadHazardPlan, type PlacedHazard } from '@/src/simulation/hazard-placement'

// ─── Types ────────────────────────────────────────────────────────────────────
type SimPhase = 'planning' | 'running' | 'rerouting' | 'completed'
type DisasterType = 'fire' | 'earthquake'

interface Point { x: number; y: number }

const FORBIDDEN_ANCHOR: Point = { x: 490, y: 350 }
const isForbiddenAnchor = (p: Point) => p.x === FORBIDDEN_ANCHOR.x && p.y === FORBIDDEN_ANCHOR.y

interface ExitDef {
  x: number; y: number; label: string; desc: string;
}

interface ObstacleDef {
  id: string
  x: number; y: number; w: number; h: number
  type: 'fire' | 'smoke' | 'debris'
  label: string
  blocksExits: string[]
}

function buildObstaclesFromPlaced(placed: PlacedHazard[], disaster: DisasterType): ObstacleDef[] {
  return placed.map((hazard) => {
    const label = hazard.type === 'smoke'
      ? (disaster === 'earthquake' ? 'Dust' : 'Smoke')
      : hazard.type === 'debris' ? 'Debris' : 'Fire'
    return {
      id: hazard.id,
      x: hazard.x - hazard.radius,
      y: hazard.y - hazard.radius,
      w: hazard.radius * 2,
      h: hazard.radius * 2,
      type: hazard.type,
      label,
      blocksExits: [],
    }
  })
}

function isHardHazard(hazard: ObstacleDef): boolean {
  return hazard.type === 'fire' || hazard.type === 'debris'
}

function segmentCircleIntersectionT(a: Point, b: Point, center: Point, radius: number): number | null {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const fx = a.x - center.x
  const fy = a.y - center.y

  const aa = dx * dx + dy * dy
  if (aa === 0) return null
  const bb = 2 * (fx * dx + fy * dy)
  const cc = fx * fx + fy * fy - radius * radius
  const disc = bb * bb - 4 * aa * cc
  if (disc < 0) return null
  const sqrt = Math.sqrt(disc)
  const t1 = (-bb - sqrt) / (2 * aa)
  const t2 = (-bb + sqrt) / (2 * aa)
  const candidates = [t1, t2].filter((t) => t >= 0 && t <= 1)
  if (candidates.length === 0) return null
  return Math.min(...candidates)
}

function pathIntersectsHazards(path: Point[], hazards: ObstacleDef[]): boolean {
  if (!path || path.length < 2) return false
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]
    const b = path[i + 1]
    for (const hazard of hazards) {
      const center = { x: hazard.x + hazard.w / 2, y: hazard.y + hazard.h / 2 }
      const radius = Math.max(hazard.w, hazard.h) / 2
      if (segmentCircleIntersectionT(a, b, center, radius) !== null) return true
    }
  }
  return false
}

function computePathBlockT(path: Point[], hardHazards: ObstacleDef[]): number | null {
  if (!path || path.length < 2) return null
  const total = pathLength(path)
  if (total <= 0) return null
  let best: number | null = null
  let walked = 0
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]
    const b = path[i + 1]
    const segLen = Math.hypot(b.x - a.x, b.y - a.y)
    if (segLen <= 0) continue
    for (const hazard of hardHazards) {
      const center = { x: hazard.x + hazard.w / 2, y: hazard.y + hazard.h / 2 }
      const radius = Math.max(hazard.w, hazard.h) / 2
      const hitT = segmentCircleIntersectionT(a, b, center, radius)
      if (hitT === null) continue
      const lengthAtHit = walked + segLen * hitT
      const t = lengthAtHit / total
      if (best === null || t < best) best = t
    }
    walked += segLen
  }
  return best
}

function computeSmokeLength(path: Point[], smokeHazards: ObstacleDef[]): number {
  if (!path || path.length < 2) return 0
  let length = 0
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]
    const b = path[i + 1]
    const segLen = Math.hypot(b.x - a.x, b.y - a.y)
    if (segLen <= 0) continue
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
    const inSmoke = smokeHazards.some((hazard) => {
      const center = { x: hazard.x + hazard.w / 2, y: hazard.y + hazard.h / 2 }
      const radius = Math.max(hazard.w, hazard.h) / 2
      return Math.hypot(mid.x - center.x, mid.y - center.y) <= radius
    })
    if (inSmoke) length += segLen
  }
  return length
}

function computeTravelTimeMs(path: Point[], speed: number, smokeHazards: ObstacleDef[], maxProgress = 1): number {
  if (!path || path.length < 2 || speed <= 0) return 0
  const total = pathLength(path)
  if (total <= 0) return 0
  const target = total * Math.min(Math.max(maxProgress, 0), 1)
  let remaining = target
  let seconds = 0

  for (let i = 0; i < path.length - 1; i++) {
    if (remaining <= 0) break
    const a = path[i]
    const b = path[i + 1]
    const segLen = Math.hypot(b.x - a.x, b.y - a.y)
    if (segLen <= 0) continue
    const len = Math.min(segLen, remaining)
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
    const inSmoke = smokeHazards.some((hazard) => {
      const center = { x: hazard.x + hazard.w / 2, y: hazard.y + hazard.h / 2 }
      const radius = Math.max(hazard.w, hazard.h) / 2
      return Math.hypot(mid.x - center.x, mid.y - center.y) <= radius
    })
    const effectiveSpeed = inSmoke ? speed * 0.5 : speed
    seconds += len / effectiveSpeed
    remaining -= len
  }

  return seconds * 1000
}

interface RoomDef {
  label: string
  x: number
  y: number
  // Optional explicit room->corridor entry node(s) to avoid invalid shortcuts.
  corridorEntryNode?: string
  corridorEntryNodes?: string[]
}

/** A neighbor reference can be a bare label or an enriched object with edge
 *  metadata. Manual drill only needs the label, so `neighborLabel()` below
 *  normalizes both forms. */
type CorridorNeighbor = string | { label: string; width?: number; blockable?: boolean }

interface CorridorNode {
  label: string
  x: number
  y: number
  neighbors?: CorridorNeighbor[]
}

function neighborLabel(neighbor: CorridorNeighbor): string {
  return typeof neighbor === 'string' ? neighbor : neighbor.label
}

interface FloorConfig {
  viewWidth: number
  viewHeight: number
  exits: Record<string, ExitDef>
  startPos: Point
  primaryPaths: Record<string, Point[]>
  reroutes: Record<string, { to: string; path: Point[] }>
  blockT: Record<string, number>
  obstacles: Record<DisasterType, ObstacleDef[]>
  efficiency: Record<string, number>
  floorLabel: string
  rooms: Record<string, RoomDef>
  corridorNodes?: CorridorNode[]
}

function getRoomEntryLabels(room?: RoomDef | null): string[] {
  if (!room) return []
  if (room.corridorEntryNodes && room.corridorEntryNodes.length > 0) {
    return room.corridorEntryNodes
  }
  return room.corridorEntryNode ? [room.corridorEntryNode] : []
}

function resolveRoomEntryNode(room: RoomDef | null | undefined, nodes: CorridorNode[]): CorridorNode | null {
  if (!room || nodes.length === 0) return null

  const nodeByLabel = new Map(nodes.map((node) => [node.label, node]))
  const entryLabels = getRoomEntryLabels(room)

  if (entryLabels.length > 0) {
    let best: { node: CorridorNode; dist: number } | null = null
    for (const label of entryLabels) {
      const node = nodeByLabel.get(label)
      if (!node) continue
      const dist = Math.hypot(node.x - room.x, node.y - room.y)
      if (!best || dist < best.dist) {
        best = { node, dist }
      }
    }
    if (best) return best.node
  }

  // Fallback: nearest corridor node.
  let nearest = nodes[0]
  let bestDist = Infinity
  for (const node of nodes) {
    const dist = Math.hypot(node.x - room.x, node.y - room.y)
    if (dist < bestDist) {
      bestDist = dist
      nearest = node
    }
  }
  return nearest ?? null
}

type RouteMode = 'fastest' | 'safest' | null

interface SimEvent {
  time: number
  message: string
  type: 'info' | 'warn' | 'danger'
}

interface SimMetrics {
  evacuationTime: number
  rerouted: boolean
  reroutedFrom?: string
  reroutedTo?: string
  hazardExposure: boolean
  pathEfficiency: number
  exitChoice: string
  actualExit: string
  congestionLevel: 'Low' | 'Medium' | 'High'
}

// Building floor configurations are provided by per-building modules.

function validateFloorConfig(config: FloorConfig, buildingId: string, floorIndex: number) {
  const issues: string[] = []
  const exitKeys = new Set(Object.keys(config.exits))

  const mapsToValidate: Array<{ name: string; keys: string[] }> = [
    { name: 'primaryPaths', keys: Object.keys(config.primaryPaths) },
    { name: 'reroutes', keys: Object.keys(config.reroutes) },
    { name: 'blockT', keys: Object.keys(config.blockT) },
    { name: 'efficiency', keys: Object.keys(config.efficiency) },
  ]

  for (const { name, keys } of mapsToValidate) {
    for (const exitKey of exitKeys) {
      if (!keys.includes(exitKey)) {
        issues.push(`${name} is missing key "${exitKey}"`)
      }
    }
    for (const key of keys) {
      if (!exitKeys.has(key)) {
        issues.push(`${name} has unknown exit key "${key}"`)
      }
    }
  }

  for (const [from, reroute] of Object.entries(config.reroutes)) {
    if (!exitKeys.has(reroute.to)) {
      issues.push(`reroutes.${from}.to points to unknown exit "${reroute.to}"`)
    }
    if (from !== reroute.to && reroute.path.length === 0) {
      issues.push(`reroutes.${from}.path is empty`)
    }
  }

  if (config.corridorNodes && config.corridorNodes.length > 0) {
    const labelSet = new Set<string>()
    for (const node of config.corridorNodes) {
      if (labelSet.has(node.label)) {
        issues.push(`corridorNodes has duplicate label "${node.label}"`)
      }
      labelSet.add(node.label)
    }

    for (const node of config.corridorNodes) {
      for (const neighbor of node.neighbors || []) {
        const label = neighborLabel(neighbor)
        if (!labelSet.has(label)) {
          issues.push(`corridorNodes.${node.label} references missing neighbor "${label}"`)
        }
      }
    }

    for (const [roomKey, room] of Object.entries(config.rooms)) {
      const entryLabels = getRoomEntryLabels(room)
      const entryField = room.corridorEntryNodes?.length ? 'corridorEntryNodes' : 'corridorEntryNode'
      for (const entryLabel of entryLabels) {
        if (!labelSet.has(entryLabel)) {
          issues.push(`rooms.${roomKey}.${entryField} references missing node "${entryLabel}"`)
        }
      }
    }
  }

  if (issues.length > 0) {
    const floorName = config.floorLabel || `floor-${floorIndex + 1}`
    console.warn(`[sim-config] ${buildingId}/${floorName}`, issues)
  }
}

function validateFloorConfigs(buildingId: string, floors: FloorConfig[]): FloorConfig[] {
  floors.forEach((floor, index) => validateFloorConfig(floor, buildingId, index))
  return floors
}

function getFloorConfigs(buildingId: string): FloorConfig[] {
  const customFloors = BUILDING_FLOORS[buildingId]
  const declaredCount = BUILDING_FLOOR_COUNT[buildingId]

  if (customFloors?.length) {
    return validateFloorConfigs(buildingId, customFloors)
  }

  if (declaredCount) {
    return validateFloorConfigs(buildingId, Array.from({ length: declaredCount }, (_, i) => makePlaceholderFloor(i)))
  }

  // Fallback: 2-floor placeholder
  return validateFloorConfigs(buildingId, [makePlaceholderFloor(0), makePlaceholderFloor(1)])
}

// ─── Path Math ───────────────────────────────────────────────────────────────
function pathLength(path?: Point[] | null): number {
  if (!path || path.length === 0) return 0
  let len = 0
  for (let i = 1; i < path.length; i++) {
    const dx = path[i].x - path[i - 1].x
    const dy = path[i].y - path[i - 1].y
    len += Math.sqrt(dx * dx + dy * dy)
  }
  return len
}

function interpolatePath(path?: Point[] | null, t?: number): Point {
  // Defensive: if path missing or empty, return origin
  if (!path || path.length === 0) return { x: 0, y: 0 }
  const tt = typeof t === 'number' ? t : 0
  if (tt <= 0) return path[0]
  if (tt >= 1) return path[path.length - 1]
  const segs: number[] = []
  let total = 0
  for (let i = 1; i < path.length; i++) {
    const d = Math.sqrt((path[i].x - path[i-1].x)**2 + (path[i].y - path[i-1].y)**2)
    segs.push(d); total += d
  }
  if (total === 0) return path[0]
  const target = tt * total
  let acc = 0
  for (let i = 0; i < segs.length; i++) {
    if (acc + segs[i] >= target) {
      const st = (target - acc) / segs[i]
      return {
        x: path[i].x + st * (path[i+1].x - path[i].x),
        y: path[i].y + st * (path[i+1].y - path[i].y),
      }
    }
    acc += segs[i]
  }
  return path[path.length - 1]
}

// ─── Route Analysis ─────────────────────────────────────────────────────────
interface RouteAnalysis {
  exitKey: string
  totalLength: number
  isBlocked: boolean
  mayBlock: boolean
  efficiency: number
  hazardExposure: boolean
  estimatedTime: number
}

function analyzeRoutes(
  config: FloorConfig,
  selectedRoom: string | null,
  potentialBlockedExits: Set<string>,
  blockedExits: Set<string>,
  hazardExposureByExit: Map<string, boolean>,
): RouteAnalysis[] {
  const room = selectedRoom ? config.rooms[selectedRoom] : null
  const SPEED = 80

  return Object.keys(config.exits).map(key => {
    const exitPath = config.primaryPaths[key]
    const start = exitPath?.[0]
    let roomPrefixLen = 0
    if (room && start) {
      const entry = resolveRoomEntryNode(room, config.corridorNodes ?? [])
      if (entry) {
        roomPrefixLen = Math.hypot(room.x - entry.x, room.y - entry.y) + Math.hypot(entry.x - start.x, entry.y - start.y)
      } else {
        roomPrefixLen = Math.hypot(room.x - start.x, room.y - start.y)
      }
    }
    const totalLen = roomPrefixLen + pathLength(exitPath)
    const mayBlock = potentialBlockedExits.has(key)
    const isBlocked = blockedExits.has(key)
    const efficiency = config.efficiency[key] || 0.5
    const hazardExposure = hazardExposureByExit.get(key) ?? false
    return {
      exitKey: key,
      totalLength: totalLen,
      isBlocked,
      mayBlock,
      efficiency,
      hazardExposure,
      estimatedTime: parseFloat((totalLen / SPEED).toFixed(1)),
    }
  })
}

function getRecommendedExit(routes: RouteAnalysis[], mode: 'fastest' | 'safest'): string {
  if (mode === 'fastest') {
    const candidates = routes.filter(r => !r.isBlocked)
    const source = candidates.length > 0 ? candidates : routes
    const sorted = [...source].sort((a, b) => {
      if (a.estimatedTime !== b.estimatedTime) return a.estimatedTime - b.estimatedTime
      if (a.totalLength !== b.totalLength) return a.totalLength - b.totalLength
      if (a.mayBlock !== b.mayBlock) return a.mayBlock ? 1 : -1
      if (a.hazardExposure !== b.hazardExposure) return a.hazardExposure ? 1 : -1
      return b.efficiency - a.efficiency
    })
    return sorted[0].exitKey
  }

  // Safest: risk-first scoring, then efficiency/time tie-breakers.
  const ranked = [...routes].sort((a, b) => {
    const riskScore = (r: RouteAnalysis) => {
      let score = 0
      if (r.isBlocked) score += 1000
      if (r.hazardExposure) score += 200
      if (r.mayBlock) score += 40
      score += r.estimatedTime * 0.6
      score += (1 - r.efficiency) * 25
      return score
    }

    const diff = riskScore(a) - riskScore(b)
    if (Math.abs(diff) > 0.0001) return diff
    if (a.estimatedTime !== b.estimatedTime) return a.estimatedTime - b.estimatedTime
    if (a.totalLength !== b.totalLength) return a.totalLength - b.totalLength
    return b.efficiency - a.efficiency
  })

  return ranked[0].exitKey
}

function buildFullPath(
  config: FloorConfig,
  selectedRoom: string | null,
  exitKey: string,
  viaLabels?: string[] | null,
  options?: { previewFromCorridorEntry?: boolean },
): Point[] {
  const room = selectedRoom ? config.rooms[selectedRoom] : undefined
  const nodes = config.corridorNodes?.filter(n => !isForbiddenAnchor(n)) ?? []
  const entryNode = resolveRoomEntryNode(room ?? null, nodes)
  const roomOrigin = room ? { x: room.x, y: room.y } : null
  const entryPoint = entryNode ? { x: entryNode.x, y: entryNode.y } : null
  const includeEntryConnector = options?.previewFromCorridorEntry && entryPoint
  const roomPrefix = roomOrigin
    ? includeEntryConnector && entryPoint
      ? [roomOrigin, entryPoint]
      : [roomOrigin]
    : []
  const exitPath = config.primaryPaths[exitKey] || []
  const explicitExit = config.exits[exitKey]
  const finalExitPoint = explicitExit ? { x: explicitExit.x, y: explicitExit.y } : (exitPath[exitPath.length - 1] || null)
  // Strip forbidden anchor points so the agent never routes through them.
  const exitPathFiltered = exitPath.filter(p => !isForbiddenAnchor(p))
  if (exitPath.length === 0) return [...roomPrefix]

  // Helper to dedupe consecutive identical points
  const pushIfDifferent = (arr: Point[], p: Point) => { const last = arr[arr.length - 1]; if (!last || last.x !== p.x || last.y !== p.y) arr.push(p) }

  const nodeIndex = new Map(nodes.map((n, i) => [n.label, i]))
  const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)
  const roomPoint = roomPrefix[roomPrefix.length - 1]
  const exitPoint = finalExitPoint || exitPathFiltered[0] || exitPath[0]

  const findNearestIndex = (pt: Point) => {
    let best = 0; let bestD = Infinity
    for (let i = 0; i < nodes.length; i++) {
      const d = dist(pt, nodes[i])
      if (d < bestD) { bestD = d; best = i }
    }
    return best
  }

  const getRoomStartIndex = () => {
    if (!selectedRoom) return roomPoint ? findNearestIndex(roomPoint) : -1
    const preferredLabel = entryNode?.label
    if (preferredLabel) {
      const preferredIdx = nodeIndex.get(preferredLabel)
      if (preferredIdx !== undefined) return preferredIdx
    }
    return roomPoint ? findNearestIndex(roomPoint) : -1
  }

  const getNeighborIndexes = (u: number): number[] => {
    const currentNode = nodes[u]
    if (!currentNode) return []

    const direct = (currentNode.neighbors || [])
      .map(n => nodeIndex.get(neighborLabel(n)))
      .filter((idx): idx is number => idx !== undefined)

    const reverse = nodes
      .map((n, i) => ({ n, i }))
      .filter(({ i }) => i !== u)
      .filter(({ n }) => (n.neighbors || []).some(nb => neighborLabel(nb) === currentNode.label))
      .map(({ i }) => i)

    const explicit = Array.from(new Set([...direct, ...reverse]))
    if (explicit.length > 0) {
      return explicit.filter(v => !!nodes[v])
    }

    // Fallback for configs without explicit graph links.
    const raw = Array.from({ length: nodes.length }, (_, i) => i).filter(i => i !== u)
    return raw.filter(v => {
      const target = nodes[v]
      return !!target && isNodeConnectionAllowed(currentNode, target, config)
    })
  }

  const shortestNodeChain = (s: number, t: number): number[] | null => {
    const n = nodes.length
    const D = Array(n).fill(Infinity)
    const prev = Array(n).fill(-1)
    const used = Array(n).fill(false)
    D[s] = 0

    for (;;) {
      let u = -1; let best = Infinity
      for (let i = 0; i < n; i++) if (!used[i] && D[i] < best) { best = D[i]; u = i }
      if (u === -1) break
      if (u === t) break
      used[u] = true

      const neighbors = getNeighborIndexes(u)
      for (const v of neighbors) {
        if (used[v]) continue
        const w = Math.hypot(nodes[u].x - nodes[v].x, nodes[u].y - nodes[v].y)
        if (D[u] + w < D[v]) { D[v] = D[u] + w; prev[v] = u }
      }
    }

    if (prev[t] === -1 && s !== t) return null
    const chain: number[] = []
    let cur = t
    while (cur !== -1) { chain.push(cur); cur = prev[cur] }
    chain.reverse()
    return chain
  }

  const appendChain = (parts: Point[], s: number, t: number) => {
    const chain = shortestNodeChain(s, t)
    if (!chain) return false
    for (const i of chain) pushIfDifferent(parts, { x: nodes[i].x, y: nodes[i].y })
    return true
  }

  // If explicit via labels provided, route through graph edges between each via.
  if (viaLabels && viaLabels.length > 0 && nodes.length > 0) {
    const parts: Point[] = []
    roomPrefix.forEach(p => pushIfDifferent(parts, p))

    let currentIdx = getRoomStartIndex()
    if (currentIdx !== -1) pushIfDifferent(parts, { x: nodes[currentIdx].x, y: nodes[currentIdx].y })

    for (const label of viaLabels) {
      const targetIdx = nodeIndex.get(label)
      if (targetIdx === undefined) continue
      if (currentIdx === -1) {
        currentIdx = targetIdx
        pushIfDifferent(parts, { x: nodes[currentIdx].x, y: nodes[currentIdx].y })
        continue
      }
      if (appendChain(parts, currentIdx, targetIdx)) currentIdx = targetIdx
    }

    if (exitPoint) {
      const exitIdx = findNearestIndex(exitPoint)
      if (currentIdx === -1) {
        currentIdx = exitIdx
        pushIfDifferent(parts, { x: nodes[currentIdx].x, y: nodes[currentIdx].y })
      } else {
        appendChain(parts, currentIdx, exitIdx)
      }
    }

    if (finalExitPoint) pushIfDifferent(parts, finalExitPoint)
    return avoidForbiddenZones(parts, config)
  }

  // Otherwise, connect via corridor nodes: nearest node to room -> shortest chain -> nearest node to exit
  if (nodes.length > 0) {
    if (!roomPoint || !exitPoint) {
      const parts: Point[] = []
      roomPrefix.forEach(p => pushIfDifferent(parts, p))
      if (finalExitPoint) pushIfDifferent(parts, finalExitPoint)
      return avoidForbiddenZones(parts, config)
    }

    const s = getRoomStartIndex()
    const t = findNearestIndex(exitPoint)
    const idxChain = s !== -1 ? shortestNodeChain(s, t) : null

    const parts: Point[] = []
    roomPrefix.forEach(p => pushIfDifferent(parts, p))
    if (idxChain) for (const i of idxChain) pushIfDifferent(parts, { x: nodes[i].x, y: nodes[i].y })
    if (finalExitPoint) pushIfDifferent(parts, finalExitPoint)
    return avoidForbiddenZones(parts, config)
  }

  // Fallback: direct room center -> exit path
  const parts: Point[] = []
  roomPrefix.forEach(p => pushIfDifferent(parts, p))
    if (finalExitPoint) pushIfDifferent(parts, finalExitPoint)
  return avoidForbiddenZones(parts, config)
}

function buildNodeProgressPreviewPath(
  config: FloorConfig,
  selectedRoom: string | null,
  selectedVias: string[] | undefined,
  entryNodeLabel: string | null | undefined,
): Point[] {
  if (!selectedRoom || !selectedVias || selectedVias.length === 0) return []
  const room = config.rooms[selectedRoom]
  if (!room) return []

  const nodes = config.corridorNodes?.filter(n => !isForbiddenAnchor(n)) ?? []
  const nodeByLabel = new Map(nodes.map(n => [n.label, n]))
  const out: Point[] = []
  const pushIfDifferent = (p: Point) => {
    const last = out[out.length - 1]
    if (!last || last.x !== p.x || last.y !== p.y) out.push(p)
  }

  pushIfDifferent({ x: room.x, y: room.y })
  if (entryNodeLabel) {
    const entry = nodeByLabel.get(entryNodeLabel)
    if (entry) pushIfDifferent({ x: entry.x, y: entry.y })
  }

  for (const label of selectedVias) {
    const node = nodeByLabel.get(label)
    if (node) pushIfDifferent({ x: node.x, y: node.y })
  }

  return out
}

function buildNodeOnlyReroutePath(
  config: FloorConfig,
  fromPoint: Point,
  toExitKey: string,
): Point[] {
  const exit = config.exits[toExitKey]
  if (!exit) return [fromPoint]

  const nodes = config.corridorNodes?.filter(n => !isForbiddenAnchor(n)) ?? []
  if (nodes.length === 0) {
    return [fromPoint, { x: exit.x, y: exit.y }]
  }

  const nodeIndex = new Map(nodes.map((n, i) => [n.label, i]))
  const findNearestIndex = (pt: Point) => {
    let best = 0
    let bestDist = Infinity
    for (let i = 0; i < nodes.length; i++) {
      const d = Math.hypot(pt.x - nodes[i].x, pt.y - nodes[i].y)
      if (d < bestDist) {
        bestDist = d
        best = i
      }
    }
    return best
  }

  const getNeighborIndexes = (u: number): number[] => {
    const currentNode = nodes[u]
    if (!currentNode) return []

    const direct = (currentNode.neighbors || [])
      .map(n => nodeIndex.get(neighborLabel(n)))
      .filter((idx): idx is number => idx !== undefined)

    const reverse = nodes
      .map((n, i) => ({ n, i }))
      .filter(({ i }) => i !== u)
      .filter(({ n }) => (n.neighbors || []).some(nb => neighborLabel(nb) === currentNode.label))
      .map(({ i }) => i)

    const explicit = Array.from(new Set([...direct, ...reverse]))
    if (explicit.length > 0) {
      return explicit.filter(v => !!nodes[v])
    }

    const raw = Array.from({ length: nodes.length }, (_, i) => i).filter(i => i !== u)
    return raw.filter(v => {
      const target = nodes[v]
      return !!target && isNodeConnectionAllowed(currentNode, target, config)
    })
  }

  const shortestNodeChain = (s: number, t: number): number[] | null => {
    const n = nodes.length
    const D = Array(n).fill(Infinity)
    const prev = Array(n).fill(-1)
    const used = Array(n).fill(false)
    D[s] = 0

    for (;;) {
      let u = -1
      let best = Infinity
      for (let i = 0; i < n; i++) {
        if (!used[i] && D[i] < best) {
          best = D[i]
          u = i
        }
      }
      if (u === -1) break
      if (u === t) break
      used[u] = true

      const neighbors = getNeighborIndexes(u)
      for (const v of neighbors) {
        if (used[v]) continue
        const w = Math.hypot(nodes[u].x - nodes[v].x, nodes[u].y - nodes[v].y)
        if (D[u] + w < D[v]) {
          D[v] = D[u] + w
          prev[v] = u
        }
      }
    }

    if (prev[t] === -1 && s !== t) return null
    const chain: number[] = []
    let cur = t
    while (cur !== -1) {
      chain.push(cur)
      cur = prev[cur]
    }
    chain.reverse()
    return chain
  }

  const s = findNearestIndex(fromPoint)
  const t = findNearestIndex({ x: exit.x, y: exit.y })
  const idxChain = shortestNodeChain(s, t)

  const out: Point[] = []
  const pushIfDifferent = (p: Point) => {
    const last = out[out.length - 1]
    if (!last || last.x !== p.x || last.y !== p.y) out.push(p)
  }

  pushIfDifferent(fromPoint)
  if (idxChain) {
    for (const i of idxChain) {
      pushIfDifferent({ x: nodes[i].x, y: nodes[i].y })
    }
  }
  pushIfDifferent({ x: exit.x, y: exit.y })

  return out
}

// --- Forbidden-zone helpers: avoid simple rectangular "railing/stairs" areas derived from corridorNodes
function buildForbiddenRects(config: FloorConfig) {
  const rects: { x: number; y: number; w: number; h: number }[] = []
  if (!config.corridorNodes) return rects
  for (const n of config.corridorNodes) {
    if (/stair/i.test(n.label) || /stairs/i.test(n.label)) {
      const w = 140
      const h = 80
      rects.push({ x: Math.round(n.x - w / 2), y: Math.round(n.y - h / 2), w, h })
    }
  }
  return rects
}

function pointInRect(p: Point, r: { x: number; y: number; w: number; h: number }) {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h
}

function segmentIntersectsRect(a: Point, b: Point, r: { x: number; y: number; w: number; h: number }) {
  if ((a.x < r.x && b.x < r.x) || (a.x > r.x + r.w && b.x > r.x + r.w) || (a.y < r.y && b.y < r.y) || (a.y > r.y + r.h && b.y > r.y + r.h)) return false
  if (pointInRect(a, r) || pointInRect(b, r)) return true
  const rectEdges = [
    [{ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y }],
    [{ x: r.x + r.w, y: r.y }, { x: r.x + r.w, y: r.y + r.h }],
    [{ x: r.x + r.w, y: r.y + r.h }, { x: r.x, y: r.y + r.h }],
    [{ x: r.x, y: r.y + r.h }, { x: r.x, y: r.y }],
  ]
  const intersects = (p1: Point, p2: Point, p3: Point, p4: Point) => {
    const orient = (p: Point, q: Point, r: Point) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x)
    const o1 = orient(p1, p2, p3)
    const o2 = orient(p1, p2, p4)
    const o3 = orient(p3, p4, p1)
    const o4 = orient(p3, p4, p2)
    return o1 * o2 < 0 && o3 * o4 < 0
  }
  for (const [e1, e2] of rectEdges) if (intersects(a, b, e1, e2)) return true
  return false
}

function isNodeConnectionAllowed(a: Point, b: Point, config: FloorConfig): boolean {
  // Prevent long "teleport" links that cut through interior/stair boundaries.
  const edgeLength = Math.hypot(a.x - b.x, a.y - b.y)
  if (edgeLength > 200) return false
  const rects = buildForbiddenRects(config)
  return !rects.some(r => segmentIntersectsRect(a, b, r))
}

function avoidForbiddenZones(path: Point[], config: FloorConfig): Point[] {
  if (!path || path.length < 2) return path
  // filter out accidental origin points first
  const filtered = path.filter(p => !(p.x === 0 && p.y === 0) && !isForbiddenAnchor(p))
  const rects = buildForbiddenRects(config)
  if (rects.length === 0) return filtered
  const out: Point[] = []
  const pushIfDifferent = (p: Point) => {
    const last = out[out.length - 1]
    if (!last || last.x !== p.x || last.y !== p.y) out.push(p)
  }
  for (let i = 0; i < filtered.length - 1; i++) {
    const a = filtered[i]
    const b = filtered[i + 1]
    let handled = false
    for (const r of rects) {
      if (segmentIntersectsRect(a, b, r)) {
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
        const left = { x: r.x - 12, y: mid.y }
        const right = { x: r.x + r.w + 12, y: mid.y }
        const top = { x: mid.x, y: r.y - 12 }
        const bottom = { x: mid.x, y: r.y + r.h + 12 }
        const candidates = [left, right, top, bottom]
        const valid = candidates.filter(c => !rects.some(rr => pointInRect(c, rr)))
        if (valid.length === 0) continue
        const dist = (p: Point, q: Point) => Math.hypot(p.x - q.x, p.y - q.y)
        valid.sort((p, q) => (dist(a, p) + dist(p, b)) - (dist(a, q) + dist(q, b)))
        const detour = valid[0]
        pushIfDifferent(a)
        pushIfDifferent(detour)
        handled = true
        break
      }
    }
    if (!handled) pushIfDifferent(a)
  }
  pushIfDifferent(filtered[filtered.length - 1])
  return out
}

// ─── Shared SVG Sub-components ───────────────────────────────────────────────

interface FloorPlanProps {
  config: FloorConfig
  disaster: DisasterType
  obstacles: ObstacleDef[]
  selectedExit: string | null
  selectedRoom: string | null
  agentPos: Point
  phase: SimPhase
  blockedExits: Set<string>
  onExitClick: (e: string) => void
  selectedVias?: string[]
  onChooseNeighbor?: (label: string) => void
  selectableNodeLabels?: string[]
  entryNodeLabel?: string | null
  currentNodeLabel?: string | null
  backNodeLabel?: string | null
}

function ObstacleLayer({ obstacles }: { obstacles: ObstacleDef[] }) {
  return (
    <>
      {obstacles.map(obs => {
        const cx = obs.x + obs.w / 2
        const cy = obs.y + obs.h / 2
        const baseR = Math.max(obs.w, obs.h) / 2
        if (obs.type === 'fire') return (
          <g key={obs.id}>
            <circle cx={cx} cy={cy} r={baseR * 0.85}
              fill="url(#rg-fire)" opacity="0.7">
              <animate attributeName="r" values={`${baseR * 0.75};${baseR * 1.2};${baseR * 0.75}`} dur="1.3s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.55;0.85;0.55" dur="1.3s" repeatCount="indefinite" />
            </circle>
            <circle cx={cx} cy={cy} r={baseR * 0.5}
              fill="url(#rg-fire)" opacity="0.9">
              <animate attributeName="r" values={`${baseR * 0.45};${baseR * 0.7};${baseR * 0.45}`} dur="0.9s" repeatCount="indefinite" />
            </circle>
            <circle cx={cx} cy={cy} r={baseR * 1.25}
              fill="none" stroke="#ffedd5" strokeOpacity="0.35" strokeWidth="1.5">
              <animate attributeName="r" values={`${baseR * 1.05};${baseR * 1.35};${baseR * 1.05}`} dur="1.7s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.2;0.45;0.2" dur="1.7s" repeatCount="indefinite" />
            </circle>
            <text x={cx} y={cy + 5}
              textAnchor="middle" fill="#ff8c00" fontSize="11"
              fontFamily="system-ui, sans-serif" fontWeight="700">
              {'\uD83D\uDD25'} {obs.label}
            </text>
          </g>
        )
        if (obs.type === 'smoke') return (
          <g key={obs.id}>
            <circle cx={cx} cy={cy} r={baseR * 0.95}
              fill="url(#rg-smoke)" opacity="0.6">
              <animate attributeName="r" values={`${baseR * 0.8};${baseR * 1.25};${baseR * 0.8}`} dur="2.4s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.45;0.75;0.45" dur="2.4s" repeatCount="indefinite" />
            </circle>
            <circle cx={cx} cy={cy} r={baseR * 1.4}
              fill="none" stroke="#94a3b8" strokeOpacity="0.35" strokeWidth="1">
              <animate attributeName="r" values={`${baseR * 1.15};${baseR * 1.55};${baseR * 1.15}`} dur="2.8s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.15;0.4;0.15" dur="2.8s" repeatCount="indefinite" />
            </circle>
            <text x={cx} y={cy + 4}
              textAnchor="middle" fill="#9ca3af" fontSize="10"
              fontFamily="system-ui, sans-serif">
              {'\u2601'} Smoke
            </text>
          </g>
        )
        if (obs.type === 'debris') return (
          <g key={obs.id}>
            <rect x={obs.x} y={obs.y} width={obs.w} height={obs.h}
              fill="#78350f" rx="3" />
            <rect x={obs.x} y={obs.y} width={obs.w} height={obs.h}
              fill="url(#hatch)" rx="3" />
            <text x={obs.x + obs.w / 2} y={obs.y + obs.h / 2 + 4}
              textAnchor="middle" fill="#fbbf24" fontSize="9.5"
              fontFamily="system-ui, sans-serif" fontWeight="700">
              {'\u26A0'} {obs.label}
            </text>
          </g>
        )
        return null
      })}
    </>
  )
}

function SimOverlay({ config, obstacles, selectedExit, selectedRoom, agentPos, phase, blockedExits, onExitClick, selectedVias, onChooseNeighbor, selectableNodeLabels, entryNodeLabel, currentNodeLabel, backNodeLabel }: FloorPlanProps) {
  const isPlanning = phase === 'planning'
  const showHazards = obstacles.length > 0
  const pathD = (points: Point[]) => points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
  const nodeProgressPath = isPlanning && !selectedExit
    ? buildNodeProgressPreviewPath(config, selectedRoom, selectedVias, entryNodeLabel)
    : []

  return (
    <>
      <defs>
        <radialGradient id="rg-fire" cx="50%" cy="60%">
          <stop offset="0%" stopColor="#ff4500" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#ff8c00" stopOpacity="0.35" />
        </radialGradient>
        <radialGradient id="rg-smoke">
          <stop offset="0%" stopColor="#6b7280" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#4b5563" stopOpacity="0.20" />
        </radialGradient>
        <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="#92400e" strokeWidth="1.5" opacity="0.6" />
        </pattern>
      </defs>

      {/* Hazards only visible during simulation, not planning */}
      {showHazards && <ObstacleLayer obstacles={obstacles} />}

      {/* Node-step preview path (shown while selecting corridor nodes before choosing an exit) */}
      {isPlanning && !selectedExit && nodeProgressPath.length >= 2 && (
        <>
          <path
            d={pathD(nodeProgressPath)}
            fill="none"
            stroke="#0ea5e955"
            strokeWidth="6"
            strokeLinecap="round"
          />
          <path
            d={pathD(nodeProgressPath)}
            fill="none"
            stroke="#0ea5e9"
            strokeWidth="2.4"
            strokeDasharray="6 5"
            strokeLinecap="round"
            opacity="0.9"
          />
        </>
      )}

      {/* Selected route — stronger highlight */}
      {selectedExit && isPlanning && config.primaryPaths[selectedExit] && (() => {
        const fullPath = buildFullPath(config, selectedRoom, selectedExit, selectedVias, { previewFromCorridorEntry: true })
        return (
          <>
            <path
              d={pathD(fullPath)}
              fill="none"
              stroke={blockedExits.has(selectedExit) ? '#ef444455' : '#2db8b055'}
              strokeWidth="8"
              strokeLinecap="round"
            />
            <path
              d={pathD(fullPath)}
              fill="none"
              stroke={blockedExits.has(selectedExit) ? '#ef4444' : '#2db8b0'}
              strokeWidth="2.8"
              strokeDasharray="8 5"
              strokeLinecap="round"
              opacity="0.92"
            >
              <animate attributeName="stroke-dashoffset" values="0;-39" dur="1.5s" repeatCount="indefinite" />
            </path>
          </>
        )
      })()}

      {/* Exits */}
      {Object.keys(config.exits).map(key => {
        const ex = config.exits[key]
        const blocked = blockedExits.has(key)
        const selected = selectedExit === key
        const color = blocked ? '#ef4444' : '#22c55e'
        const isStair = key.startsWith('S')
        return (
          <g key={key}
            onClick={isPlanning ? () => onExitClick(key) : undefined}
            style={{ cursor: isPlanning ? 'pointer' : 'default' }}>
            {selected && (
              <circle cx={ex.x} cy={ex.y} r="22"
                fill="none" stroke={color} strokeWidth="1.5" opacity="0.3">
                <animate attributeName="r" values="18;24;18" dur="1.5s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.3;0.1;0.3" dur="1.5s" repeatCount="indefinite" />
              </circle>
            )}
            {isStair ? (
              <rect
                x={ex.x - (selected ? 15 : 11)} y={ex.y - (selected ? 15 : 11)}
                width={selected ? 30 : 22} height={selected ? 30 : 22} rx="5"
                fill={selected ? color : `${color}22`}
                stroke={color} strokeWidth={selected ? 2.5 : 1.8}
                style={{ transition: 'all 0.2s' }} />
            ) : (
              <circle cx={ex.x} cy={ex.y} r={selected ? 17 : 13}
                fill={selected ? color : `${color}22`}
                stroke={color} strokeWidth={selected ? 2.5 : 1.8}
                style={{ transition: 'all 0.2s' }} />
            )}
            <text x={ex.x} y={ex.y + 4}
              textAnchor="middle" fill={selected ? '#fff' : color}
              fontSize="10" fontFamily="system-ui, sans-serif" fontWeight="700">
              {key}
            </text>
            {blocked && (
              <>
                <line x1={ex.x - 8} y1={ex.y - 8} x2={ex.x + 8} y2={ex.y + 8}
                  stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" />
                <line x1={ex.x + 8} y1={ex.y - 8} x2={ex.x - 8} y2={ex.y + 8}
                  stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" />
              </>
            )}
          </g>
        )
      })}

      {/* Corridor nodes (clickable) */}
      {isPlanning && selectedRoom && config.corridorNodes && (
        <g>
          {config.corridorNodes.filter(n => !isForbiddenAnchor(n)).map(node => {
            const index = selectedVias ? selectedVias.indexOf(node.label) : -1
            const selected = index !== -1
            const isEntry = entryNodeLabel === node.label
            const isCurrent = currentNodeLabel === node.label
            const canSelect = selectableNodeLabels ? selectableNodeLabels.includes(node.label) : true
            return (
              <g key={`node-${node.label}`} style={{ cursor: canSelect ? 'pointer' : 'default' }}>
                <g onClick={() => canSelect && onChooseNeighbor?.(node.label)}>
                  {(isEntry || isCurrent) && (
                    <circle cx={node.x} cy={node.y} r={selected ? 13 : 11}
                      fill="none" stroke={isCurrent ? '#2db8b0' : '#3b82f6'} strokeWidth={1.8} opacity={0.65} />
                  )}
                  <circle cx={node.x} cy={node.y} r={selected ? 8 : 5}
                    fill={selected ? '#f59e0b' : isCurrent ? '#2db8b0' : canSelect ? '#334155' : '#94a3b8'} stroke={selected ? '#fff' : '#1e2f46'} strokeWidth={1.5} />
                  {selected && (
                    <text x={node.x} y={node.y + 4} textAnchor="middle" fill="#fff" fontSize="8" fontFamily="system-ui, sans-serif" fontWeight={700}>{index + 1}</text>
                  )}
                  {!selected && (
                    <text x={node.x} y={node.y - 10} textAnchor="middle" fill={isCurrent ? '#0f766e' : '#64748b'} fontSize="9" fontFamily="system-ui, sans-serif" fontWeight={isCurrent ? 700 : 500}>
                      {isEntry ? `${node.label} (Start)` : node.label}
                    </text>
                  )}
                </g>
                {backNodeLabel === node.label && (
                  <text x={node.x} y={node.y + 18} textAnchor="middle" fill="#c2410c" fontSize="9" fontFamily="system-ui, sans-serif" fontWeight={700}>
                    Back
                  </text>
                )}
              </g>
            )
          })}
        </g>
      )}

      {/* Agent */}
      {phase !== 'planning' && (
        <g>
          <circle cx={agentPos.x} cy={agentPos.y + 3} r="11" fill="#000" opacity="0.18" />
          <circle cx={agentPos.x} cy={agentPos.y} r="11" fill="#2db8b0" stroke="#fff" strokeWidth="2" />
          <circle cx={agentPos.x} cy={agentPos.y - 4} r="3.5" fill="#fff" />
          <path d={`M${agentPos.x - 5},${agentPos.y + 4} Q${agentPos.x},${agentPos.y + 9} ${agentPos.x + 5},${agentPos.y + 4}`}
            stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        </g>
      )}

      {/* Start marker — small dot only, no YOU label (room position may be out of bounds on floorplan) */}
      {phase === 'planning' && selectedRoom && (
        <g>
          <circle cx={agentPos.x} cy={agentPos.y} r="6"
            fill="#2db8b0" stroke="#fff" strokeWidth="1.5" opacity="0.9" />
        </g>
      )}

      {/* Exit labels */}
      {Object.keys(config.exits).map(key => {
        const ex = config.exits[key]
        const blocked = blockedExits.has(key)
        const lx = ex.x < 100 ? ex.x + 38 : ex.x > config.viewWidth - 100 ? ex.x - 38 : ex.x
        const ly = ex.y > config.viewHeight - 60 ? ex.y - 22 : ex.y + 28
        return (
          <text key={`lbl-${key}`} x={lx} y={ly}
            textAnchor="middle" fill={blocked ? '#ef444488' : '#22c55e88'}
            fontSize="9" fontFamily="system-ui, sans-serif">
            {ex.desc}
          </text>
        )
      })}
    </>
  )
}

// ─── Admin Building Floor Plan ───────────────────────────────────────────────
function AdminFloorPlan(props: FloorPlanProps) {
const { config } = props
  const floorPlanSrcByLabel: Record<string, string> = {
    '1st Floor': '/floorplans/Admin%201st%20floor.svg',
    '2nd Floor': '/floorplans/Admin%202nd%20floor.svg',
  }
  const floorPlanSrc = floorPlanSrcByLabel[config.floorLabel] ?? ''

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {floorPlanSrc && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={floorPlanSrc}
          alt="UP Cebu Admin Building Floor Plan"
          style={{ width: '100%', height: '100%', display: 'block', position: 'absolute', top: 0, left: 0, objectFit: 'contain', objectPosition: 'center' }}
        />
      )}
      <svg
        viewBox={`0 0 ${config.viewWidth} ${config.viewHeight}`} preserveAspectRatio="xMidYMid meet"
        style={{ width: '100%', height: '100%', display: 'block', position: 'absolute', top: 0, left: 0 }}
      >
        <SimOverlay {...props} />
      </svg>
    </div>
  )
}

// ─── UP Cebu Library Floor Plan ──────────────────────────────────────────────
// Mirrors CSBFloorPlan: renders the actual SVG floorplan as a background image,
// then overlays the simulation elements via <SimOverlay />.
function LibraryFloorPlan(props: FloorPlanProps) {
  const { config } = props
  const floorPlanSrcByLabel: Record<string, string> = {
    '1st Floor': '/floorplans/Library%201st%20floor.svg',
    '2nd Floor': '/floorplans/Library%202nd%20floor.svg',
  }
  const floorPlanSrc = floorPlanSrcByLabel[config.floorLabel] ?? ''

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {floorPlanSrc && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={floorPlanSrc}
          alt="UP Cebu Library Floor Plan"
          style={{ width: '100%', height: '100%', display: 'block', position: 'absolute', top: 0, left: 0, objectFit: 'contain', objectPosition: 'center' }}
        />
      )}
      <svg
        viewBox={`0 0 ${config.viewWidth} ${config.viewHeight}`} preserveAspectRatio="xMidYMid meet"
        style={{ width: '100%', height: '100%', display: 'block', position: 'absolute', top: 0, left: 0 }}
      >
        <SimOverlay {...props} />
      </svg>
    </div>
  )
}

function ASXFloorPlan(props: FloorPlanProps) {
  const { config } = props
  const floorPlanSrcByLabel: Record<string, string> = {
    '1st Floor': '/floorplans/ASX%201st%20floor.svg',
  }
  const floorPlanSrc = floorPlanSrcByLabel[config.floorLabel] ?? ''

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {floorPlanSrc && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={floorPlanSrc}
          alt="UP Cebu ASX Floor Plan"
          style={{ width: '100%', height: '100%', display: 'block', position: 'absolute', top: 0, left: 0, objectFit: 'contain', objectPosition: 'center' }}
        />
      )}
      <svg
        viewBox={`0 0 ${config.viewWidth} ${config.viewHeight}`} preserveAspectRatio="xMidYMid meet"
        style={{ width: '100%', height: '100%', display: 'block', position: 'absolute', top: 0, left: 0 }}
      >
        <SimOverlay {...props} />
      </svg>
    </div>
  )
}

function CSBFloorPlan(props: FloorPlanProps) {
  const { config } = props
  const floorPlanSrcByLabel: Record<string, string> = {
    '1st Floor': '/floorplans/CSB%201st%20floor.svg',
    '2nd Floor': '/floorplans/CSB%202nd%20floor.svg',
    '3rd Floor': '/floorplans/CSB%203rd%20floor.svg',
    '4th Floor': '/floorplans/CSB%204th%20floor.svg',
    '5th Floor': '/floorplans/CSB%205th%20floor.svg',
    '6th Floor': '/floorplans/CSB%206th%20floor.svg',
  }
  const floorPlanSrc = floorPlanSrcByLabel[config.floorLabel] ?? ''

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {floorPlanSrc && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={floorPlanSrc}
          alt="UP Cebu Science Building Floor Plan"
          style={{ width: '100%', height: '100%', display: 'block', position: 'absolute', top: 0, left: 0, objectFit: 'contain', objectPosition: 'center' }}
        />
      )}
      <svg
        viewBox={`0 0 ${config.viewWidth} ${config.viewHeight}`} preserveAspectRatio="xMidYMid meet"
        style={{ width: '100%', height: '100%', display: 'block', position: 'absolute', top: 0, left: 0 }}
      >
        <SimOverlay {...props} />
      </svg>
    </div>
  )
}

// Generic fallback floor plan for buildings without a custom layout — overlays
// the simulation on a blank canvas so the page still renders.
function GenericFloorPlan(props: FloorPlanProps) {
  const { config } = props
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: '#f8fafc' }}>
      <svg
        viewBox={`0 0 ${config.viewWidth} ${config.viewHeight}`} preserveAspectRatio="xMidYMid meet"
        style={{ width: '100%', height: '100%', display: 'block', position: 'absolute', top: 0, left: 0 }}
      >
        <SimOverlay {...props} />
      </svg>
    </div>
  )
}

// ── Floor plan selector ──
function FloorPlanView(props: FloorPlanProps & { buildingId: string }) {
  const { buildingId, ...rest } = props
  if (buildingId === 'admin-building') return <AdminFloorPlan {...rest} />
  if (buildingId === 'science-building') return <CSBFloorPlan {...rest} />
  if (buildingId === 'up-cebu-library') return <LibraryFloorPlan {...rest} />
  if (buildingId === 'asx') return <ASXFloorPlan {...rest} />
  return <GenericFloorPlan {...rest} />
}

// ─── Main Page ────────────────────────────────────────────────────────────────
const DISASTER_META: Record<string, { label: string; color: string }> = {
  fire:       { label: 'Fire Simulation',       color: '#ff6b35' },
  earthquake: { label: 'Earthquake Simulation', color: '#f59e0b' },
}

export default function SimulationRunPage() {
  const { isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const params  = useParams()
  const search  = useSearchParams()

  const regionId = params.id as string
  const disaster = (search.get('disaster') || 'fire') as DisasterType
  const parsedFloor = Number.parseInt(search.get('floor') || '0', 10)
  const initialFloor = Number.isFinite(parsedFloor) ? Math.max(0, parsedFloor) : 0
  const meta     = DISASTER_META[disaster] || DISASTER_META.fire

  const floors = useMemo(() => getFloorConfigs(regionId), [regionId])
  const isFloorConfigLoading = false
  const floorConfigLoadError: string | null = null
  const hasFloors = floors.length > 0

  const clampFloorIdx = (idx: number) => Math.min(Math.max(idx, 0), Math.max(floors.length - 1, 0))
  const [floorIdx,      setFloorIdx]      = useState(() => clampFloorIdx(initialFloor))
  const [phase,         setPhase]         = useState<SimPhase>('planning')
  const [selectedRoom,  setSelectedRoom]  = useState<string | null>(null)
  const [routeMode,     setRouteMode]     = useState<RouteMode>(null)
  const [selectedExit,  setSelectedExit]  = useState<string | null>(null)
  const [selectedVias,  setSelectedVias]   = useState<string[]>([])
  const [agentPos,      setAgentPos]      = useState<Point>({ x: 0, y: 0 })
  const [metrics,       setMetrics]       = useState<SimMetrics | null>(null)
  const [events,        setEvents]        = useState<SimEvent[]>([])
  const [elapsedSec,    setElapsedSec]    = useState(0)
  const [activeBlockedExits, setActiveBlockedExits] = useState<Set<string>>(new Set())
  const [placedHazards, setPlacedHazards] = useState<PlacedHazard[]>(
    () => loadHazardPlan(getHazardStorageKey(regionId, clampFloorIdx(initialFloor), disaster))?.hazards ?? [],
  )

  // Sync floorIdx + placedHazards to URL/region/floor changes via render-time
  // state correction (avoids the react-hooks/set-state-in-effect lint error).
  const [floorSync, setFloorSync] = useState({ regionId, initialFloor, floorsLen: floors.length })
  if (floorSync.regionId !== regionId || floorSync.initialFloor !== initialFloor || floorSync.floorsLen !== floors.length) {
    setFloorSync({ regionId, initialFloor, floorsLen: floors.length })
    setFloorIdx(clampFloorIdx(initialFloor))
  }

  const animRef   = useRef<ReturnType<typeof setInterval> | null>(null)
  const rerouteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const runTokenRef = useRef(0)
  const phase2Ref = useRef<SimPhase>('planning')

  const clearSimulationTimers = useCallback(() => {
    if (animRef.current) {
      clearInterval(animRef.current)
      animRef.current = null
    }
    if (rerouteTimeoutRef.current) {
      clearTimeout(rerouteTimeoutRef.current)
      rerouteTimeoutRef.current = null
    }
  }, [])

  const invalidateActiveRun = useCallback(() => {
    runTokenRef.current += 1
  }, [])

  const activeFloorIdx = hasFloors ? Math.min(Math.max(floorIdx, 0), floors.length - 1) : 0
  const config = hasFloors ? floors[activeFloorIdx] : null
  const hazardStorageKey = useMemo(() => getHazardStorageKey(regionId, activeFloorIdx, disaster), [regionId, activeFloorIdx, disaster])
  const activeObstacles = useMemo(() => buildObstaclesFromPlaced(placedHazards, disaster), [placedHazards, disaster])
  const hardHazards = useMemo(() => activeObstacles.filter(isHardHazard), [activeObstacles])
  const smokeHazards = useMemo(() => activeObstacles.filter((hazard) => hazard.type === 'smoke'), [activeObstacles])
  const currentFloorRooms = useMemo(() => {
    if (!config) return [] as Array<[string, RoomDef]>

    return Object.entries(config.rooms)
      .filter(([key]) => key !== 'corridor')
      .sort(([, a], [, b]) => a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' }))
  }, [config])

  // Reload hazards from storage when the active key changes (render-time pattern).
  const [hazardKeySync, setHazardKeySync] = useState(hazardStorageKey)
  if (hazardKeySync !== hazardStorageKey) {
    setHazardKeySync(hazardStorageKey)
    setPlacedHazards(loadHazardPlan(hazardStorageKey)?.hazards ?? [])
  }

  // Drop the room selection if it no longer belongs to the current floor.
  if (selectedRoom && !currentFloorRooms.some(([key]) => key === selectedRoom)) {
    setSelectedRoom(null)
    setSelectedExit(null)
    setRouteMode(null)
    setSelectedVias([])
  }

  const planningAgentPos = useMemo<Point>(() => {
    if (!config || !selectedRoom || !config.rooms[selectedRoom]) {
      // Do not default to corridor/startPos — require user to select a room.
      // Reset position to origin (off-map) so no implicit starting point is used.
      return { x: 0, y: 0 }
    }
    const room = config.rooms[selectedRoom]
    return { x: room.x, y: room.y }
  }, [config, selectedRoom])
  useEffect(() => { if (!isLoading && !isAuthenticated) window.location.href = '/auth' }, [isLoading, isAuthenticated])
  useEffect(() => { phase2Ref.current = phase }, [phase])
  useEffect(() => () => {
    invalidateActiveRun()
    clearSimulationTimers()
  }, [clearSimulationTimers, invalidateActiveRun])

  const blockedExits = useMemo(() => {
    return phase === 'planning' ? new Set<string>() : activeBlockedExits
  }, [phase, activeBlockedExits])

  const corridorNodes = useMemo(() => {
    return (config?.corridorNodes || []).filter(n => !isForbiddenAnchor(n))
  }, [config])

  const corridorNodeByLabel = useMemo(() => {
    return new Map(corridorNodes.map(n => [n.label, n]))
  }, [corridorNodes])

  const exitHazardStats = useMemo(() => {
    const blockedExits = new Set<string>()
    const exposureByExit = new Map<string, boolean>()
    const smokeLengthByExit = new Map<string, number>()
    const blockTByExit = new Map<string, number>()

    if (!config) {
      return { blockedExits, exposureByExit, smokeLengthByExit, blockTByExit }
    }

    const exposureHazards = activeObstacles.filter((hazard) => hazard.type !== 'debris')

    for (const exitKey of Object.keys(config.exits)) {
      const path = buildFullPath(config, selectedRoom, exitKey, selectedVias)
      const blockT = computePathBlockT(path, hardHazards)
      if (blockT !== null) {
        blockedExits.add(exitKey)
        blockTByExit.set(exitKey, blockT)
      }
      exposureByExit.set(exitKey, pathIntersectsHazards(path, exposureHazards))
      smokeLengthByExit.set(exitKey, computeSmokeLength(path, smokeHazards))
    }

    return { blockedExits, exposureByExit, smokeLengthByExit, blockTByExit }
  }, [config, selectedRoom, selectedVias, activeObstacles, hardHazards, smokeHazards])

  const potentialBlockedExits = useMemo(() => {
    return exitHazardStats.blockedExits
  }, [exitHazardStats])

  const resolveEntryNodeForRoom = useCallback((roomKey: string): string | null => {
    if (!config || !config.rooms[roomKey] || corridorNodes.length === 0) return null
    const room = config.rooms[roomKey]
    const entry = resolveRoomEntryNode(room, corridorNodes)
    return entry?.label ?? null
  }, [config, corridorNodes])

  const entryNodeLabel = useMemo(() => {
    if (!selectedRoom) return null
    return resolveEntryNodeForRoom(selectedRoom)
  }, [selectedRoom, resolveEntryNodeForRoom])

  const currentNodeLabel = useMemo(() => {
    return selectedVias.length > 0 ? selectedVias[selectedVias.length - 1] : entryNodeLabel
  }, [selectedVias, entryNodeLabel])

  const backNodeLabel = useMemo(() => {
    if (selectedVias.length === 0) return null
    if (selectedVias.length === 1) return entryNodeLabel
    return selectedVias[selectedVias.length - 2]
  }, [selectedVias, entryNodeLabel])

  const getNeighborLabels = useCallback((label: string, fallbackLimit = 2): string[] => {
    if (!config) return []
    const node = corridorNodeByLabel.get(label)
    if (!node) return []

    const direct = (node.neighbors || [])
      .map(neighborLabel)
      .filter(lbl => {
        const neighbor = corridorNodeByLabel.get(lbl)
        return !!neighbor && !isForbiddenAnchor(neighbor)
      })

    const reverse = corridorNodes
      .filter(n => n.label !== label)
      .filter(n => (n.neighbors || []).some(nb => neighborLabel(nb) === label))
      .map(n => n.label)

    let options = Array.from(new Set([...direct, ...reverse]))

    if (options.length === 0) {
      // Fallback for configs without explicit graph links.
      const others = corridorNodes
        .filter(n => n.label !== label)
        .filter(n => isNodeConnectionAllowed(node, n, config))
      others.sort((a, b) => Math.hypot(a.x - node.x, a.y - node.y) - Math.hypot(b.x - node.x, b.y - node.y))
      const sliced = Number.isFinite(fallbackLimit) ? others.slice(0, fallbackLimit) : others
      options = sliced.map(n => n.label)
    }

    return options
  }, [config, corridorNodeByLabel, corridorNodes])

  const hasNodePath = useCallback((fromLabel: string, toLabel: string): boolean => {
    if (fromLabel === toLabel) return true
    if (!corridorNodeByLabel.has(fromLabel) || !corridorNodeByLabel.has(toLabel)) return false

    const queue: string[] = [fromLabel]
    const visited = new Set<string>([fromLabel])

    while (queue.length > 0) {
      const current = queue.shift()!
      for (const next of getNeighborLabels(current, Number.POSITIVE_INFINITY)) {
        if (next === toLabel) return true
        if (!visited.has(next)) {
          visited.add(next)
          queue.push(next)
        }
      }
    }

    return false
  }, [corridorNodeByLabel, getNeighborLabels])

  const reachableExitKeys = useMemo(() => {
    if (!config) return new Set<string>()
    const exitKeys = Object.keys(config.exits)
    if (!selectedRoom || !currentNodeLabel || corridorNodes.length === 0) return new Set(exitKeys)

    const reachable = new Set<string>()
    for (const key of exitKeys) {
      const exit = config.exits[key]
      if (!exit) continue

      let nearest = corridorNodes[0]
      let best = Infinity
      for (const node of corridorNodes) {
        const d = Math.hypot(node.x - exit.x, node.y - exit.y)
        if (d < best) {
          best = d
          nearest = node
        }
      }

      if (nearest && hasNodePath(currentNodeLabel, nearest.label)) {
        reachable.add(key)
      }
    }

    return reachable
  }, [config, selectedRoom, currentNodeLabel, corridorNodes, hasNodePath])

  const selectableNodeLabels = useMemo(() => {
    const labels = new Set<string>()
    const anchor = currentNodeLabel || entryNodeLabel
    if (entryNodeLabel) labels.add(entryNodeLabel)
    if (!anchor) return Array.from(labels)

    for (const lbl of getNeighborLabels(anchor)) {
      labels.add(lbl)
    }
    if (backNodeLabel) labels.add(backNodeLabel)
    return Array.from(labels)
  }, [currentNodeLabel, entryNodeLabel, backNodeLabel, getNeighborLabels])

  const routes = config
    ? analyzeRoutes(config, selectedRoom, potentialBlockedExits, blockedExits, exitHazardStats.exposureByExit)
    : []
  const selectableRoutes = routes.filter(r => reachableExitKeys.has(r.exitKey))
  const enforceReachability = Boolean(selectedRoom && currentNodeLabel && corridorNodes.length > 0)
  const candidateRoutes = enforceReachability ? selectableRoutes : routes
  const fastestExit = candidateRoutes.length > 0 ? getRecommendedExit(candidateRoutes, 'fastest') : null
  const safestExit = candidateRoutes.length > 0 ? getRecommendedExit(candidateRoutes, 'safest') : null
  const fastestRoute = routes.find(r => r.exitKey === fastestExit)
  const safestRoute = routes.find(r => r.exitKey === safestExit)

  const pushEvent = useCallback((message: string, type: SimEvent['type'] = 'info') => {
    setEvents(prev => [...prev, { time: Date.now(), message, type }])
  }, [])

  const chooseNeighbor = (label: string) => {
    const anchorLabel = currentNodeLabel || entryNodeLabel
    if (!anchorLabel) return

    if (entryNodeLabel && label === entryNodeLabel) {
      // Clicking start node returns planning state to room entry.
      setRouteMode(null)
      setSelectedExit(null)
      setSelectedVias([])
      return
    }

    const allowed = new Set(getNeighborLabels(anchorLabel))
    if (backNodeLabel && backNodeLabel !== anchorLabel) allowed.add(backNodeLabel)
    if (!allowed.has(label)) return

    setRouteMode(null)
    setSelectedExit(null)

    if (backNodeLabel && label === backNodeLabel) {
      setSelectedVias(prev => prev.slice(0, -1))
    } else {
      setSelectedVias(prev => prev.includes(label) ? prev : [...prev, label])
    }
  }

  const finishSimulation = useCallback((chosen: string, actual: string, rerouted: boolean, time: number) => {
    if (!config) return
    setPhase('completed')
    phase2Ref.current = 'completed'

    const hazardExposure = exitHazardStats.exposureByExit.get(chosen) ?? false
    const congestion: SimMetrics['congestionLevel'] = rerouted ? 'High' : 'Medium'

    setMetrics({
      evacuationTime: parseFloat(time.toFixed(1)),
      rerouted,
      reroutedFrom: rerouted ? chosen : undefined,
      reroutedTo: rerouted ? actual : undefined,
      hazardExposure,
      pathEfficiency: rerouted ? 0.58 : (config.efficiency[chosen] || 0.80),
      exitChoice: chosen,
      actualExit: actual,
      congestionLevel: congestion,
    })

    pushEvent(
      rerouted
        ? `Evacuated via ${actual} after reroute \u2014 ${time.toFixed(1)}s total`
        : `Successfully evacuated via ${actual} in ${time.toFixed(1)}s`,
      'info'
    )
  }, [config, pushEvent, exitHazardStats])

  const startSimulation = useCallback(() => {
    if (!selectedExit || !config) return
    invalidateActiveRun()
    clearSimulationTimers()
    const runToken = runTokenRef.current

    setPhase('running')
    phase2Ref.current = 'running'
    setEvents([])
    setActiveBlockedExits(new Set())

    const primaryPath     = buildFullPath(config, selectedRoom, selectedExit, selectedVias)
    const isBlocked       = potentialBlockedExits.has(selectedExit)
    const SPEED           = 80
    const blockT          = exitHazardStats.blockTByExit.get(selectedExit)
    const blockProgress   = isBlocked && blockT !== undefined ? blockT : 1
    const primaryDuration = computeTravelTimeMs(primaryPath, SPEED, smokeHazards, blockProgress)

    let hasRerouted = false
    const TICK = 50
    let elapsed = 0
    setElapsedSec(0)

    pushEvent(`Evacuation started \u2014 heading to ${selectedExit}`, 'info')
    if (isBlocked) {
      const blockingHazard = hardHazards.find((hazard) => pathIntersectsHazards(primaryPath, [hazard]))
      const label = blockingHazard?.type === 'debris' ? 'Debris' : 'Fire'
      pushEvent(`${label} detected ahead`, 'warn')
    }

    animRef.current = setInterval(() => {
      if (runTokenRef.current !== runToken) return

      elapsed += TICK
      setElapsedSec(Math.floor(elapsed / 1000))

      if (phase2Ref.current !== 'running') return

      const progress = primaryDuration > 0 ? elapsed / primaryDuration : 1
      const t = Math.min(progress, isBlocked ? blockProgress : 1)
      setAgentPos(interpolatePath(primaryPath, t))

      if (isBlocked && t >= blockProgress && !hasRerouted) {
        hasRerouted = true
        const rerouteStart = interpolatePath(primaryPath, t)
        setActiveBlockedExits(prev => {
          const next = new Set(prev)
          next.add(selectedExit)
          return next
        })
        setPhase('rerouting')
        phase2Ref.current = 'rerouting'

        const reroute = config.reroutes[selectedExit]
        pushEvent(`Route to ${selectedExit} is BLOCKED \u2014 rerouting to ${reroute.to}`, 'danger')

        rerouteTimeoutRef.current = setTimeout(() => {
          rerouteTimeoutRef.current = null
          if (runTokenRef.current !== runToken) return

          const reroutePath = buildNodeOnlyReroutePath(config, rerouteStart, reroute.to)
          const rerouteDur   = computeTravelTimeMs(reroutePath, SPEED, smokeHazards)
          let rerouteElapsed = 0

          pushEvent(`Now heading to ${reroute.to}`, 'info')
          setPhase('running')
          phase2Ref.current = 'running'

          if (animRef.current) {
            clearInterval(animRef.current)
            animRef.current = null
          }
          animRef.current = setInterval(() => {
            if (runTokenRef.current !== runToken) return

            rerouteElapsed += TICK
            elapsed += TICK
            setElapsedSec(Math.floor(elapsed / 1000))

            const rt = Math.min(rerouteElapsed / rerouteDur, 1)
            setAgentPos(interpolatePath(reroutePath, rt))

            if (rt >= 1) {
              clearSimulationTimers()
              finishSimulation(selectedExit, reroute.to, true, elapsed / 1000)
            }
          }, TICK)
        }, 1800)
      }

      if (!isBlocked && t >= 1) {
        clearSimulationTimers()
        finishSimulation(selectedExit, selectedExit, false, elapsed / 1000)
      }
    }, TICK)
  }, [selectedExit, config, invalidateActiveRun, clearSimulationTimers, selectedRoom, selectedVias, potentialBlockedExits, pushEvent, finishSimulation, exitHazardStats, smokeHazards, hardHazards])

  const reset = () => {
    invalidateActiveRun()
    clearSimulationTimers()
    setPhase('planning')
    phase2Ref.current = 'planning'
    setSelectedExit(null)
    setRouteMode(null)
    if (config) {
      if (selectedRoom && config.rooms[selectedRoom]) {
        const room = config.rooms[selectedRoom]
        setAgentPos({ x: room.x, y: room.y })
      } else {
        setAgentPos(config.startPos)
      }
    }
    setMetrics(null)
    setEvents([])
    setElapsedSec(0)
    setActiveBlockedExits(new Set())
  }

  // Undo last planning action: removes last via, or clears manual exit/routeMode if none
  const undoLast = () => {
    if (selectedVias.length > 0) {
      setSelectedVias(prev => prev.slice(0, -1))
      setRouteMode(null)
      setSelectedExit(null)
      return
    }
    if (selectedExit && routeMode === null) {
      setSelectedExit(null)
      return
    }
    if (routeMode) {
      setRouteMode(null)
      setSelectedExit(null)
      return
    }
  }

  // Reset planning selections but keep chosen room (helps iterate on routes quickly)
  const resetPlan = () => {
    setSelectedVias([])
    setSelectedExit(null)
    setRouteMode(null)
    setMetrics(null)
    setEvents([])
    setElapsedSec(0)
    setActiveBlockedExits(new Set())
    if (config) {
      if (selectedRoom && config.rooms[selectedRoom]) {
        const room = config.rooms[selectedRoom]
        setAgentPos({ x: room.x, y: room.y })
      } else {
        setAgentPos({ x: 0, y: 0 })
      }
    }
  }

  const selectRoom = (roomKey: string) => {
    setSelectedRoom(roomKey)
    setSelectedExit(null)
    setRouteMode(null)
    setSelectedVias([])
  }

  const switchFloor = (idx: number) => {
    if (idx === activeFloorIdx) return
    reset()
    setSelectedRoom(null)
    setSelectedVias([])
    setFloorIdx(idx)
  }

  if (isLoading || isFloorConfigLoading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>{isLoading ? 'Loading...' : 'Loading floor configuration...'}</div>
    </div>
  )

  const displayName = regionId.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

  if (!hasFloors) return (
    <div style={{ minHeight: '100vh', padding: '88px 40px 56px', maxWidth: '1280px', margin: '0 auto' }}>
      <button onClick={() => router.push(`/simulate/${encodeURIComponent(regionId)}/disaster`)}
        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer', padding: 0, marginBottom: '28px' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
        Change disaster type
      </button>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '400px', gap: '16px', background: '#f8fafc', borderRadius: '16px', border: '1px solid #c9dae6', padding: '18px', boxShadow: '0 1px 0 rgba(0,0,0,0.02), 0 6px 18px rgba(15,23,42,0.04)' }}>
        <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>{displayName}</div>
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{floorConfigLoadError || 'Floor plan for this building is coming soon.'}</div>
      </div>
    </div>
  )

  // Feedback
  const feedbackLines: string[] = []
  if (metrics) {
    if (metrics.rerouted) {
      feedbackLines.push(`You chose ${metrics.exitChoice} but it was blocked by ${disaster === 'fire' ? 'fire/smoke' : 'debris'}.`)
      feedbackLines.push(`The simulation rerouted you to ${metrics.reroutedTo}, adding significant delay.`)
    } else if (metrics.exitChoice.startsWith('S')) {
      feedbackLines.push(`You chose stairwell ${metrics.exitChoice} \u2014 the route was clear.`)
    } else {
      feedbackLines.push(`You chose exit ${metrics.exitChoice} \u2014 a direct route for this scenario.`)
    }
    if (metrics.hazardExposure) feedbackLines.push('Your initial route passed through a hazard zone \u2014 awareness of obstacle positions is critical.')
    if (metrics.pathEfficiency >= 0.9) feedbackLines.push('Route efficiency: Excellent. You took near-optimal path given conditions.')
    else if (metrics.pathEfficiency >= 0.7) feedbackLines.push('Route efficiency: Good. A better exit choice could reduce your time by ~20%.')
    else feedbackLines.push('Route efficiency: Poor. Review the floor plan and obstacle positions before the next drill.')
  }

  const congestionColor = (level: SimMetrics['congestionLevel']) =>
    level === 'High' ? '#ef4444' : level === 'Medium' ? '#f59e0b' : '#22c55e'

  const formatEventTime = (time: number) =>
    new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })

  const canBackOneNode = selectedVias.length > 0

  return (
    <div style={{ minHeight: '100vh', padding: '80px 32px 48px', maxWidth: '1600px', margin: '0 auto', background: 'linear-gradient(180deg, #f6fbff 0%, #f7fafc 44%, #eef4f8 100%)', borderRadius: '20px' }}>

      <button
        onClick={() => router.push(`/simulate/${encodeURIComponent(regionId)}/disaster`)}
        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer', padding: 0, marginBottom: '24px', transition: 'color 0.15s' }}
        onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
        Change disaster type
      </button>

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: `${meta.color}12`, border: `1px solid ${meta.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={meta.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {disaster === 'fire'
              ? <><path d="M12 2c.5 2.5 2 4.5 2 7a4 4 0 1 1-8 0c0-2.5 2-4.5 2-7 1.5 1.5 2.5 3 4 0z" /><path d="M12 12c.5 1 1 2 1 3a2 2 0 1 1-4 0c0-1 .5-2 1-3 .5.5 1 1 2 0z" /></>
              : <path d="M2 12h4l2-5 3 10 3-10 2 5h4" />}
          </svg>
        </div>
        <div>
          <h1 style={{ margin: '0 0 3px', fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{meta.label}</h1>
          <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>
            {displayName} {'\u00B7'} {config?.floorLabel}
          </p>
        </div>

        {/* Floor picker */}
        {floors.length > 1 && (
          <div
            onMouseEnter={e => {
              if (phase !== 'planning') return
              e.currentTarget.style.background = `${meta.color}12`
              e.currentTarget.style.borderColor = `${meta.color}55`
            }}
            onMouseLeave={e => {
              if (phase !== 'planning') return
              e.currentTarget.style.background = `${meta.color}08`
              e.currentTarget.style.borderColor = `${meta.color}33`
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '12px', background: `${meta.color}08`, borderRadius: '12px', padding: '6px 10px', border: `1px solid ${meta.color}33`, boxShadow: '0 1px 0 rgba(0,0,0,0.02)', transition: 'all 0.15s' }}>
            <label htmlFor="floor-select" style={{ fontSize: '10px', fontWeight: 700, color: meta.color, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Floor</label>
            <select
              id="floor-select"
              value={activeFloorIdx}
              onChange={e => switchFloor(Number(e.target.value))}
              onFocus={e => {
                e.currentTarget.style.borderColor = meta.color
                e.currentTarget.style.boxShadow = `0 0 0 3px ${meta.color}22`
                e.currentTarget.style.background = `${meta.color}06`
              }}
              onBlur={e => {
                e.currentTarget.style.borderColor = `${meta.color}55`
                e.currentTarget.style.boxShadow = 'none'
                e.currentTarget.style.background = '#ffffff'
              }}
              onMouseEnter={e => {
                if (phase !== 'planning') return
                e.currentTarget.style.borderColor = meta.color
                e.currentTarget.style.background = `${meta.color}06`
              }}
              onMouseLeave={e => {
                if (phase !== 'planning') return
                e.currentTarget.style.borderColor = `${meta.color}55`
                e.currentTarget.style.background = '#ffffff'
              }}
              disabled={phase !== 'planning'}
              style={{
                padding: '6px 26px 6px 10px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 700,
                border: `1.5px solid ${meta.color}55`, background: '#ffffff', color: '#0f172a',
                letterSpacing: '0.01em',
                cursor: phase !== 'planning' ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s',
                opacity: phase !== 'planning' ? 0.6 : 1,
              }}>
              {floors.map((f, i) => (
                <option key={i} value={i}>{f.floorLabel}</option>
              ))}
            </select>
          </div>
        )}

        <div style={{ marginLeft: 'auto', padding: '5px 14px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', background: phase === 'planning' ? '#2db8b015' : phase === 'completed' ? '#22c55e15' : `${meta.color}15`, color: phase === 'planning' ? '#2db8b0' : phase === 'completed' ? '#22c55e' : meta.color, border: `1px solid ${phase === 'planning' ? '#2db8b030' : phase === 'completed' ? '#22c55e30' : `${meta.color}30`}` }}>
          {phase === 'planning' ? 'Planning' : phase === 'rerouting' ? 'Rerouting\u2026' : phase === 'running' ? `Running \u00B7 ${elapsedSec}s` : 'Completed'}
        </div>
      </div>

      {/* Main layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '28px', alignItems: 'start' }}>

        <div style={{ background: 'linear-gradient(180deg, #ffffff 0%, #f8fbfd 100%)', borderRadius: '14px', border: '1px solid #dbe7ee', overflow: 'hidden', aspectRatio: `${config!.viewWidth}/${config!.viewHeight}`, boxShadow: '0 14px 30px rgba(15,23,42,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          <FloorPlanView
            buildingId={regionId} config={config!} disaster={disaster}
            obstacles={activeObstacles}
            selectedExit={selectedExit} selectedRoom={selectedRoom}
            selectedVias={selectedVias}
            agentPos={phase === 'planning' ? planningAgentPos : agentPos} phase={phase}
            blockedExits={blockedExits}
            onExitClick={key => phase === 'planning' && setSelectedExit(key)}
            onChooseNeighbor={label => phase === 'planning' && chooseNeighbor(label)}
            selectableNodeLabels={selectableNodeLabels}
            entryNodeLabel={entryNodeLabel}
            currentNodeLabel={currentNodeLabel}
            backNodeLabel={backNodeLabel}
          />

          <div style={{ position: 'absolute', top: '10px', left: '10px', display: 'flex', gap: '6px', flexWrap: 'wrap', pointerEvents: 'none' }}>
            <span style={{ background: '#ffffffdd', border: '1px solid #d8e4ec', borderRadius: '999px', padding: '4px 9px', fontSize: '10px', fontWeight: 700, color: '#0f172a' }}>Live Drill View</span>
            <span style={{ background: '#ffffffdd', border: '1px solid #d8e4ec', borderRadius: '999px', padding: '4px 9px', fontSize: '10px', fontWeight: 600, color: '#2db8b0' }}>Selected Route</span>
            <span style={{ background: '#ffffffdd', border: '1px solid #d8e4ec', borderRadius: '999px', padding: '4px 9px', fontSize: '10px', fontWeight: 600, color: '#ef4444' }}>Blocked Path</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {phase === 'planning' && config && (
            <>
              <div style={{ background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)', border: '1px solid #c9dae6', borderRadius: '12px', padding: '14px', boxShadow: '0 1px 0 rgba(0,0,0,0.02)' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Simulation Brief</div>
                <div style={{ fontSize: '12px', color: '#334155', lineHeight: 1.55 }}>
                  Start from your room, click corridor nodes to build your route step by step, then choose an exit and launch the drill.
                </div>
              </div>

              {/* Step 1: Room Selection */}
              <div style={{ background: '#f8fafc', border: '1px solid #c9dae6', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 0 rgba(0,0,0,0.02)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: selectedRoom ? '#2db8b0' : '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: selectedRoom ? '#fff' : '#475569', flexShrink: 0 }}>1</div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>Where Are You?</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                  {currentFloorRooms.length === 0 && (
                    <div style={{ gridColumn: '1 / -1', fontSize: '11px', color: '#64748b', padding: '8px 10px', background: '#f1f5f9', border: '1px dashed #c9dae6', borderRadius: '8px' }}>
                      No room options are configured for this floor yet.
                    </div>
                  )}
                  {currentFloorRooms.map(([key, room]) => (
                    <button key={key} onClick={() => selectRoom(key)}
                      style={{
                        padding: '8px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 600,
                        background: selectedRoom === key ? '#2db8b015' : '#f1f5f9',
                        border: `1.5px solid ${selectedRoom === key ? '#2db8b0' : '#c9dae6'}`,
                        color: selectedRoom === key ? '#2db8b0' : '#0f172a',
                        cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                      }}>
                      {room.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Step 2: Route Strategy */}
              {selectedRoom && (
                <div style={{ background: '#f8fafc', border: '1px solid #c9dae6', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 0 rgba(0,0,0,0.02)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                    <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: routeMode ? '#2db8b0' : '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: routeMode ? '#fff' : '#64748b', flexShrink: 0 }}>2</div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>Choose Route</div>
                  </div>
                  <div style={{ background: '#ffffff', border: '1px solid #dbe7ee', borderRadius: '9px', padding: '10px 12px', marginBottom: '10px' }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Corridor Node State</div>
                    <div style={{ fontSize: '11px', color: '#334155', marginBottom: '6px', lineHeight: 1.45 }}>
                      Start: {entryNodeLabel || 'N/A'} {'\u00B7'} Current: {currentNodeLabel || 'N/A'}
                    </div>
                    <div style={{ fontSize: '10.5px', color: '#64748b', marginBottom: '6px', lineHeight: 1.45 }}>
                      Click highlighted corridor nodes directly on the map to build your route in sequence.
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => {
                          if (backNodeLabel) chooseNeighbor(backNodeLabel)
                        }}
                        disabled={!canBackOneNode || !backNodeLabel}
                        style={{
                          padding: '6px 10px', borderRadius: '7px', fontSize: '11px', fontWeight: 700,
                          background: canBackOneNode ? '#fff7ed' : '#f1f5f9',
                          border: `1px solid ${canBackOneNode ? '#fdba74' : '#cbd5e1'}`,
                          color: canBackOneNode ? '#c2410c' : '#94a3b8',
                          cursor: canBackOneNode ? 'pointer' : 'not-allowed',
                        }}>
                        Back One Node
                      </button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {/* Safest Route */}
                    <button
                      onClick={() => { setRouteMode('safest'); setSelectedExit(safestExit) }}
                      disabled={!safestExit}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '12px',
                        padding: '12px 14px', borderRadius: '10px',
                        background: routeMode === 'safest' ? '#22c55e10' : '#f1f5f9',
                        border: `1.5px solid ${routeMode === 'safest' ? '#22c55e' : '#c9dae6'}`,
                        cursor: safestExit ? 'pointer' : 'not-allowed', textAlign: 'left', transition: 'all 0.15s', opacity: safestExit ? 1 : 0.55,
                      }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#22c55e15', border: '1px solid #22c55e30', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                        </svg>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '2px' }}>Safest Route</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                          Exit {safestExit} {'\u00B7'} {safestRoute ? `~${safestRoute.estimatedTime}s` : ''} {'\u00B7'} Avoids hazards
                        </div>
                      </div>
                      {routeMode === 'safest' && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                    </button>

                    {/* Fastest Route */}
                    <button
                      onClick={() => { setRouteMode('fastest'); setSelectedExit(fastestExit) }}
                      disabled={!fastestExit}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '12px',
                        padding: '12px 14px', borderRadius: '10px',
                        background: routeMode === 'fastest' ? '#3b82f610' : '#f1f5f9',
                        border: `1.5px solid ${routeMode === 'fastest' ? '#3b82f6' : '#c9dae6'}`,
                        cursor: fastestExit ? 'pointer' : 'not-allowed', textAlign: 'left', transition: 'all 0.15s', opacity: fastestExit ? 1 : 0.55,
                      }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#3b82f615', border: '1px solid #3b82f630', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                        </svg>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '2px' }}>Fastest Route</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                          Exit {fastestExit} {'\u00B7'} {fastestRoute ? `~${fastestRoute.estimatedTime}s` : ''} {'\u00B7'} Shortest path
                          {fastestRoute?.mayBlock ? ' \u00B7 May be blocked' : ''}
                        </div>
                      </div>
                      {routeMode === 'fastest' && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                    </button>

                    {/* Manual exit selection */}
                    <div style={{ marginTop: '4px' }}>
                      <div style={{ fontSize: '10px', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Or choose exit manually</div>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {Object.keys(config.exits).map(key => {
                          const blocked = blockedExits.has(key)
                          const mayBlock = potentialBlockedExits.has(key)
                          const selected = selectedExit === key && routeMode === null
                          const reachableFromNode = reachableExitKeys.has(key)
                          const color = blocked ? '#ef4444' : mayBlock ? '#f59e0b' : '#64748b'
                          return (
                            <button key={key} onClick={() => { setRouteMode(null); setSelectedExit(key) }} disabled={!reachableFromNode}
                              style={{
                                padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 600,
                                background: selected ? `${color}15` : reachableFromNode ? '#f1f5f9' : '#f8fafc',
                                border: `1.5px solid ${selected ? color : reachableFromNode ? '#c9dae6' : '#e2e8f0'}`,
                                color: selected ? (blocked ? '#ef4444' : 'var(--text-primary)') : reachableFromNode ? '#0f172a' : '#94a3b8',
                                cursor: reachableFromNode ? 'pointer' : 'not-allowed', transition: 'all 0.15s',
                              }}>
                              {key} {'\u00B7'} {config.exits[key].desc.split('\u00B7')[0].trim()}
                              {!reachableFromNode ? ' (unreachable)' : blocked ? ' (blocked)' : mayBlock ? ' (risk)' : ''}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Disaster Alert */}
              <div style={{ background: `${meta.color}08`, border: `1px solid ${meta.color}20`, borderRadius: '10px', padding: '12px 14px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: meta.color, marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {disaster === 'fire' ? 'Active Fire' : 'Earthquake Alert'}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                  {disaster === 'fire'
                    ? 'Fire detected in the building. Smoke may be spreading \u2014 exits near the fire source may be hazardous.'
                    : 'Structural damage reported. Debris may block corridors and stairwells. Assess your exit options carefully.'}
                </div>
              </div>

              {/* Start button */}
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '8px', flex: 1 }}>
                  <button onClick={undoLast} disabled={selectedVias.length === 0 && !selectedExit && !routeMode}
                    style={{ padding: '10px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, background: selectedVias.length === 0 && !selectedExit && !routeMode ? '#f1f5f9' : '#ffffff', border: '1px solid #c9dae6', color: selectedVias.length === 0 && !selectedExit && !routeMode ? '#94a3b8' : '#0f172a', cursor: selectedVias.length === 0 && !selectedExit && !routeMode ? 'not-allowed' : 'pointer' }}>
                    Undo
                  </button>
                  <button onClick={resetPlan}
                    style={{ padding: '10px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, background: '#ffffff', border: '1px solid #c9dae6', color: '#0f172a', cursor: 'pointer' }}>
                    Reset Plan
                  </button>
                </div>
                <div style={{ flex: '0 0 auto' }}>
                  <button onClick={startSimulation} disabled={!selectedExit || !selectedRoom}
                    style={{
                      padding: '13px', borderRadius: '10px', fontSize: '13px', fontWeight: 700,
                      background: selectedExit && selectedRoom ? '#2db8b0' : '#f1f5f9',
                      color: selectedExit && selectedRoom ? '#fff' : '#94a3b8',
                      border: selectedExit && selectedRoom ? 'none' : '1px solid #c9dae6', cursor: selectedExit && selectedRoom ? 'pointer' : 'not-allowed', transition: 'all 0.15s',
                      boxShadow: selectedExit && selectedRoom ? '0 4px 16px rgba(45,184,176,0.3)' : 'none',
                    }}>
                    {!selectedRoom ? 'Select your location first' : !selectedExit ? 'Choose a route' : `Start Simulation \u2192 ${selectedExit}`}
                  </button>
                </div>
              </div>
            </>
          )}

          {(phase === 'running' || phase === 'rerouting') && (
            <>
              <div style={{ background: '#f8fafc', border: '1px solid #c9dae6', borderRadius: '12px', padding: '18px', boxShadow: '0 1px 0 rgba(0,0,0,0.02)' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '14px' }}>Live Metrics</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  {[
                    { label: 'Elapsed', value: `${elapsedSec}s`, accent: '#3b82f6' },
                    { label: 'Target', value: selectedExit ?? '\u2014', accent: '#8b5cf6' },
                    { label: 'Status', value: phase === 'rerouting' ? 'Rerouting' : 'Moving', color: phase === 'rerouting' ? '#f59e0b' : '#2db8b0', accent: phase === 'rerouting' ? '#f59e0b' : '#2db8b0' },
                    { label: 'Floor', value: config?.floorLabel || '1F', accent: meta.color },
                  ].map(m => (
                    <div key={m.label} style={{ background: `${(m as { accent?: string }).accent ?? '#ffffff'}08`, border: `1px solid ${((m as { accent?: string }).accent ?? '#e6edf2')}35`, borderRadius: '8px', padding: '10px 12px' }}>
                      <div style={{ fontSize: '10px', color: (m as { accent?: string }).accent ?? 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{m.label}</div>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: (m as { color?: string }).color ?? 'var(--text-primary)' }}>{m.value}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ background: '#f8fafc', border: '1px solid #c9dae6', borderRadius: '12px', padding: '14px', maxHeight: '180px', overflowY: 'auto', boxShadow: '0 1px 0 rgba(0,0,0,0.02)' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Event Log</div>
                {events.length === 0 && <div style={{ fontSize: '12px', color: '#334155' }}>No events yet{'\u2026'}</div>}
                {events.map((ev, i) => (
                  <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'flex-start', padding: '7px 8px', background: '#ffffff', border: '1px solid #e6edf2', borderRadius: '8px' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', marginTop: '6px', flexShrink: 0, background: ev.type === 'danger' ? '#ef4444' : ev.type === 'warn' ? '#f59e0b' : '#2db8b0' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '2px' }}>{formatEventTime(ev.time)}</div>
                      <div style={{ fontSize: '11px', color: ev.type === 'danger' ? '#ef4444' : ev.type === 'warn' ? '#b45309' : 'var(--text-secondary)', lineHeight: 1.4 }}>{ev.message}</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {phase === 'completed' && metrics && (
            <>
              {/* Result Summary */}
              <div style={{ background: '#f8fafc', border: '1px solid #c9dae6', borderRadius: '12px', padding: '18px', boxShadow: '0 1px 0 rgba(0,0,0,0.02)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#22c55e18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  </div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#22c55e' }}>Drill Complete</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      {selectedRoom && config?.rooms[selectedRoom] ? `From ${config.rooms[selectedRoom].label}` : 'Evacuation finished'}
                    </div>
                  </div>
                </div>

                {/* Key metric */}
                <div style={{ background: '#ffffff', border: '1px solid #e6edf2', borderRadius: '10px', padding: '14px', marginBottom: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '32px', fontWeight: 800, color: metrics.evacuationTime > 20 ? '#ef4444' : '#22c55e', lineHeight: 1 }}>{metrics.evacuationTime}s</div>
                  <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Evacuation Time</div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                  {[
                    { label: 'Exit', value: metrics.actualExit, color: '#2db8b0' },
                    { label: 'Rerouted', value: metrics.rerouted ? 'Yes' : 'No', color: metrics.rerouted ? '#f59e0b' : '#22c55e' },
                    { label: 'Efficiency', value: `${Math.round(metrics.pathEfficiency * 100)}%`, color: metrics.pathEfficiency >= 0.85 ? '#22c55e' : '#f59e0b' },
                  ].map(m => (
                    <div key={m.label} style={{ background: '#ffffff', border: '1px solid #e6edf2', borderRadius: '8px', padding: '8px 10px', textAlign: 'center' }}>
                      <div style={{ fontSize: '9px', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '3px' }}>{m.label}</div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: m.color }}>{m.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Detailed metrics */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                <div style={{ background: `${congestionColor(metrics.congestionLevel)}12`, border: `1px solid ${congestionColor(metrics.congestionLevel)}35`, borderRadius: '8px', padding: '10px 12px', boxShadow: '0 1px 0 rgba(0,0,0,0.02)' }}>
                  <div style={{ fontSize: '9px', color: congestionColor(metrics.congestionLevel), textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '3px' }}>Congestion</div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: congestionColor(metrics.congestionLevel) }}>{metrics.congestionLevel}</div>
                </div>
                <div style={{ background: `${metrics.hazardExposure ? '#ef4444' : '#22c55e'}12`, border: `1px solid ${metrics.hazardExposure ? '#ef4444' : '#22c55e'}35`, borderRadius: '8px', padding: '10px 12px', boxShadow: '0 1px 0 rgba(0,0,0,0.02)' }}>
                  <div style={{ fontSize: '9px', color: metrics.hazardExposure ? '#ef4444' : '#22c55e', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '3px' }}>Hazard Exposure</div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: metrics.hazardExposure ? '#ef4444' : '#22c55e' }}>{metrics.hazardExposure ? 'Exposed' : 'None'}</div>
                </div>
              </div>

              {/* Evaluator */}
              <div style={{ background: '#f8fafc', border: '1px solid #e6edf2', borderRadius: '10px', padding: '14px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Drill Evaluator</div>
                {feedbackLines.map((line, i) => (
                  <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '6px', alignItems: 'flex-start' }}>
                    <div style={{ width: '5px', height: '5px', borderRadius: '50%', marginTop: '5px', flexShrink: 0, background: '#2db8b0' }} />
                    <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{line}</div>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <button onClick={reset}
                  style={{ padding: '11px', borderRadius: '10px', fontSize: '12px', fontWeight: 600, background: '#f8fafc', border: '1px solid #e6edf2', color: 'var(--text-primary)', cursor: 'pointer', transition: 'all 0.15s' }}>
                  Run Again
                </button>
                <button onClick={() => router.push('/map')}
                  style={{ padding: '11px', borderRadius: '10px', fontSize: '12px', fontWeight: 600, background: '#2db8b0', border: 'none', color: '#fff', cursor: 'pointer', transition: 'all 0.15s', boxShadow: '0 2px 12px rgba(45,184,176,0.3)' }}>
                  Back to Map
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
