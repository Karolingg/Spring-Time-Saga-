/**
 * EVACSIM — Simulation Engine
 *
 * Manages agent movement along the navigation graph,
 * hazard progression, congestion modeling, and evaluation.
 */

import type { FloorModel, HazardZone } from './building-model'
import { getNode, findShortestPathToExit, findShortestPathToExitWeighted, edgeKey } from './building-model'

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
  /** Cumulative seconds the agent has spent inside the radius of an active
   *  hard hazard (fire / debris). Used to gate a short grace period before
   *  the agent is marked as trapped. */
  timeInsideFire: number
  /** Cumulative seconds since the last attempt to retreat out of a fire so
   *  we don't oscillate retreating every tick. */
  retreatCooldown: number
  /** Whether this agent uses a fixed user-drawn path (no auto-reroute) */
  isUserAgent?: boolean
  /** Per-agent multiplier (~0.85–1.15) fed into path search so ties resolve
   *  differently for each agent. Keeps agents from all piling onto the same
   *  global-shortest route. Set once at spawn. */
  routingJitter: number
  /** Time spent trying to reroute without a path */
  rerouteStallTime: number
  /** Temporary anchor so reroutes don't visually snap */
  rerouteAnchor?: { x: number; y: number; nodeId: string; progress: number; distance: number }
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
  /** Multiplies hazard radius growth for scenario tuning */
  hazardGrowthMultiplier: number
  /** Edges HARD-blocked by fire / debris / blocked zones — agents cannot traverse */
  blockedEdges: Set<string>
  /** Edges SOFT-blocked by smoke — agents can still traverse but pay a heavy penalty
   *  when routing and take extra slowdown + exposure while on them */
  softBlockedEdges: Set<string>
  /** Is the simulation running */
  running: boolean
  /** Is the simulation finished */
  finished: boolean
}

/** Penalty multiplier applied to smoke-filled edges during path search.
 *  A detour up to ~3.5x longer will be preferred over walking through smoke. */
const SOFT_EDGE_COST_MULTIPLIER = 3.5

/** How many meters of extra cost each person on an edge adds when
 *  re-planning. Large enough to tip otherwise-equal routes, small enough
 *  that agents still take a short congested path over a massive detour. */
const CONGESTION_WEIGHT = 1.5

/** How many meters of extra cost each agent already heading to an exit
 *  adds when another agent is re-planning. Spreads the load across
 *  multiple exits when one is getting piled on. */
const EXIT_BIAS_PER_AGENT = 2.5

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
  /** Multiplies hazard radius growth */
  hazardGrowthMultiplier?: number
  /** User-drawn path (list of node IDs from start room to exit) */
  userPath?: string[]
  /** Override hazard zones for the selected disaster type */
  hazardOverrides?: HazardZone[]
  /** Optional RNG seed. When provided, agent reaction delays, speeds, and
   *  routing jitter are drawn from a seeded PRNG — letting the replay view
   *  reconstruct the exact agent population from the saved seed. */
  seed?: number
}

const MIN_AGENT_SPEED = 1.0
const MAX_AGENT_SPEED = 2.0

/** Mulberry32 — 32-bit seedable PRNG. Cheap, good distribution, returns
 *  values in [0, 1). Wrapped in a closure that captures the running state. */
