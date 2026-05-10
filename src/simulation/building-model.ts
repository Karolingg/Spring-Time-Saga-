/**
 * EVACSIM — Building Model & Navigation Graph
 *
 * Defines rooms, corridors, exits, hazard zones, and a navigation graph
 * used by the autonomous simulation. The concrete BuildingModel objects
 * are derived from per-floor FloorConfigs via `floor-config/to-floor-model.ts`.
 *
 * Coordinate system: matches each floor's SVG viewBox.
 */

/* ── Core types ── */

export interface NavNode {
  id: string
  label: string
  x: number
  y: number
  type: 'room' | 'corridor' | 'exit' | 'stairs' | 'junction'
  /** More specific authored waypoint role, when available. */
  kind?: 'room' | 'corridor' | 'junction' | 'door' | 'corner' | 'stairs' | 'exit'
  /** Capacity in number of people */
  capacity: number
  /** Room bounding box for rendering overlays (optional) */
  bounds?: { x: number; y: number; w: number; h: number }
}

export interface NavEdge {
  from: string
  to: string
  /** Distance in meters (approx) */
  distance: number
  /** Width of passage in meters — affects congestion */
  width: number
  /** Can this edge be blocked by hazards? */
  blockable: boolean
}

export interface HazardZone {
  id: string
  type: 'fire' | 'smoke' | 'debris' | 'blocked'
  /** Center position */
  x: number
  y: number
  /** Initial radius */
  radius: number
  /** Growth rate per second */
  growthRate: number
  /** Appears after this many seconds */
  appearsAt: number
  /** Cap on how large the zone may grow (pixels). Keeps hazards from
   *  visually swallowing the floorplan during long runs. */
  maxRadius?: number
}

export interface FloorModel {
  id: string
  label: string
  floorplanSrc: string
  nodes: NavNode[]
  edges: NavEdge[]
  /** Hazard templates per disaster type */
  hazards: Record<string, HazardZone[]>
}

export interface BuildingModel {
  id: string
  name: string
  floors: FloorModel[]
}

/* ── Building registry (adapter-driven) ── */

import { buildBuildingModel } from './floor-config/to-floor-model'

const BUILDING_CACHE = new Map<string, BuildingModel>()

export function getBuildingById(id: string): BuildingModel | undefined {
  const cached = BUILDING_CACHE.get(id)
  if (cached) return cached
  const model = buildBuildingModel(id)
  if (!model) return undefined
  BUILDING_CACHE.set(id, model)
  return model
}

/* ── Graph utilities ── */

export function getNode(floor: FloorModel, id: string): NavNode | undefined {
  return floor.nodes.find(n => n.id === id)
}

export function getNeighbors(floor: FloorModel, nodeId: string): { node: NavNode; edge: NavEdge }[] {
  const results: { node: NavNode; edge: NavEdge }[] = []
  for (const edge of floor.edges) {
    let neighborId: string | null = null
    if (edge.from === nodeId) neighborId = edge.to
    else if (edge.to === nodeId) neighborId = edge.from
    if (neighborId) {
      const node = getNode(floor, neighborId)
      if (node) results.push({ node, edge })
    }
  }
  return results
}

export function getExits(floor: FloorModel): NavNode[] {
  return floor.nodes.filter(n => n.type === 'exit')
}

export function getRooms(floor: FloorModel): NavNode[] {
  return floor.nodes.filter(n => n.type === 'room')
}

/** Dijkstra shortest path from a node to the nearest exit */
export function findShortestPathToExit(
  floor: FloorModel,
  startId: string,
  blockedEdges: Set<string> = new Set(),
): { path: string[]; distance: number; exitId: string } | null {
  const exits = getExits(floor)
  if (exits.length === 0) return null

  const dist: Record<string, number> = {}
  const prev: Record<string, string | null> = {}
  const visited = new Set<string>()

  for (const n of floor.nodes) {
    dist[n.id] = Infinity
    prev[n.id] = null
  }
  dist[startId] = 0

  while (true) {
    let current: string | null = null
    let minDist = Infinity
    for (const n of floor.nodes) {
      if (!visited.has(n.id) && dist[n.id] < minDist) {
        minDist = dist[n.id]
        current = n.id
      }
    }
    if (current === null) break
    visited.add(current)

    const currentNode = getNode(floor, current)
    if (currentNode?.type === 'exit') {
      const path: string[] = []
      let c: string | null = current
      while (c) {
        path.unshift(c)
        c = prev[c]
      }
      return { path, distance: dist[current], exitId: current }
    }

    for (const { node: neighbor, edge } of getNeighbors(floor, current)) {
      const edgeKey = `${edge.from}-${edge.to}`
      const edgeKeyR = `${edge.to}-${edge.from}`
      if (blockedEdges.has(edgeKey) || blockedEdges.has(edgeKeyR)) continue

      const alt = dist[current] + edge.distance
      if (alt < dist[neighbor.id]) {
        dist[neighbor.id] = alt
        prev[neighbor.id] = current
      }
    }
  }

  return null
}

/** Get edge key for lookups */
export function edgeKey(from: string, to: string): string {
  return from < to ? `${from}-${to}` : `${to}-${from}`
}

