/**
 * EVACSIM — Simulation Engine
 *
 * Manages agent movement along the navigation graph,
 * hazard progression, congestion modeling, and evaluation.
 */

import type { FloorModel, NavNode, HazardZone } from './building-model'
import { getNode, getNeighbors, findShortestPathToExit, edgeKey } from './building-model'

/* ── Agent model ── */
export interface Agent {
  id: string
  currentNodeId: string
  targetExitId: string | null
  path: string[]
  pathIndex: number
  /** 0–1 progress between current node and next */
  progress: number
  speed: number // m/s — normal 1.4, panic 2.2
  state: 'waiting' | 'moving' | 'rerouting' | 'evacuated' | 'trapped'
  reactionDelay: number // seconds before starting to move
  elapsedWait: number
  /** Accumulated hazard exposure */
  hazardExposure: number
  /** Number of reroutes taken */
  reroutes: number
  /** History of visited nodes with timestamps */
  history: { nodeId: string; time: number }[]
  /** Whether this agent uses a fixed user-drawn path (no auto-reroute) */
  isUserAgent?: boolean
}

/* ── Congestion tracker ── */
export interface CongestionState {
  /** People count per edge */
  edgeCounts: Record<string, number>
  /** People count per node */
  nodeCounts: Record<string, number>
}

/* ── Active hazard (runtime state) ── */
export interface ActiveHazard {
  zone: HazardZone
  currentRadius: number
  active: boolean
}

/* ── Simulation state ── */
export interface SimulationState {
  agents: Agent[]
  hazards: ActiveHazard[]
  congestion: CongestionState
  elapsedTime: number
  /** Edges currently blocked */
  blockedEdges: Set<string>
  /** Is the simulation running */
  running: boolean
  /** Is the simulation finished */
  finished: boolean
}

/* ── Snapshot for replay ── */
export interface SimSnapshot {
  time: number
  agents: { id: string; nodeId: string; progress: number; state: Agent['state']; pathIndex: number; nextNodeId?: string; isUserAgent?: boolean }[]
  hazards: { zoneId: string; active: boolean; currentRadius: number }[]
  blockedEdges: string[]
}

/* ── Simulation config ── */
export interface SimConfig {
  disasterType: 'fire' | 'earthquake'
  /** How many agents to spawn per room */
  agentsPerRoom: Record<string, number>
  /** Speed multiplier */
  speedMultiplier: number
  /** User-drawn path (list of node IDs from start room to exit) */
  userPath?: string[]
}

/* ── Create initial simulation state ── */
export function createSimulation(
  floor: FloorModel,
  config: SimConfig,
): SimulationState {
  const agents: Agent[] = []
  let agentIdx = 0

  // Spawn agents in rooms
  for (const [roomId, count] of Object.entries(config.agentsPerRoom)) {
    const room = getNode(floor, roomId)
    if (!room) continue

    for (let i = 0; i < count; i++) {
      // Stagger reaction delays: 0.5–4 seconds
      const reactionDelay = 0.5 + Math.random() * 3.5
      // Vary speeds: 1.0–2.0 m/s
      const speed = (1.0 + Math.random() * 1.0) * config.speedMultiplier

      agents.push({
        id: `agent-${agentIdx++}`,
        currentNodeId: roomId,
        targetExitId: null,
        path: [],
        pathIndex: 0,
        progress: 0,
        speed,
        state: 'waiting',
        reactionDelay,
        elapsedWait: 0,
        hazardExposure: 0,
        reroutes: 0,
        history: [{ nodeId: roomId, time: 0 }],
      })
    }
  }

  // Inject user agent if a user-drawn path was provided
  if (config.userPath && config.userPath.length >= 2) {
    const startRoomId = config.userPath[0]
    const exitId = config.userPath[config.userPath.length - 1]
    agents.unshift({
      id: 'user-agent',
      currentNodeId: startRoomId,
      targetExitId: exitId,
      path: config.userPath,
      pathIndex: 0,
      progress: 0,
      speed: 1.4 * config.speedMultiplier,
      state: 'waiting',
      reactionDelay: 0.5,
      elapsedWait: 0,
      hazardExposure: 0,
      reroutes: 0,
      history: [{ nodeId: startRoomId, time: 0 }],
      isUserAgent: true,
    })
  }

  // Initialize hazards
  const hazardDefs = floor.hazards[config.disasterType] || []
  const hazards: ActiveHazard[] = hazardDefs.map(z => ({
    zone: z,
    currentRadius: 0,
    active: false,
  }))

  return {
    agents,
    hazards,
    congestion: { edgeCounts: {}, nodeCounts: {} },
    elapsedTime: 0,
    blockedEdges: new Set(),
    running: false,
    finished: false,
  }
}