function createSeededRng(seed: number): () => number {
  let state = (seed >>> 0) || 1
  return () => {
    state = (state + 0x6D2B79F5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/* ── Create initial simulation state ── */
export function createSimulation(
  floor: FloorModel,
  config: SimConfig,
): SimulationState {
  const agents: Agent[] = []
  let agentIdx = 0

  const rand = config.seed != null ? createSeededRng(config.seed) : Math.random
  const randomAgentSpeed = () => MIN_AGENT_SPEED + rand() * (MAX_AGENT_SPEED - MIN_AGENT_SPEED)

  // Reaction delay range depends on the disaster:
  //  - Fire:        0.5–4s   — occupants smell smoke / hear alarm and move quickly.
  //  - Earthquake:  6–18s    — Drop-Cover-Hold protocol. Real evacuation studies
  //                            show occupants stay in place during the tremor
  //                            and only start moving once shaking subsides.
  const isQuake = config.disasterType === 'earthquake'
  const reactionMin = isQuake ? 6 : 0.5
  const reactionRange = isQuake ? 12 : 3.5

  // Spawn agents in rooms. We sort the room IDs so the order in which we
  // consume RNG values is independent of the JS engine's object key order —
  // critical for the replay seed to produce identical agents.
  const roomEntries = Object.entries(config.agentsPerRoom).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  for (const [roomId, count] of roomEntries) {
    const room = getNode(floor, roomId)
    if (!room) continue

    for (let i = 0; i < count; i++) {
      const reactionDelay = reactionMin + rand() * reactionRange
      // Vary speeds: 1.0–2.0 m/s
      const speed = randomAgentSpeed()

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
        // Jitter range 0.85–1.15 — enough to swap ties between near-equal
        // routes without ever making a bad route look better than a good one.
        routingJitter: 0.85 + rand() * 0.30,
        rerouteStallTime: 0,
        rerouteAnchor: undefined,
        timeInsideFire: 0,
        retreatCooldown: 0,
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
      speed: randomAgentSpeed(),
      state: 'waiting',
      reactionDelay: 0.5,
      elapsedWait: 0,
      hazardExposure: 0,
      reroutes: 0,
      history: [{ nodeId: startRoomId, time: 0 }],
      isUserAgent: true,
      routingJitter: 1,
      rerouteStallTime: 0,
      rerouteAnchor: undefined,
      timeInsideFire: 0,
      retreatCooldown: 0,
    })
  }

  // Initialize hazards
  const hazardDefs = config.hazardOverrides ?? (floor.hazards[config.disasterType] || [])
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
    hazardGrowthMultiplier: config.hazardGrowthMultiplier ?? 1,
    blockedEdges: new Set(),
    softBlockedEdges: new Set(),
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
  updateHazards(newState)

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

/* ── Hazard progression ──
 * Growth is clamped to `maxRadius` so hazards stop ballooning once they've
 * hit their dramatic size. Without this cap, long-running scenarios end up
 * with fire/smoke circles that cover the entire floorplan, hiding agents
 * and making the visualization unreadable. */
function updateHazards(state: SimulationState) {
  for (const h of state.hazards) {
    if (state.elapsedTime >= h.zone.appearsAt) {
      h.active = true
      let r: number
      if (h.zone.growthRate > 0) {
        r = h.zone.radius + (h.zone.growthRate * state.hazardGrowthMultiplier) * (state.elapsedTime - h.zone.appearsAt)
      } else {
        r = h.zone.radius
      }
      if (h.zone.maxRadius !== undefined) {
        r = Math.min(r, h.zone.maxRadius)
      }
      h.currentRadius = r
    }
  }
}

/* ── Block edges that pass through active hazard zones ──
 *
 * Hazard semantics:
 *   • fire / debris / blocked  → HARD block. Edge is removed from the nav graph
 *     until the hazard recedes. Dijkstra will never plan through it.
 *   • smoke                    → SOFT block. Edge stays traversable — agents
 *     should be able to push through a smoky corridor if it's their only way
 *     out — but it carries a heavy routing penalty so a clean detour is
 *     preferred, and the agent accrues extra slowdown + exposure while on it.
 */
function updateBlockedEdges(state: SimulationState, floor: FloorModel) {
  state.blockedEdges.clear()
  state.softBlockedEdges.clear()

  for (const h of state.hazards) {
    if (!h.active) continue
    const r = h.currentRadius
    const isSoft = h.zone.type === 'smoke'

    for (const edge of floor.edges) {
      if (!edge.blockable) continue
      const fromNode = getNode(floor, edge.from)
      const toNode = getNode(floor, edge.to)
      if (!fromNode || !toNode) continue

      const mx = (fromNode.x + toNode.x) / 2
      const my = (fromNode.y + toNode.y) / 2
      const dist = Math.hypot(mx - h.zone.x, my - h.zone.y)
      if (dist >= r) continue

      const key = edgeKey(edge.from, edge.to)
      if (isSoft) {
        // Only downgrade to soft if no hard block already applies.
        if (!state.blockedEdges.has(key)) state.softBlockedEdges.add(key)
      } else {
        state.blockedEdges.add(key)
        // A hard block supersedes any earlier soft block.
        state.softBlockedEdges.delete(key)
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

/** Does any edge on the remaining portion of `path` (from `pathIndex` onward)
 *  have a HARD block? If so, the agent needs to reroute now instead of walking
 *  into a dead end. Soft blocks (smoke) don't count — the agent stays committed. */
function remainingPathHasHardBlock(path: string[], pathIndex: number, blockedEdges: Set<string>): boolean {
  for (let i = pathIndex; i < path.length - 1; i++) {
    if (blockedEdges.has(edgeKey(path[i], path[i + 1]))) return true
  }
  return false
}

/** Count how many still-active agents are currently aiming at each exit.
 *  Used to bias new arrivals toward under-used exits. */
function buildExitBias(state: SimulationState): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const a of state.agents) {
    if (a.state === 'evacuated' || a.state === 'trapped') continue
    if (!a.targetExitId) continue
    counts[a.targetExitId] = (counts[a.targetExitId] ?? 0) + 1
  }
  const bias: Record<string, number> = {}
  for (const [exitId, n] of Object.entries(counts)) {
    bias[exitId] = n * EXIT_BIAS_PER_AGENT
  }
  return bias
}

/** Replan for an auto agent using the weighted search so smoke is penalized
 *  but not excluded. Also pushes the agent away from crowded edges and
 *  already-popular exits, and applies the agent's personal jitter so ties
 *  don't all resolve the same way. Returns true if a path was found. */
function replanAgent(
  agent: Agent,
  state: SimulationState,
  floor: FloorModel,
): boolean {
  agent.progress = 0
  const result = findShortestPathToExitWeighted(
    floor,
    agent.currentNodeId,
    state.blockedEdges,
    state.softBlockedEdges,
    SOFT_EDGE_COST_MULTIPLIER,
    {
      edgeCounts: state.congestion.edgeCounts,
      congestionWeight: CONGESTION_WEIGHT,
      jitter: agent.routingJitter,
      exitBias: buildExitBias(state),
    },
  )
  if (!result) return false
  agent.path = result.path
  agent.pathIndex = 0
  agent.targetExitId = result.exitId
  return true
}

/** Is the agent's current rendered position inside the radius of an active
 *  hard hazard (fire / debris / blocked)? Smoke doesn't count — agents can
 *  walk through smoke under panic. */
function agentIsInsideHardHazard(agent: Agent, floor: FloorModel, state: SimulationState): boolean {
  const node = getNode(floor, agent.currentNodeId)
  if (!node) return false
  let ax = node.x
  let ay = node.y
  if (agent.progress > 0 && agent.pathIndex < agent.path.length - 1) {
    const next = getNode(floor, agent.path[agent.pathIndex + 1])
    if (next) {
      ax = node.x + (next.x - node.x) * agent.progress
      ay = node.y + (next.y - node.y) * agent.progress
    }
  }
  for (const h of state.hazards) {
    if (!h.active) continue
    if (h.zone.type !== 'fire' && h.zone.type !== 'debris' && h.zone.type !== 'blocked') continue
    if (Math.hypot(ax - h.zone.x, ay - h.zone.y) < h.currentRadius) return true
  }
  return false
}

/** Snap the agent back to the previous node they visited (per their history)
 *  and clear their committed path so they replan from a safer location next
 *  tick. No-op if there's nowhere to retreat to. */
function retreatOneNode(agent: Agent, floor: FloorModel): boolean {
  if (agent.history.length < 2) return false
  const previous = agent.history[agent.history.length - 2]
  const prevNode = getNode(floor, previous.nodeId)
  if (!prevNode) return false
  agent.currentNodeId = previous.nodeId
  agent.path = [previous.nodeId]
  agent.pathIndex = 0
  agent.progress = 0
  agent.rerouteAnchor = undefined
  // Drop the now-stale history tail so we don't bounce back into the fire.
  agent.history.pop()
  agent.reroutes++
  return true
}

/* ── Agent update ── */
function updateAgent(
  agent: Agent,
  state: SimulationState,
  floor: FloorModel,
  dt: number,
) {
  if (agent.state === 'evacuated' || agent.state === 'trapped') return

  if (agent.rerouteAnchor && agent.rerouteAnchor.progress < 1) {
    const anchor = agent.rerouteAnchor
    if (anchor.distance > 0) {
      anchor.progress = Math.min(1, anchor.progress + (agent.speed * dt) / anchor.distance)
    } else {
      anchor.progress = 1
    }
    if (anchor.progress >= 1) {
      agent.rerouteAnchor = undefined
    }
    return
  }

  // Reaction delay → initial routing
  if (agent.state === 'waiting') {
    agent.elapsedWait += dt
    if (agent.elapsedWait < agent.reactionDelay) return

    if (agent.isUserAgent && agent.path.length >= 2) {
      agent.state = 'moving'
      return
    }

    // Auto agents use weighted pathfinding so a smoke-filled corridor is
    // preferred over being trapped, but avoided when a cleaner detour exists.
    if (!replanAgent(agent, state, floor)) {
      // No path even with smoke allowed → truly unreachable (hard blocks only).
      agent.state = 'trapped'
      return
    }
    agent.state = 'moving'
    return
  }

  // Agents stuck in rerouting keep searching until a path is found or they time out.
  if (agent.state === 'rerouting') {
    if (replanAgent(agent, state, floor)) {
      agent.state = 'moving'
      agent.rerouteStallTime = 0
    } else {
      agent.rerouteStallTime += dt
      // If the agent is currently sitting inside an active fire (or similar
      // hard hazard) and replanning failed, fall back to retreating one node
      // along their history. The previous node was reachable before the
      // hazard expanded, so it's the safest immediate destination.
      if (agent.retreatCooldown <= 0 && agentIsInsideHardHazard(agent, floor, state)) {
        retreatOneNode(agent, floor)
        agent.retreatCooldown = 1.2
      } else if (agent.rerouteStallTime >= 6) {
        agent.state = 'trapped'
      }
    }
    return
  }

  // Revalidate path: look ahead at the *entire* remaining portion, not just the
  // next edge. If a fire/debris block appeared anywhere further down the
  // committed path, reroute now — otherwise the agent keeps walking straight
  // into a dead end and only reacts at the last step.
  if (agent.state === 'moving' && agent.pathIndex < agent.path.length - 1) {
    const nextEdgeKey = edgeKey(agent.path[agent.pathIndex], agent.path[agent.pathIndex + 1])
    const nextHardBlocked = state.blockedEdges.has(nextEdgeKey)
    const aheadHardBlocked = !nextHardBlocked && remainingPathHasHardBlock(agent.path, agent.pathIndex, state.blockedEdges)

    if (nextHardBlocked || aheadHardBlocked) {
      if (agent.isUserAgent) {
        // User-drawn path is fixed — they get trapped at the blockage.
        if (nextHardBlocked) {
          agent.state = 'trapped'
          return
        }
        // Otherwise let them keep walking until they hit it.
      } else {
        agent.state = 'rerouting'
        agent.reroutes++
        agent.rerouteStallTime = 0
        if (agent.progress > 0 && agent.pathIndex < agent.path.length - 1) {
          const fromId = agent.path[agent.pathIndex]
          const toId = agent.path[agent.pathIndex + 1]
          const fromNode = getNode(floor, fromId)
          const toNode = getNode(floor, toId)
          if (fromNode && toNode) {
            const anchorX = fromNode.x + (toNode.x - fromNode.x) * agent.progress
            const anchorY = fromNode.y + (toNode.y - fromNode.y) * agent.progress
            const anchorNodeId = agent.progress >= 0.5 ? toId : fromId
            const anchorNode = agent.progress >= 0.5 ? toNode : fromNode
            const anchorDistance = Math.hypot(anchorNode.x - anchorX, anchorNode.y - anchorY)
            agent.rerouteAnchor = {
              x: anchorX,
              y: anchorY,
              nodeId: anchorNodeId,
              progress: 0,
              distance: anchorDistance,
            }
            agent.currentNodeId = anchorNodeId
            agent.pathIndex = 0
            agent.progress = 0
          }
        }
        if (replanAgent(agent, state, floor)) {
          agent.state = 'moving'
        }
        return
      }
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

    // Hazard proximity behavior:
    //   • Soft hazards (smoke):   slow down — discourage walking through.
    //   • Hard hazards (fire / debris / blocked): predictor + panic boost.
    //       Within 1.5x radius: speed up so the agent can clear the proximity.
    //       Inside the radius:  speed up MORE (panic) and tick `timeInsideFire`
    //                            so a grace period can elapse before trapping.
    // The agent's current rendered position is interpolated along the edge so
    // proximity checks reflect where the agent actually is, not just the
    // edge midpoint.
    const ax = fromNode.x + (toNode.x - fromNode.x) * agent.progress
    const ay = fromNode.y + (toNode.y - fromNode.y) * agent.progress

    let smokeFactor = 1.0
    let panicFactor = 1.0
    let insideHardHazard = false

    for (const h of state.hazards) {
      if (!h.active) continue
      const dist = Math.hypot(ax - h.zone.x, ay - h.zone.y)
      const isHardHazard = h.zone.type === 'fire' || h.zone.type === 'debris' || h.zone.type === 'blocked'

      if (isHardHazard) {
        if (dist < h.currentRadius) {
          insideHardHazard = true
          panicFactor = Math.max(panicFactor, 1.8)   // Run for your life.
          agent.hazardExposure += dt * 2
        } else if (dist < h.currentRadius * 1.5) {
          // Predictor zone — adrenaline kick to clear the danger.
          panicFactor = Math.max(panicFactor, 1.35)
        }
      } else if (dist < h.currentRadius * 1.5) {
        // Smoke proximity: cautious slowdown + extra exposure tick.
        smokeFactor = Math.min(smokeFactor, 0.5)
        agent.hazardExposure += dt
      }
    }

    // Walking directly through smoke (a soft-blocked edge) — cap speed at 0.5x
    // and double the exposure tick. The agent keeps moving; they're not stuck.
    if (state.softBlockedEdges.has(ek)) {
      smokeFactor = Math.min(smokeFactor, 0.5)
      agent.hazardExposure += dt
    }

    // Panic always overrides smoke caution — the agent needs to GTFO.
    const hazardFactor = panicFactor > 1 ? panicFactor : smokeFactor

    // Grace period inside fire. The agent gets a few seconds with a boosted
    // panic speed to escape on their own. Past that, they're overcome.
    if (insideHardHazard) {
      agent.timeInsideFire += dt
      if (agent.timeInsideFire >= 3) {
        agent.state = 'trapped'
        return
      }
    } else {
      // Outside hazard — decay the in-fire counter so re-entries don't carry
      // over from a previous exposure that the agent successfully escaped.
      agent.timeInsideFire = Math.max(0, agent.timeInsideFire - dt * 0.5)
    }

    if (agent.retreatCooldown > 0) {
      agent.retreatCooldown = Math.max(0, agent.retreatCooldown - dt)
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