/**
 * Dijkstra that supports soft-blocked edges. Hard-blocked edges are skipped
 * entirely (as in `findShortestPathToExit`); soft-blocked edges (smoke) stay
 * traversable but their distance is multiplied by `softPenalty` so the
 * algorithm prefers a cleaner detour when one exists. If the only route goes
 * through smoke, the agent still gets a path — they won't be trapped purely
 * because smoke spread across a corridor.
 */
export interface WeightedPathOptions {
  /** Nodes covered by hard hazards. They are excluded except for the start node,
   *  so an agent standing at the edge of a danger zone can still search for an
   *  escape route if an adjacent edge remains usable. */
  blockedNodes?: Set<string>
  /** Exit nodes currently covered by hard hazards. */
  blockedExits?: Set<string>
  /** 0-1 risk score per edge. Higher values make the path less attractive
   *  before it becomes fully blocked. */
  edgeRisk?: Record<string, number>
  /** 0-1 risk score per node. Used as an extra cost when stepping into a node. */
  nodeRisk?: Record<string, number>
  /** Meters of virtual detour added at risk=1. */
  riskWeight?: number
  /** Live edge occupancy (people currently on each edge, keyed by
   *  canonical edgeKey). Used to push new arrivals toward emptier routes. */
  edgeCounts?: Record<string, number>
  /** How many meters of extra cost each person on an edge adds. A value
   *  around 1.5 means a 10-person-deep crowd makes an edge feel ~15m longer,
   *  enough to tip ties but not enough to send agents into fire. */
  congestionWeight?: number
  /** Per-agent random multiplier (~0.85–1.15) applied to every edge cost.
   *  Breaks ties between equally-good routes so agents don't all queue up
   *  behind the single global shortest path. */
  jitter?: number
  /** Bias toward (or away from) specific exits. Keyed by exit node id;
   *  positive values make the exit "farther" (less preferred). Used to
   *  spread the crowd across multiple exits when the raw shortest path
   *  would funnel everyone into one. */
  exitBias?: Record<string, number>
}

export function findShortestPathToExitWeighted(
  floor: FloorModel,
  startId: string,
  blockedEdges: Set<string>,
  softBlockedEdges: Set<string>,
  softPenalty = 3.5,
  options: WeightedPathOptions = {},
): { path: string[]; distance: number; exitId: string; walksThroughSmoke: boolean } | null {
  const {
    blockedNodes,
    blockedExits,
    edgeRisk,
    nodeRisk,
    riskWeight = 0,
    edgeCounts,
    congestionWeight = 0,
    jitter = 1,
    exitBias,
  } = options
  const exits = getExits(floor)
  if (exits.length === 0) return null

  const dist: Record<string, number> = {}
  const prev: Record<string, string | null> = {}
  const visited = new Set<string>()

  for (const n of floor.nodes) {
    dist[n.id] = Infinity
    prev[n.id] = null
  }
  dist[startId] = 0

  while (true) {
    let current: string | null = null
    let minDist = Infinity
    for (const n of floor.nodes) {
      if (!visited.has(n.id) && dist[n.id] < minDist) {
        minDist = dist[n.id]
        current = n.id
      }
    }
    if (current === null) break
    visited.add(current)

    const currentNode = getNode(floor, current)
    if (currentNode?.type === 'exit' && !blockedExits?.has(current)) {
      const path: string[] = []
      let c: string | null = current
      while (c) {
        path.unshift(c)
        c = prev[c]
      }
      // Flag whether this route touches any smoky edge.
      let walksThroughSmoke = false
      for (let i = 0; i < path.length - 1; i++) {
        if (softBlockedEdges.has(edgeKey(path[i], path[i + 1]))) {
          walksThroughSmoke = true
          break
        }
      }
      return { path, distance: dist[current], exitId: current, walksThroughSmoke }
    }

    if (current !== startId && blockedNodes?.has(current)) continue

    for (const { node: neighbor, edge } of getNeighbors(floor, current)) {
      const key = edgeKey(edge.from, edge.to)
      if (blockedEdges.has(key)) continue
      if (neighbor.id !== startId && blockedNodes?.has(neighbor.id)) continue
      if (neighbor.type === 'exit' && blockedExits?.has(neighbor.id)) continue

      let cost = edge.distance * (softBlockedEdges.has(key) ? softPenalty : 1)
      if (edgeRisk && riskWeight > 0) {
        cost += (edgeRisk[key] ?? 0) * riskWeight
      }
      if (nodeRisk && riskWeight > 0) {
        cost += (nodeRisk[neighbor.id] ?? 0) * riskWeight * 0.5
      }
      if (edgeCounts && congestionWeight > 0) {
        cost += (edgeCounts[key] ?? 0) * congestionWeight
      }
      cost *= jitter
      // Apply exit bias when stepping onto the exit node itself.
      if (exitBias && neighbor.type === 'exit') {
        cost += exitBias[neighbor.id] ?? 0
      }
      const alt = dist[current] + cost
      if (alt < dist[neighbor.id]) {
        dist[neighbor.id] = alt
        prev[neighbor.id] = current
      }
    }
  }

  return null
}