/* ── Step the simulation forward by dt seconds ── */
export function stepSimulation(
  state: SimulationState,
  floor: FloorModel,
  dt: number,
): SimulationState {
  const newState = { ...state, elapsedTime: state.elapsedTime + dt }

  // 1. Update hazards
  updateHazards(newState, floor, dt)

  // 2. Update blocked edges based on hazards
  updateBlockedEdges(newState, floor)

  // 3. Update congestion counts
  updateCongestion(newState)

  // 4. Update each agent
  for (const agent of newState.agents) {
    updateAgent(agent, newState, floor, dt)
  }

  // 5. Check if simulation is done
  const activeAgents = newState.agents.filter(a => a.state !== 'evacuated' && a.state !== 'trapped')
  if (activeAgents.length === 0) {
    newState.finished = true
    newState.running = false
  }

  return newState
}

/* ── Hazard progression ── */
function updateHazards(state: SimulationState, _floor: FloorModel, dt: number) {
  for (const h of state.hazards) {
    if (state.elapsedTime >= h.zone.appearsAt) {
      h.active = true
      if (h.zone.growthRate > 0) {
        h.currentRadius = h.zone.radius + h.zone.growthRate * (state.elapsedTime - h.zone.appearsAt)
      } else {
        h.currentRadius = h.zone.radius
      }
    }
  }
}

/* ── Block edges that pass through active hazard zones ── */
function updateBlockedEdges(state: SimulationState, floor: FloorModel) {
  state.blockedEdges.clear()

  for (const h of state.hazards) {
    if (!h.active) continue
    const r = h.currentRadius

    for (const edge of floor.edges) {
      if (!edge.blockable) continue
      const fromNode = getNode(floor, edge.from)
      const toNode = getNode(floor, edge.to)
      if (!fromNode || !toNode) continue

      // Check if the hazard zone intersects the edge midpoint
      const mx = (fromNode.x + toNode.x) / 2
      const my = (fromNode.y + toNode.y) / 2
      const dist = Math.hypot(mx - h.zone.x, my - h.zone.y)

      if (dist < r) {
        state.blockedEdges.add(edgeKey(edge.from, edge.to))
      }
    }
  }
}

/* ── Congestion tracking ── */
function updateCongestion(state: SimulationState) {
  const nodeCounts: Record<string, number> = {}
  const edgeCounts: Record<string, number> = {}

  for (const agent of state.agents) {
    if (agent.state === 'evacuated' || agent.state === 'trapped') continue
    nodeCounts[agent.currentNodeId] = (nodeCounts[agent.currentNodeId] || 0) + 1

    if (agent.pathIndex < agent.path.length - 1) {
      const ek = edgeKey(agent.path[agent.pathIndex], agent.path[agent.pathIndex + 1])
      edgeCounts[ek] = (edgeCounts[ek] || 0) + 1
    }
  }

  state.congestion = { nodeCounts, edgeCounts }
}

