import type { FloorModel, NavEdge, NavNode } from './building-model'
import { edgeKey, getNode } from './building-model'
import type { Agent, SimulationState } from './engine'
import type { RiskLevel, SeverityLevel } from '@/src/schema/enums'

export interface AccurateCongestion {
  nodeCounts: Record<string, number>
  edgeCounts: Record<string, number>
}

export interface AutonomousTrace {
  tickCount: number
  totalSeconds: number
  nodePeakCounts: Record<string, number>
  edgePeakCounts: Record<string, number>
  nodeCumulativeCounts: Record<string, number>
  edgeCumulativeCounts: Record<string, number>
}

function zeroRecord(keys: string[]): Record<string, number> {
  return keys.reduce<Record<string, number>>((record, key) => {
    record[key] = 0
    return record
  }, {})
}

function edgeLabel(edge: NavEdge, floor: FloorModel): string {
  const fromNode = getNode(floor, edge.from)
  const toNode = getNode(floor, edge.to)
  return `${fromNode?.label || edge.from} -> ${toNode?.label || edge.to}`
}

function severityFromPeak(peakCount: number, maxPeak: number): SeverityLevel {
  if (maxPeak <= 0) return 'LOW'
  const ratio = peakCount / maxPeak
  if (ratio >= 0.8) return 'HIGH'
  if (ratio >= 0.45) return 'MEDIUM'
  return 'LOW'
}

function riskFromIntensity(intensity: number): RiskLevel {
  if (intensity >= 75) return 'HIGH'
  if (intensity >= 45) return 'MEDIUM'
  return 'LOW'
}

export function createAutonomousTrace(floor: FloorModel): AutonomousTrace {
  return {
    tickCount: 0,
    totalSeconds: 0,
    nodePeakCounts: zeroRecord(floor.nodes.map((node) => node.id)),
    edgePeakCounts: zeroRecord(floor.edges.map((edge) => edgeKey(edge.from, edge.to))),
    nodeCumulativeCounts: zeroRecord(floor.nodes.map((node) => node.id)),
    edgeCumulativeCounts: zeroRecord(floor.edges.map((edge) => edgeKey(edge.from, edge.to))),
  }
}

export function distributeAgentsByCapacity(floor: FloorModel, totalAgents: number): Record<string, number> {
  const roomNodes = floor.nodes.filter((node) => node.type === 'room')
  const totalCapacity = roomNodes.reduce((sum, node) => sum + node.capacity, 0)
  const safeTotal = Math.max(1, Math.min(totalAgents, totalCapacity))

  const allocations = roomNodes.map((roomNode) => {
    const exact = (roomNode.capacity / totalCapacity) * safeTotal
    const assigned = Math.floor(exact)
    return {
      roomId: roomNode.id,
      assigned,
      remainder: exact - assigned,
    }
  })

  let assignedTotal = allocations.reduce((sum, allocation) => sum + allocation.assigned, 0)
  while (assignedTotal < safeTotal) {
    allocations
      .sort((a, b) => b.remainder - a.remainder)
      .some((allocation) => {
        allocation.assigned += 1
        assignedTotal += 1
        return true
      })
  }

  return allocations.reduce<Record<string, number>>((record, allocation) => {
    record[allocation.roomId] = allocation.assigned
    return record
  }, {})
}

export function computeAccurateCongestion(state: SimulationState): AccurateCongestion {
  const nodeCounts: Record<string, number> = {}
  const edgeCounts: Record<string, number> = {}

  for (const agent of state.agents) {
    if (agent.state === 'evacuated' || agent.state === 'trapped') {
      continue
    }

    if (agent.progress > 0 && agent.pathIndex < agent.path.length - 1) {
      const key = edgeKey(agent.path[agent.pathIndex], agent.path[agent.pathIndex + 1])
      edgeCounts[key] = (edgeCounts[key] || 0) + 1
      continue
    }

    nodeCounts[agent.currentNodeId] = (nodeCounts[agent.currentNodeId] || 0) + 1
  }

  return { nodeCounts, edgeCounts }
}

export function updateAutonomousTrace(
  trace: AutonomousTrace,
  congestion: AccurateCongestion,
  dt: number,
): AutonomousTrace {
  const nextTrace: AutonomousTrace = {
    ...trace,
    tickCount: trace.tickCount + 1,
    totalSeconds: trace.totalSeconds + dt,
    nodePeakCounts: { ...trace.nodePeakCounts },
    edgePeakCounts: { ...trace.edgePeakCounts },
    nodeCumulativeCounts: { ...trace.nodeCumulativeCounts },
    edgeCumulativeCounts: { ...trace.edgeCumulativeCounts },
  }

  for (const [nodeId, count] of Object.entries(congestion.nodeCounts)) {
    nextTrace.nodePeakCounts[nodeId] = Math.max(nextTrace.nodePeakCounts[nodeId] || 0, count)
    nextTrace.nodeCumulativeCounts[nodeId] = (nextTrace.nodeCumulativeCounts[nodeId] || 0) + count * dt
  }

  for (const [edgeId, count] of Object.entries(congestion.edgeCounts)) {
    nextTrace.edgePeakCounts[edgeId] = Math.max(nextTrace.edgePeakCounts[edgeId] || 0, count)
    nextTrace.edgeCumulativeCounts[edgeId] = (nextTrace.edgeCumulativeCounts[edgeId] || 0) + count * dt
  }

  return nextTrace
}

