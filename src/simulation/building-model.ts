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
  /** Structurally fragile — eligible for earthquake collapse rolls. When an
   *  earthquake run rolls this edge as collapsed, a debris hazard is spawned
   *  at its midpoint. Authored via `fragile` on a corridor neighbor, or
   *  auto-derived for any edge touching a `stairs` node. */
  fragile?: boolean
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

/** Get edge key for lookups */
export function edgeKey(from: string, to: string): string {
  return from < to ? `${from}-${to}` : `${to}-${from}`
}

/**
 * Dijkstra with soft-block + threat-zone support. Hard-blocked edges are
 * skipped entirely; soft-blocked edges (smoke) stay traversable but cost
 * `softPenalty`x; threatened edges (just outside a growing hard hazard's
 * radius) cost `threatPenalty`x so agents proactively route around fire that
 * is about to swallow their next corridor — without being unreachable when
 * the threat is the only way out.
 */
export interface WeightedPathOptions {
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
  /** Edges in the threat zone of an active hard hazard — within
   *  `currentRadius + buffer` but not yet inside the radius. Treated as
   *  very high cost so agents prefer a clean detour, but still traversable
   *  if no alternative exists. */
  threatenedEdges?: Set<string>
  /** Cost multiplier applied to threatened edges. Should be ≥ softPenalty
   *  since walking next to fire is worse than walking through smoke. */
  threatPenalty?: number
  /** Exits the search must avoid returning. Used by proximity-driven reroutes
   *  so an agent that just barely escaped a fire hazard does not pick the
   *  same exit again on the very next replan. */
  excludeExitIds?: Set<string>
  /** Nodes the search must NOT route through (except as the start node).
   *  Used by proximity-driven reroutes to forbid the agent's new path from
   *  passing through the danger zone of any active fire — so they never
   *  "go backward" through the flames to reach another exit. */
  forbiddenNodeIds?: Set<string>
}

export function findShortestPathToExitWeighted(
  floor: FloorModel,
  startId: string,
  blockedEdges: Set<string>,
  softBlockedEdges: Set<string>,
  softPenalty = 3.5,
  options: WeightedPathOptions = {},
): { path: string[]; distance: number; exitId: string; walksThroughSmoke: boolean } | null {
  const { edgeCounts, congestionWeight = 0, jitter = 1, exitBias, threatenedEdges, threatPenalty = 1, excludeExitIds, forbiddenNodeIds } = options
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
    // Skip exits that the caller explicitly banned (e.g. the exit the agent
    // was originally heading toward, which now sits dangerously close to a
    // fire). The search continues looking for any other reachable exit.
    if (currentNode?.type === 'exit' && excludeExitIds?.has(current)) {
      // Don't return — keep expanding so we can find another exit.
    } else if (currentNode?.type === 'exit') {
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

    for (const { node: neighbor, edge } of getNeighbors(floor, current)) {
      const key = edgeKey(edge.from, edge.to)
      if (blockedEdges.has(key)) continue
      // Forbid routing through danger-zone nodes. The start node itself may be
      // inside the zone (agent needs to escape outward), but any subsequent
      // hop into the zone is banned — that's what kept causing "go backward
      // through the fire" reroutes.
      if (forbiddenNodeIds?.has(neighbor.id) && neighbor.id !== startId) continue

      let cost = edge.distance * (softBlockedEdges.has(key) ? softPenalty : 1)
      if (threatenedEdges?.has(key) && threatPenalty > 1) {
        cost *= threatPenalty
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