/* ── Agent update ── */
function updateAgent(
  agent: Agent,
  state: SimulationState,
  floor: FloorModel,
  dt: number,
) {
  if (agent.state === 'evacuated' || agent.state === 'trapped') return

  // Reaction delay
  if (agent.state === 'waiting') {
    agent.elapsedWait += dt
    if (agent.elapsedWait < agent.reactionDelay) return

    if (agent.isUserAgent && agent.path.length >= 2) {
      agent.state = 'moving'
      return
    }

    // Find initial route (auto agents)
    const result = findShortestPathToExit(floor, agent.currentNodeId, state.blockedEdges)
    if (!result) {
      agent.state = 'trapped'
      return
    }
    agent.path = result.path
    agent.pathIndex = 0
    agent.targetExitId = result.exitId
    agent.state = 'moving'
    return
  }

  // Check if current path is still valid (edges not blocked)
  if (agent.state === 'moving' && agent.pathIndex < agent.path.length - 1) {
    const nextEdge = edgeKey(agent.path[agent.pathIndex], agent.path[agent.pathIndex + 1])
    if (state.blockedEdges.has(nextEdge)) {
      if (agent.isUserAgent) {
        agent.state = 'trapped'
        return
      }
      // Auto agents reroute
      agent.state = 'rerouting'
      agent.reroutes++
      const result = findShortestPathToExit(floor, agent.currentNodeId, state.blockedEdges)
      if (!result) {
        agent.state = 'trapped'
        return
      }
      agent.path = result.path
      agent.pathIndex = 0
      agent.targetExitId = result.exitId
      agent.state = 'moving'
    }
  }

  // Move along path
  if (agent.state === 'moving' || agent.state === 'rerouting') {
    if (agent.pathIndex >= agent.path.length - 1) {
      // Check if at exit
      const currentNode = getNode(floor, agent.currentNodeId)
      if (currentNode?.type === 'exit') {
        agent.state = 'evacuated'
      }
      return
    }

    const fromId = agent.path[agent.pathIndex]
    const toId = agent.path[agent.pathIndex + 1]
    const fromNode = getNode(floor, fromId)
    const toNode = getNode(floor, toId)
    if (!fromNode || !toNode) return

    // Find edge distance
    const edge = floor.edges.find(
      e => (e.from === fromId && e.to === toId) || (e.from === toId && e.to === fromId),
    )
    const edgeDist = edge?.distance || 10

    // Congestion slowdown: more people on edge → slower
    const ek = edgeKey(fromId, toId)
    const edgeCount = state.congestion.edgeCounts[ek] || 0
    const edgeWidth = edge?.width || 2
    const congestionFactor = Math.max(0.3, 1 - (edgeCount / (edgeWidth * 5)))

    // Hazard proximity slowdown
    let hazardFactor = 1.0
    const mx = (fromNode.x + toNode.x) / 2
    const my = (fromNode.y + toNode.y) / 2
    for (const h of state.hazards) {
      if (!h.active) continue
      const dist = Math.hypot(mx - h.zone.x, my - h.zone.y)
      if (dist < h.currentRadius * 1.5) {
        hazardFactor = Math.min(hazardFactor, 0.5)
        agent.hazardExposure += dt
      }
    }

    const effectiveSpeed = agent.speed * congestionFactor * hazardFactor
    agent.progress += (effectiveSpeed * dt) / edgeDist

    if (agent.progress >= 1) {
      agent.progress = 0
      agent.pathIndex++
      agent.currentNodeId = toId
      agent.state = 'moving'
      agent.history.push({ nodeId: toId, time: state.elapsedTime })

      // Check if reached exit
      if (toNode.type === 'exit') {
        agent.state = 'evacuated'
      }
    }
  }
}

/* ── Evaluation metrics ── */
export interface SimulationResults {
  totalTime: number
  evacuatedCount: number
  trappedCount: number
  avgEvacuationTime: number
  maxEvacuationTime: number
  totalReroutes: number
  avgHazardExposure: number
  bottleneckEdges: { edge: string; peakCount: number }[]
  exitUsage: Record<string, number>
  feedback: string[]
}

