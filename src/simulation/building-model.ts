import { buildBuildingModel } from './floor-config/to-floor-model'

export interface NavNode {
  id: string
  label: string
  x: number
  y: number
  type: 'room' | 'corridor' | 'exit' | 'stairs' | 'junction'
  kind?: 'room' | 'corridor' | 'junction' | 'door' | 'corner' | 'stairs' | 'exit'
  capacity: number
  bounds?: { x: number; y: number; w: number; h: number }
}

export interface NavEdge {
  from: string
  to: string
  distance: number
  width: number
  blockable: boolean
  fragile?: boolean
}

export interface HazardZone {
  id: string
  type: 'fire' | 'smoke' | 'debris' | 'blocked'
  x: number
  y: number
  radius: number
  growthRate: number
  appearsAt: number
  maxRadius?: number
}

export interface FloorModel {
  id: string
  label: string
  floorplanSrc: string
  nodes: NavNode[]
  edges: NavEdge[]
  hazards: Record<string, HazardZone[]>
}

export interface BuildingModel {
  id: string
  name: string
  floors: FloorModel[]
}

const BUILDING_CACHE = new Map<string, BuildingModel>()

export function getBuildingById(id: string): BuildingModel | undefined {
  const cached = BUILDING_CACHE.get(id)
  if (cached) return cached
  const model = buildBuildingModel(id)
  if (!model) return undefined
  BUILDING_CACHE.set(id, model)
  return model
}

export function getNode(floor: FloorModel, id: string): NavNode | undefined {
  return floor.nodes.find(n => n.id === id)
}

function getNeighbors(floor: FloorModel, nodeId: string): { node: NavNode; edge: NavEdge }[] {
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

function getExits(floor: FloorModel): NavNode[] {
  return floor.nodes.filter(n => n.type === 'exit')
}

export function edgeKey(from: string, to: string): string {
  return from < to ? `${from}-${to}` : `${to}-${from}`
}

export interface HazardForecast {
  type: 'fire' | 'smoke' | 'debris' | 'blocked'
  x: number
  y: number
  radius: number
  growthRate: number
  maxRadius?: number
  appearsAt: number
  currentRadius: number
  active: boolean
}

export interface WeightedPathOptions {
  edgeCounts?: Record<string, number>
  congestionWeight?: number
  jitter?: number
  exitBias?: Record<string, number>
  threatenedEdges?: Set<string>
  threatPenalty?: number
  excludeExitIds?: Set<string>
  forbiddenNodeIds?: Set<string>
  hazards?: HazardForecast[]
  agentSpeed?: number
  elapsedTime?: number
  futureHazardPenalty?: number
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
    edgeCounts,
    congestionWeight = 0,
    jitter = 1,
    exitBias,
    threatenedEdges,
    threatPenalty = 1,
    excludeExitIds,
    forbiddenNodeIds,
    hazards,
    agentSpeed,
    elapsedTime,
    futureHazardPenalty = 6,
  } = options
  const exits = getExits(floor)
  if (exits.length === 0) return null
  const hazardForecastActive = !!(hazards && hazards.length > 0 && agentSpeed && agentSpeed > 0 && elapsedTime !== undefined)

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
    if (currentNode?.type === 'exit' && excludeExitIds?.has(current)) {
      // Banned exit — keep expanding to find another.
    } else if (currentNode?.type === 'exit') {
      const path: string[] = []
      let c: string | null = current
      while (c) {
        path.unshift(c)
        c = prev[c]
      }
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
      if (forbiddenNodeIds?.has(neighbor.id) && neighbor.id !== startId) continue

      let cost = edge.distance * (softBlockedEdges.has(key) ? softPenalty : 1)
      if (threatenedEdges?.has(key) && threatPenalty > 1) {
        cost *= threatPenalty
      }
      if (edgeCounts && congestionWeight > 0) {
        cost += (edgeCounts[key] ?? 0) * congestionWeight
      }
      if (hazardForecastActive) {
        const currentNodeForLookup = getNode(floor, current)
        if (currentNodeForLookup) {
          const midX = (currentNodeForLookup.x + neighbor.x) / 2
          const midY = (currentNodeForLookup.y + neighbor.y) / 2
          const timeToMidpoint = (elapsedTime as number) + (dist[current] + edge.distance / 2) / (agentSpeed as number)
          for (const h of hazards!) {
            if (h.type === 'smoke') continue
            if (timeToMidpoint < h.appearsAt) continue
            const grownPx = h.currentRadius + h.growthRate * Math.max(0, timeToMidpoint - Math.max(elapsedTime as number, h.appearsAt))
            const futureRadius = h.maxRadius !== undefined ? Math.min(grownPx, h.maxRadius) : grownPx
            const distToHazard = Math.hypot(midX - h.x, midY - h.y)
            if (distToHazard >= futureRadius * 1.3) continue
            if (distToHazard < futureRadius * 0.8) {
              cost *= futureHazardPenalty * 2
            } else if (distToHazard < futureRadius) {
              cost *= futureHazardPenalty
            } else {
              cost *= Math.max(2, futureHazardPenalty * 0.4)
            }
          }
        }
      }
      cost *= jitter
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