export function getAgentRenderPosition(agent: Agent, floor: FloorModel) {
  const baseNode = getNode(floor, agent.currentNodeId)
  if (!baseNode) {
    return { x: 0, y: 0 }
  }

  if (agent.progress > 0 && agent.pathIndex < agent.path.length - 1) {
    const nextNode = getNode(floor, agent.path[agent.pathIndex + 1])
    if (!nextNode) {
      return { x: baseNode.x, y: baseNode.y }
    }

    return {
      x: baseNode.x + (nextNode.x - baseNode.x) * agent.progress,
      y: baseNode.y + (nextNode.y - baseNode.y) * agent.progress,
    }
  }

  return {
    x: baseNode.x,
    y: baseNode.y,
  }
}

export function getTopNodeHotspots(floor: FloorModel, trace: AutonomousTrace, limit: number) {
  const totalSeconds = Math.max(trace.totalSeconds, 1)

  return floor.nodes
    .filter((node) => node.type !== 'room')
    .map((node) => ({
      node,
      peak: trace.nodePeakCounts[node.id] || 0,
      average: (trace.nodeCumulativeCounts[node.id] || 0) / totalSeconds,
    }))
    .sort((left, right) => (right.peak * 2 + right.average) - (left.peak * 2 + left.average))
    .slice(0, limit)
}

export function buildZoneSummaries(floor: FloorModel, trace: AutonomousTrace) {
  const maxNodePeak = Math.max(
    ...floor.nodes
      .filter((node) => node.type !== 'room')
      .map((node) => trace.nodePeakCounts[node.id] || 0),
    0,
  )

  const significantEdgeKeys = new Set(
    floor.edges
      .map((edge) => ({
        edge,
        peak: trace.edgePeakCounts[edgeKey(edge.from, edge.to)] || 0,
      }))
      .sort((left, right) => right.peak - left.peak)
      .slice(0, 6)
      .map(({ edge }) => edgeKey(edge.from, edge.to)),
  )

  return floor.nodes
    .filter((node) => node.type !== 'room')
    .map((node) => {
      const peakLoad = trace.nodePeakCounts[node.id] || 0
      const intensity = maxNodePeak > 0 ? Math.round((peakLoad / maxNodePeak) * 100) : 0
      const incidentBottlenecks = floor.edges.filter((edge) => (
        significantEdgeKeys.has(edgeKey(edge.from, edge.to))
        && (edge.from === node.id || edge.to === node.id)
      )).length

      return {
        zoneName: node.label,
        intensity,
        agentCount: peakLoad,
        bottleneckCount: incidentBottlenecks,
        riskLevel: riskFromIntensity(intensity),
        lat: null,
        lng: null,
      }
    })
    .sort((left, right) => right.intensity - left.intensity)
}

export function buildBottleneckSummaries(floor: FloorModel, trace: AutonomousTrace) {
  const totalSeconds = Math.max(trace.totalSeconds, 1)
  const edgePeaks = floor.edges.map((edge) => ({
    edge,
    key: edgeKey(edge.from, edge.to),
    peak: trace.edgePeakCounts[edgeKey(edge.from, edge.to)] || 0,
    average: (trace.edgeCumulativeCounts[edgeKey(edge.from, edge.to)] || 0) / totalSeconds,
  }))
  const maxPeak = Math.max(...edgePeaks.map((entry) => entry.peak), 0)

  return edgePeaks
    .sort((left, right) => (right.peak * 2 + right.average) - (left.peak * 2 + left.average))
    .slice(0, 6)
    .map(({ edge, peak, average }) => ({
      zoneName: edgeLabel(edge, floor),
      severity: severityFromPeak(peak, maxPeak),
      cellX: null,
      cellY: null,
      description: `Peak load ${peak} agents, average flow ${average.toFixed(1)} agents.`,
    }))
}

export function getPeakCongestion(trace: AutonomousTrace) {
  return Math.max(
    ...Object.values(trace.nodePeakCounts),
    ...Object.values(trace.edgePeakCounts),
    0,
  )
}

export function getGlobalPeakDensityPercent(floor: FloorModel, trace: AutonomousTrace) {
  const normalizedPeaks = floor.nodes
    .filter((node) => node.type !== 'room')
    .map((node) => {
      const peak = trace.nodePeakCounts[node.id] || 0
      return node.capacity > 0 ? peak / node.capacity : 0
    })

  return Math.round(Math.max(...normalizedPeaks, 0) * 100)
}

export function getNodeIntensity(node: NavNode, trace: AutonomousTrace) {
  const maxPeak = Math.max(...Object.values(trace.nodePeakCounts), 0)
  if (maxPeak <= 0) return 0
  return (trace.nodePeakCounts[node.id] || 0) / maxPeak
}

export function getEdgeIntensity(edge: NavEdge, trace: AutonomousTrace) {
  const key = edgeKey(edge.from, edge.to)
  const maxPeak = Math.max(...Object.values(trace.edgePeakCounts), 0)
  if (maxPeak <= 0) return 0
  return (trace.edgePeakCounts[key] || 0) / maxPeak
}