export function evaluateSimulation(state: SimulationState, floor: FloorModel): SimulationResults {
  const evacuated = state.agents.filter(a => a.state === 'evacuated')
  const trapped = state.agents.filter(a => a.state === 'trapped')

  const evacTimes = evacuated.map(a => {
    const lastH = a.history[a.history.length - 1]
    return lastH?.time || 0
  })

  const exitUsage: Record<string, number> = {}
  for (const a of evacuated) {
    const exitId = a.targetExitId || 'unknown'
    exitUsage[exitId] = (exitUsage[exitId] || 0) + 1
  }

  // Find bottleneck edges (peak congestion)
  const edgePeaks: Record<string, number> = {}
  // Use current congestion as proxy
  for (const [ek, count] of Object.entries(state.congestion.edgeCounts)) {
    edgePeaks[ek] = Math.max(edgePeaks[ek] || 0, count)
  }

  const bottleneckEdges = Object.entries(edgePeaks)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([edge, peakCount]) => ({ edge, peakCount }))

  const totalReroutes = state.agents.reduce((s, a) => s + a.reroutes, 0)
  const avgExposure = state.agents.reduce((s, a) => s + a.hazardExposure, 0) / state.agents.length

  // Generate feedback
  const feedback: string[] = []

  if (trapped.length > 0) {
    feedback.push(`${trapped.length} evacuee(s) were trapped and could not reach an exit. Review blocked corridor scenarios.`)
  }
  if (totalReroutes > 3) {
    feedback.push(`${totalReroutes} reroutes occurred. Hazards blocked planned evacuation paths — consider adding secondary signage.`)
  }

  const maxExitUsage = Math.max(...Object.values(exitUsage), 0)
  const minExitUsage = Math.min(...Object.values(exitUsage), 0)
  if (maxExitUsage > 0 && minExitUsage > 0 && maxExitUsage / minExitUsage > 2) {
    const overusedExit = Object.entries(exitUsage).find(([, v]) => v === maxExitUsage)
    if (overusedExit) {
      const exitNode = getNode(floor, overusedExit[0])
      feedback.push(`${exitNode?.label || overusedExit[0]} handled ${maxExitUsage} evacuees — uneven exit distribution. Redirect occupants to less-used exits in drills.`)
    }
  }

  if (avgExposure > 2) {
    feedback.push(`Average hazard exposure was ${avgExposure.toFixed(1)}s. Routes frequently passed near danger zones.`)
  }

  if (evacuated.length === state.agents.length) {
    feedback.push('All evacuees reached an exit successfully.')
  }

  // User agent specific feedback
  const userAgent = state.agents.find(a => a.isUserAgent)
  if (userAgent) {
    if (userAgent.state === 'evacuated') {
      const userTime = userAgent.history[userAgent.history.length - 1]?.time || 0
      const avgAutoTime = evacTimes.length > 0 ? evacTimes.reduce((a, b) => a + b, 0) / evacTimes.length : 0
      if (avgAutoTime > 0 && userTime < avgAutoTime * 0.8) {
        feedback.push(`Your route was ${((1 - userTime / avgAutoTime) * 100).toFixed(0)}% faster than average. Good route choice!`)
      } else if (avgAutoTime > 0 && userTime > avgAutoTime * 1.3) {
        feedback.push(`Your route took ${((userTime / avgAutoTime - 1) * 100).toFixed(0)}% longer than average. Consider a shorter path next time.`)
      } else {
        feedback.push('Your evacuation time was close to the average. Solid route choice.')
      }
      if (userAgent.hazardExposure > 1) {
        feedback.push(`You were exposed to hazards for ${userAgent.hazardExposure.toFixed(1)}s. Try to avoid passing near danger zones.`)
      }
    } else if (userAgent.state === 'trapped') {
      feedback.push('Your chosen route became blocked by hazards. Choose exits farther from known danger zones or pick shorter routes.')
    }
  }

  const avgTime = evacTimes.length > 0 ? evacTimes.reduce((a, b) => a + b, 0) / evacTimes.length : 0

  return {
    totalTime: state.elapsedTime,
    evacuatedCount: evacuated.length,
    trappedCount: trapped.length,
    avgEvacuationTime: avgTime,
    maxEvacuationTime: Math.max(...evacTimes, 0),
    totalReroutes,
    avgHazardExposure: avgExposure,
    bottleneckEdges,
    exitUsage,
    feedback,
  }
}

/* ── Snapshot for replay ── */
export function takeSnapshot(state: SimulationState): SimSnapshot {
  return {
    time: state.elapsedTime,
    agents: state.agents.map(a => ({
      id: a.id,
      nodeId: a.currentNodeId,
      progress: a.progress,
      state: a.state,
      pathIndex: a.pathIndex,
      nextNodeId: a.pathIndex < a.path.length - 1 ? a.path[a.pathIndex + 1] : undefined,
      isUserAgent: a.isUserAgent,
    })),
    hazards: state.hazards.map(h => ({
      zoneId: h.zone.id,
      active: h.active,
      currentRadius: h.currentRadius,
    })),
    blockedEdges: [...state.blockedEdges],
  }
}
