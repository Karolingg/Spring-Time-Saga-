import type { FloorModel, HazardZone, NavEdge, NavNode } from './building-model'
import { edgeKey, getNode } from './building-model'

export interface RuntimeHazard {
  zone: HazardZone
  currentRadius: number
  active: boolean
}

export interface HazardImpact {
  blockedEdges: Set<string>
  softBlockedEdges: Set<string>
  blockedNodes: Set<string>
  blockedExits: Set<string>
  edgeRisk: Record<string, number>
  nodeRisk: Record<string, number>
}

interface HazardDistanceField {
  nearestEdgeKey: string | null
  nodeDistance: Record<string, number>
}

const SMOKE_SPREAD_MULTIPLIER = 1.35
const RISK_SPREAD_MULTIPLIER = 1.75

function pointToSegmentDistance(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): { distance: number; t: number } {
  const dx = bx - ax
  const dy = by - ay
  const lengthSq = dx * dx + dy * dy
  if (lengthSq === 0) {
    return { distance: Math.hypot(px - ax, py - ay), t: 0 }
  }
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq))
  const x = ax + dx * t
  const y = ay + dy * t
  return { distance: Math.hypot(px - x, py - y), t }
}

function edgePixelLength(floor: FloorModel, edge: NavEdge): number {
  const from = getNode(floor, edge.from)
  const to = getNode(floor, edge.to)
  if (!from || !to) return edge.distance
  return Math.max(1, Math.hypot(to.x - from.x, to.y - from.y))
}

function buildHazardDistanceField(floor: FloorModel, hazard: RuntimeHazard): HazardDistanceField {
  const dist: Record<string, number> = {}
  const visited = new Set<string>()
  let nearestEdge: { edge: NavEdge; distance: number; t: number; pixelLength: number } | null = null

  for (const node of floor.nodes) {
    dist[node.id] = Infinity
  }

  for (const edge of floor.edges) {
    const from = getNode(floor, edge.from)
    const to = getNode(floor, edge.to)
    if (!from || !to) continue

    const projected = pointToSegmentDistance(
      hazard.zone.x,
      hazard.zone.y,
      from.x,
      from.y,
      to.x,
      to.y,
    )
    const pixelLength = edgePixelLength(floor, edge)
    if (!nearestEdge || projected.distance < nearestEdge.distance) {
      nearestEdge = { edge, distance: projected.distance, t: projected.t, pixelLength }
    }
  }

  if (!nearestEdge) {
    return { nearestEdgeKey: null, nodeDistance: dist }
  }

  const fromSeed = nearestEdge.distance + nearestEdge.pixelLength * nearestEdge.t
  const toSeed = nearestEdge.distance + nearestEdge.pixelLength * (1 - nearestEdge.t)
  dist[nearestEdge.edge.from] = Math.min(dist[nearestEdge.edge.from], fromSeed)
  dist[nearestEdge.edge.to] = Math.min(dist[nearestEdge.edge.to], toSeed)

  while (true) {
    let current: string | null = null
    let best = Infinity
    for (const node of floor.nodes) {
      if (!visited.has(node.id) && dist[node.id] < best) {
        current = node.id
        best = dist[node.id]
      }
    }
    if (!current) break
    visited.add(current)

    for (const edge of floor.edges) {
      let neighborId: string | null = null
      if (edge.from === current) neighborId = edge.to
      else if (edge.to === current) neighborId = edge.from
      if (!neighborId || visited.has(neighborId)) continue

      const nextDistance = dist[current] + edgePixelLength(floor, edge)
      if (nextDistance < dist[neighborId]) {
        dist[neighborId] = nextDistance
      }
    }
  }

  return {
    nearestEdgeKey: edgeKey(nearestEdge.edge.from, nearestEdge.edge.to),
    nodeDistance: dist,
  }
}

function nodeDangerDistance(node: NavNode, field: HazardDistanceField): number {
  return field.nodeDistance[node.id] ?? Infinity
}

function edgeDangerDistance(
  floor: FloorModel,
  edge: NavEdge,
  hazard: RuntimeHazard,
  field: HazardDistanceField,
): number {
  const from = getNode(floor, edge.from)
  const to = getNode(floor, edge.to)
  if (!from || !to) return Infinity

  const key = edgeKey(edge.from, edge.to)
  if (key === field.nearestEdgeKey) {
    return pointToSegmentDistance(hazard.zone.x, hazard.zone.y, from.x, from.y, to.x, to.y).distance
  }

  return Math.min(field.nodeDistance[edge.from] ?? Infinity, field.nodeDistance[edge.to] ?? Infinity)
}

function riskAtDistance(distance: number, radius: number, multiplier: number): number {
  const riskRadius = Math.max(radius, radius * multiplier)
  if (!Number.isFinite(distance) || riskRadius <= 0 || distance >= riskRadius) return 0
  return Math.max(0, Math.min(1, 1 - distance / riskRadius))
}

function writeMax(record: Record<string, number>, key: string, value: number) {
  if (value <= 0) return
  record[key] = Math.max(record[key] ?? 0, value)
}

export function computeHazardImpact(floor: FloorModel, hazards: RuntimeHazard[]): HazardImpact {
  const blockedEdges = new Set<string>()
  const softBlockedEdges = new Set<string>()
  const blockedNodes = new Set<string>()
  const blockedExits = new Set<string>()
  const edgeRisk: Record<string, number> = {}
  const nodeRisk: Record<string, number> = {}

  for (const hazard of hazards) {
    if (!hazard.active || hazard.currentRadius <= 0) continue

    const isSmoke = hazard.zone.type === 'smoke'
    const isHard = !isSmoke
    const hardRadius = hazard.currentRadius
    const smokeRadius = hazard.currentRadius * SMOKE_SPREAD_MULTIPLIER
    const field = buildHazardDistanceField(floor, hazard)

    for (const node of floor.nodes) {
      const distance = nodeDangerDistance(node, field)
      const risk = riskAtDistance(distance, hazard.currentRadius, isSmoke ? SMOKE_SPREAD_MULTIPLIER : RISK_SPREAD_MULTIPLIER)
      writeMax(nodeRisk, node.id, risk)

      if (isHard && distance <= hardRadius) {
        blockedNodes.add(node.id)
        if (node.type === 'exit') blockedExits.add(node.id)
      }
    }

    for (const edge of floor.edges) {
      if (!edge.blockable) continue

      const key = edgeKey(edge.from, edge.to)
      const distance = edgeDangerDistance(floor, edge, hazard, field)
      const risk = riskAtDistance(distance, hazard.currentRadius, isSmoke ? SMOKE_SPREAD_MULTIPLIER : RISK_SPREAD_MULTIPLIER)
      writeMax(edgeRisk, key, risk)

      if (isSmoke) {
        if (distance <= smokeRadius && !blockedEdges.has(key)) {
          softBlockedEdges.add(key)
        }
      } else if (distance <= hardRadius) {
        blockedEdges.add(key)
        softBlockedEdges.delete(key)
      }
    }
  }

  return {
    blockedEdges,
    softBlockedEdges,
    blockedNodes,
    blockedExits,
    edgeRisk,
    nodeRisk,
  }
}
