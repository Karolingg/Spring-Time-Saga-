import type { FloorModel, HazardForecast, HazardZone, NavEdge, NavNode } from './building-model'
import { getNode, findShortestPathToExitWeighted, edgeKey } from './building-model'
import { hazardGrowthRate } from './hazard-physics'

export type AgentType = 'fast' | 'average' | 'slow'

const AGENT_TYPE_CONFIG: Record<AgentType, {
  speedRange: [number, number]
  reactionMultiplier: number
  panicCap: number
}> = {
  fast:    { speedRange: [1.6, 2.2], reactionMultiplier: 0.5, panicCap: 2.4 },
  average: { speedRange: [1.1, 1.7], reactionMultiplier: 1.0, panicCap: 2.0 },
  slow:    { speedRange: [0.7, 1.1], reactionMultiplier: 1.7, panicCap: 1.4 },
}

const AGENT_TYPE_DISTRIBUTION: { type: AgentType; cumulative: number }[] = [
  { type: 'fast',    cumulative: 0.20 },
  { type: 'average', cumulative: 0.80 },
  { type: 'slow',    cumulative: 1.00 },
]

function rollAgentType(rand: () => number): AgentType {
  const r = rand()
  for (const entry of AGENT_TYPE_DISTRIBUTION) {
    if (r < entry.cumulative) return entry.type
  }
  return 'average'
}

export interface Agent {
  id: string
  currentNodeId: string
  targetExitId: string | null
  path: string[]
  pathIndex: number
  progress: number
  speed: number
  type: AgentType
  state: 'waiting' | 'moving' | 'rerouting' | 'evacuated' | 'trapped'
  reactionDelay: number
  elapsedWait: number
  hazardExposure: number
  reroutes: number
  history: { nodeId: string; time: number }[]
  fireDose: number
  retreatCooldown: number
  threatRerouteCooldown: number
  isUserAgent?: boolean
  preferredDoorId?: string
  routingJitter: number
  rerouteStallTime: number
  rerouteAnchor?: { x: number; y: number; nodeId: string; progress: number; distance: number }
}

export interface CongestionState {
  edgeCounts: Record<string, number>
  nodeCounts: Record<string, number>
}

export interface ActiveHazard {
  zone: HazardZone
  currentRadius: number
  active: boolean
}

export interface SimulationState {
  agents: Agent[]
  hazards: ActiveHazard[]
  congestion: CongestionState
  elapsedTime: number
  hazardGrowthMultiplier: number
  blockedEdges: Set<string>
  softBlockedEdges: Set<string>
  threatenedEdges: Set<string>
  reachableFromExit: Set<string>
  running: boolean
  finished: boolean
  disasterType: 'fire' | 'earthquake'
}

export const EARTHQUAKE_TREMOR_DURATION = 10
const EARTHQUAKE_TREMOR_SPEED_MULTIPLIER = 0.3

export function isInTremorPhase(state: SimulationState): boolean {
  return state.disasterType === 'earthquake' && state.elapsedTime < EARTHQUAKE_TREMOR_DURATION
}

export function getTremorTimeRemaining(state: SimulationState): number {
  if (!isInTremorPhase(state)) return 0
  return Math.max(0, EARTHQUAKE_TREMOR_DURATION - state.elapsedTime)
}

const SOFT_EDGE_COST_MULTIPLIER = 3.5
const CONGESTION_WEIGHT = 1.5
const EXIT_BIAS_PER_AGENT = 2.5
const THREAT_BUFFER_PX = 12
const THREATENED_EDGE_COST_MULTIPLIER = 5
const THREAT_LOOKAHEAD_EDGES = 3
const THREAT_REROUTE_COOLDOWN = 3
const FIRE_DANGER_RADIUS_MULTIPLIER = 1.4
const FIRE_DANGER_REROUTE_COOLDOWN = 4

// Soft queue model: over-capacity slows agents (never freezes), guaranteeing forward progress.
const EDGE_SLOTS_PER_METER = 2
const MIN_EDGE_SLOTS = 2
const NODE_CAPACITY_HEADROOM = 1.25
const CONGESTION_MIN_SPEED_FACTOR = 0.15

// Cumulative dose-response: fireDose accumulates inside hazards, decays slowly outside.
const INCAPACITATION_DOSE = 5.0
const DOSE_PER_SEC_INSIDE_FIRE = 1.0
const DOSE_PER_SEC_INSIDE_SMOKE_EDGE = 0.3
const DOSE_DECAY_RATE = 0.05
const DOSE_SPEED_DEGRADATION_START = 0.6

export interface SimConfig {
  disasterType: 'fire' | 'earthquake'
  agentsPerRoom: Record<string, number>
  hazardGrowthMultiplier?: number
  userPath?: string[]
  hazardOverrides?: HazardZone[]
  seed?: number
  quakeScenario?: QuakeScenario
}

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

function edgeCollapseProbability(magnitude: number): number {
  const m = Math.max(0, Math.min(1, magnitude))
  return Math.min(0.95, m * m * 1.1)
}

export type QuakeScenario = 'minor' | 'moderate' | 'severe'

const QUAKE_SCENARIO_RANGES: Record<QuakeScenario, [number, number]> = {
  minor: [0.25, 0.35],
  moderate: [0.55, 0.65],
  severe: [0.85, 0.95],
}

function rollQuakeMagnitude(scenario: QuakeScenario, rand: () => number): number {
  const [lo, hi] = QUAKE_SCENARIO_RANGES[scenario]
  return lo + rand() * (hi - lo)
}

const EARTHQUAKE_SHOCK_TIMES = [0, 18, 36]
const AFTERSHOCK_PROBABILITY_FACTOR = 0.5
const COLLAPSE_DEBRIS_RADIUS = 16
const COLLAPSE_DEBRIS_MAX_RADIUS = 26

function deferEarthquakeDebrisUntilAfterTremor(zone: HazardZone): HazardZone {
  if (zone.type !== 'debris' && zone.type !== 'blocked') return zone
  return {
    ...zone,
    appearsAt: Math.max(zone.appearsAt, EARTHQUAKE_TREMOR_DURATION),
  }
}

function edgesHardBlockedOnDrop(floor: FloorModel, zones: HazardZone[]): Set<string> {
  const blocked = new Set<string>()
  for (const zone of zones) {
    if (zone.type === 'smoke') continue
    const r = zone.radius
    for (const edge of floor.edges) {
      if (!edge.blockable) continue
      const from = getNode(floor, edge.from)
      const to = getNode(floor, edge.to)
      if (!from || !to) continue
      const mx = (from.x + to.x) / 2
      const my = (from.y + to.y) / 2
      if (Math.hypot(mx - zone.x, my - zone.y) < r) {
        blocked.add(edgeKey(edge.from, edge.to))
      }
    }
  }
  return blocked
}

function allRoomsCanReachExit(floor: FloorModel, blockedEdges: Set<string>): boolean {
  const noSoftBlocks = new Set<string>()
  for (const node of floor.nodes) {
    if (node.type !== 'room') continue
    if (!findShortestPathToExitWeighted(floor, node.id, blockedEdges, noSoftBlocks, 1)) {
      return false
    }
  }
  return true
}

function isCorridorSpineNode(node: NavNode | undefined): boolean {
  if (!node) return false
  if (node.kind === 'door') return false
  return node.type === 'corridor' || node.type === 'junction' || node.type === 'stairs'
}

function resolveFragileEdges(floor: FloorModel): NavEdge[] {
  const explicit = floor.edges.filter(e => e.fragile)
  const explicitKeys = new Set(explicit.map(e => edgeKey(e.from, e.to)))

  const spine = floor.edges
    .filter(e => {
      if (!e.blockable) return false
      if (explicitKeys.has(edgeKey(e.from, e.to))) return false
      return isCorridorSpineNode(getNode(floor, e.from))
        && isCorridorSpineNode(getNode(floor, e.to))
    })
    .sort((a, b) => b.distance - a.distance)

  const spanCount = Math.min(6, Math.max(2, Math.round(spine.length * 0.4)))
  return [...explicit, ...spine.slice(0, spanCount)]
}

function generateEarthquakeCollapses(
  floor: FloorModel,
  magnitude: number,
  rand: () => number,
  authoredHazards: HazardZone[],
): HazardZone[] {
  const fragileEdges = resolveFragileEdges(floor)
  if (fragileEdges.length === 0) return []

  const baseProb = edgeCollapseProbability(magnitude)
  const collapsed = new Set<string>()
  const zones: HazardZone[] = []
  let idx = 0

  for (const shockTime of EARTHQUAKE_SHOCK_TIMES) {
    const shockProb = shockTime === 0 ? baseProb : baseProb * AFTERSHOCK_PROBABILITY_FACTOR
    for (const edge of fragileEdges) {
      const key = edgeKey(edge.from, edge.to)
      if (collapsed.has(key)) continue
      if (rand() >= shockProb) continue
      collapsed.add(key)
      const from = getNode(floor, edge.from)
      const to = getNode(floor, edge.to)
      if (!from || !to) continue
      zones.push({
        id: `quake-collapse-${idx++}`,
        type: 'debris',
        x: (from.x + to.x) / 2,
        y: (from.y + to.y) / 2,
        radius: COLLAPSE_DEBRIS_RADIUS,
        growthRate: hazardGrowthRate('debris'),
        appearsAt: shockTime,
        maxRadius: COLLAPSE_DEBRIS_MAX_RADIUS,
      })
    }
  }

  while (zones.length > 0) {
    const blocked = edgesHardBlockedOnDrop(floor, [...authoredHazards, ...zones])
    if (allRoomsCanReachExit(floor, blocked)) break
    zones.pop()
  }

  return zones
}

export function createSimulation(
  floor: FloorModel,
  config: SimConfig,
): SimulationState {
  const agents: Agent[] = []
  let agentIdx = 0

  const rand = config.seed != null ? createSeededRng(config.seed) : Math.random
  const randomAgentSpeed = (type: AgentType) => {
    const [lo, hi] = AGENT_TYPE_CONFIG[type].speedRange
    return lo + rand() * (hi - lo)
  }

  const doorIdsByRoom = new Map<string, string[]>()
  for (const edge of floor.edges) {
    const from = getNode(floor, edge.from)
    const to = getNode(floor, edge.to)
    if (!from || !to) continue
    if (from.type === 'room' && to.kind === 'door') {
      const list = doorIdsByRoom.get(from.id) ?? []
      list.push(to.id)
      doorIdsByRoom.set(from.id, list)
    }
    if (to.type === 'room' && from.kind === 'door') {
      const list = doorIdsByRoom.get(to.id) ?? []
      list.push(from.id)
      doorIdsByRoom.set(to.id, list)
    }
  }
  for (const [roomId, list] of doorIdsByRoom.entries()) {
    doorIdsByRoom.set(roomId, Array.from(new Set(list)).sort())
  }

  const isQuake = config.disasterType === 'earthquake'
  const reactionMin = isQuake ? 6 : 0.5
  const reactionRange = isQuake ? 12 : 3.5

  const roomEntries = Object.entries(config.agentsPerRoom).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  for (const [roomId, count] of roomEntries) {
    const room = getNode(floor, roomId)
    if (!room) continue

    const doorIds = doorIdsByRoom.get(roomId) ?? []
    const useDoorSplit = doorIds.length > 1

    for (let i = 0; i < count; i++) {
      const type = rollAgentType(rand)
      const typeConfig = AGENT_TYPE_CONFIG[type]
      const reactionDelay = (reactionMin + rand() * reactionRange) * typeConfig.reactionMultiplier
      const speed = randomAgentSpeed(type)
      const preferredDoorId = useDoorSplit ? doorIds[i % doorIds.length] : undefined

      agents.push({
        id: `agent-${agentIdx++}`,
        currentNodeId: roomId,
        targetExitId: null,
        path: [],
        pathIndex: 0,
        progress: 0,
        speed,
        type,
        state: 'waiting',
        reactionDelay,
        elapsedWait: 0,
        hazardExposure: 0,
        reroutes: 0,
        history: [{ nodeId: roomId, time: 0 }],
        preferredDoorId,
        routingJitter: 0.85 + rand() * 0.30,
        rerouteStallTime: 0,
        rerouteAnchor: undefined,
        fireDose: 0,
        retreatCooldown: 0,
        threatRerouteCooldown: 0,
      })
    }
  }

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
      speed: randomAgentSpeed('average'),
      type: 'average',
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
      fireDose: 0,
      retreatCooldown: 0,
      threatRerouteCooldown: 0,
    })
  }

  const authoredHazards = config.hazardOverrides ?? (floor.hazards[config.disasterType] || [])
  const collapseHazards =
    config.disasterType === 'earthquake' && config.quakeScenario != null
      ? generateEarthquakeCollapses(
          floor,
          rollQuakeMagnitude(config.quakeScenario, rand),
          rand,
          authoredHazards,
        )
      : []
  const hazardDefs = config.disasterType === 'earthquake'
    ? [...authoredHazards, ...collapseHazards].map(deferEarthquakeDebrisUntilAfterTremor)
    : [...authoredHazards, ...collapseHazards]
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
    threatenedEdges: new Set(),
    reachableFromExit: new Set(floor.nodes.map(n => n.id)),
    running: false,
    finished: false,
    disasterType: config.disasterType,
  }
}

export function stepSimulation(
  state: SimulationState,
  floor: FloorModel,
  dt: number,
): SimulationState {
  const newState = { ...state, elapsedTime: state.elapsedTime + dt }

  updateHazards(newState)
  updateBlockedEdges(newState, floor)
  updateExitReachability(newState, floor)
  updateCongestion(newState)

  const liveEdgeCounts: Record<string, number> = { ...newState.congestion.edgeCounts }
  const liveNodeCounts: Record<string, number> = { ...newState.congestion.nodeCounts }
  const agentsByPriority = [...newState.agents].sort((a, b) => a.progress - b.progress)

  for (const agent of agentsByPriority) {
    updateAgent(agent, newState, floor, dt, liveEdgeCounts, liveNodeCounts)
  }

  const activeAgents = newState.agents.filter(a => a.state !== 'evacuated' && a.state !== 'trapped')
  if (activeAgents.length === 0) {
    newState.finished = true
    newState.running = false
  }

  return newState
}

function buildHazardForecasts(state: SimulationState): HazardForecast[] {
  const forecasts: HazardForecast[] = []
  for (const h of state.hazards) {
    forecasts.push({
      type: h.zone.type,
      x: h.zone.x,
      y: h.zone.y,
      radius: h.zone.radius,
      growthRate: h.zone.growthRate * state.hazardGrowthMultiplier,
      maxRadius: h.zone.maxRadius,
      appearsAt: h.zone.appearsAt,
      currentRadius: h.currentRadius,
      active: h.active,
    })
  }
  return forecasts
}

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

function updateBlockedEdges(state: SimulationState, floor: FloorModel) {
  state.blockedEdges.clear()
  state.softBlockedEdges.clear()
  state.threatenedEdges.clear()

  for (const h of state.hazards) {
    if (!h.active) continue
    const r = h.currentRadius
    const isSoft = h.zone.type === 'smoke'
    const threatRadius = isSoft ? r : r + THREAT_BUFFER_PX

    for (const edge of floor.edges) {
      if (!edge.blockable) continue
      const fromNode = getNode(floor, edge.from)
      const toNode = getNode(floor, edge.to)
      if (!fromNode || !toNode) continue

      const mx = (fromNode.x + toNode.x) / 2
      const my = (fromNode.y + toNode.y) / 2
      const dist = Math.hypot(mx - h.zone.x, my - h.zone.y)
      if (dist >= threatRadius) continue

      const key = edgeKey(edge.from, edge.to)
      if (isSoft) {
        if (!state.blockedEdges.has(key)) state.softBlockedEdges.add(key)
      } else if (dist < r) {
        state.blockedEdges.add(key)
        state.softBlockedEdges.delete(key)
        state.threatenedEdges.delete(key)
      } else if (!state.blockedEdges.has(key)) {
        state.threatenedEdges.add(key)
      }
    }
  }
}

function updateExitReachability(state: SimulationState, floor: FloorModel) {
  const reachable = new Set<string>()
  const queue: string[] = []
  for (const node of floor.nodes) {
    if (node.type === 'exit') {
      reachable.add(node.id)
      queue.push(node.id)
    }
  }
  const adjacency: Record<string, { neighbor: string; key: string }[]> = {}
  for (const edge of floor.edges) {
    const key = edgeKey(edge.from, edge.to)
    ;(adjacency[edge.from] ||= []).push({ neighbor: edge.to, key })
    ;(adjacency[edge.to]   ||= []).push({ neighbor: edge.from, key })
  }
  while (queue.length > 0) {
    const current = queue.shift() as string
    const adj = adjacency[current]
    if (!adj) continue
    for (const { neighbor, key } of adj) {
      if (reachable.has(neighbor)) continue
      if (state.blockedEdges.has(key)) continue
      reachable.add(neighbor)
      queue.push(neighbor)
    }
  }
  state.reachableFromExit = reachable
}

function agentHasEscapeRoute(agent: Agent, state: SimulationState): boolean {
  return state.reachableFromExit.has(agent.currentNodeId)
}

function updateCongestion(state: SimulationState) {
  const nodeCounts: Record<string, number> = {}
  const edgeCounts: Record<string, number> = {}

  for (const agent of state.agents) {
    if (agent.state === 'evacuated' || agent.state === 'trapped') continue

    if (agent.progress === 0) {
      nodeCounts[agent.currentNodeId] = (nodeCounts[agent.currentNodeId] || 0) + 1
    }

    if (agent.progress > 0 && agent.pathIndex < agent.path.length - 1) {
      const ek = edgeKey(agent.path[agent.pathIndex], agent.path[agent.pathIndex + 1])
      edgeCounts[ek] = (edgeCounts[ek] || 0) + 1
    }
  }

  state.congestion = { nodeCounts, edgeCounts }
}

function remainingPathHasHardBlock(path: string[], pathIndex: number, blockedEdges: Set<string>): boolean {
  for (let i = pathIndex; i < path.length - 1; i++) {
    if (blockedEdges.has(edgeKey(path[i], path[i + 1]))) return true
  }
  return false
}

function remainingPathHasThreatenedEdge(
  path: string[],
  pathIndex: number,
  threatenedEdges: Set<string>,
  lookahead: number,
): boolean {
  if (threatenedEdges.size === 0) return false
  const end = Math.min(path.length - 1, pathIndex + lookahead)
  for (let i = pathIndex; i < end; i++) {
    if (threatenedEdges.has(edgeKey(path[i], path[i + 1]))) return true
  }
  return false
}

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

function findHazardCompromisedExits(
  floor: FloorModel,
  state: SimulationState,
): Set<string> {
  const compromised = new Set<string>()
  if (state.hazards.length === 0) return compromised
  for (const node of floor.nodes) {
    if (node.type !== 'exit') continue
    for (const h of state.hazards) {
      if (!h.active) continue
      if (h.zone.type !== 'fire') continue
      const dangerRadius = h.currentRadius * FIRE_DANGER_RADIUS_MULTIPLIER
      if (Math.hypot(node.x - h.zone.x, node.y - h.zone.y) < dangerRadius) {
        compromised.add(node.id)
        break
      }
    }
  }
  return compromised
}

function replanAgent(
  agent: Agent,
  state: SimulationState,
  floor: FloorModel,
  excludeExitIds?: Set<string>,
  forbiddenNodeIds?: Set<string>,
): boolean {
  agent.progress = 0

  const compromisedExits = findHazardCompromisedExits(floor, state)
  let effectiveExcludeExits = excludeExitIds
  if (compromisedExits.size > 0) {
    effectiveExcludeExits = new Set<string>(compromisedExits)
    if (excludeExitIds) {
      for (const id of excludeExitIds) effectiveExcludeExits.add(id)
    }
  }

  let effectiveForbiddenNodes = forbiddenNodeIds
  if (!effectiveForbiddenNodes && agent.history.length >= 2) {
    const prev = agent.history[agent.history.length - 2]
    if (prev?.nodeId && prev.nodeId !== agent.currentNodeId) {
      effectiveForbiddenNodes = new Set<string>([prev.nodeId])
    }
  }

  const hazardForecasts = buildHazardForecasts(state)
  const planFrom = (
    startId: string,
    forbidden?: Set<string>,
    excludeOverride?: Set<string>,
  ) => findShortestPathToExitWeighted(
    floor,
    startId,
    state.blockedEdges,
    state.softBlockedEdges,
    SOFT_EDGE_COST_MULTIPLIER,
    {
      edgeCounts: state.congestion.edgeCounts,
      congestionWeight: CONGESTION_WEIGHT,
      jitter: agent.routingJitter,
      exitBias: buildExitBias(state),
      threatenedEdges: state.threatenedEdges,
      threatPenalty: THREATENED_EDGE_COST_MULTIPLIER,
      excludeExitIds: excludeOverride !== undefined ? excludeOverride : effectiveExcludeExits,
      forbiddenNodeIds: forbidden,
      hazards: hazardForecasts,
      agentSpeed: agent.speed,
      elapsedTime: state.elapsedTime,
      futureHazardPenalty: 6,
    },
  )

  if (agent.preferredDoorId) {
    const currentNode = getNode(floor, agent.currentNodeId)
    const doorNode = getNode(floor, agent.preferredDoorId)
    const hasDoorEdge = currentNode?.type === 'room' && doorNode
      ? floor.edges.some((edge) => (
        (edge.from === agent.currentNodeId && edge.to === agent.preferredDoorId) ||
        (edge.to === agent.currentNodeId && edge.from === agent.preferredDoorId)
      ))
      : false

    if (hasDoorEdge) {
      const result = planFrom(agent.preferredDoorId, effectiveForbiddenNodes)
      if (result) {
        agent.path = [agent.currentNodeId, ...result.path]
        agent.pathIndex = 0
        agent.targetExitId = result.exitId
        return true
      }
    }
  }

  const result = planFrom(agent.currentNodeId, effectiveForbiddenNodes)
  if (!result) {
    // If the forbidden-nodes set killed every path (fire surrounds the
    // agent on all sides, OR our default no-U-turn guard is preventing
    // escape), retry without forbidden nodes — better to backtrack one
    // node than be permanently stuck.
    if (effectiveForbiddenNodes && effectiveForbiddenNodes.size > 0) {
      const fallback = planFrom(agent.currentNodeId, undefined)
      if (fallback) {
        agent.path = fallback.path
        agent.pathIndex = 0
        agent.targetExitId = fallback.exitId
        return true
      }
    }
    // Same idea for excludeExitIds — release the ban (including the
    // hazard-compromised exits) as a last resort so the agent has
    // *some* exit to head toward rather than being declared trapped.
    if (effectiveExcludeExits && effectiveExcludeExits.size > 0) {
      const fallback = planFrom(agent.currentNodeId, undefined, new Set<string>())
      if (fallback) {
        agent.path = fallback.path
        agent.pathIndex = 0
        agent.targetExitId = fallback.exitId
        return true
      }
    }
    return false
  }
  agent.path = result.path
  agent.pathIndex = 0
  agent.targetExitId = result.exitId
  return true
}

function findFireProximityDanger(
  agent: Agent,
  floor: FloorModel,
  state: SimulationState,
): { triggered: boolean; excludeExits: Set<string>; forbiddenNodes: Set<string> } {
  const empty = { triggered: false, excludeExits: new Set<string>(), forbiddenNodes: new Set<string>() }
  if (agent.state === 'evacuated' || agent.state === 'trapped') return empty
  if (!agent.targetExitId) return empty

  const targetExit = getNode(floor, agent.targetExitId)
  if (!targetExit) return empty

  for (const h of state.hazards) {
    if (!h.active || h.zone.type !== 'fire') continue
    const dangerRadius = h.currentRadius * FIRE_DANGER_RADIUS_MULTIPLIER
    if (Math.hypot(targetExit.x - h.zone.x, targetExit.y - h.zone.y) < dangerRadius) {
      return {
        triggered: true,
        excludeExits: new Set([agent.targetExitId]),
        forbiddenNodes: new Set(),
      }
    }
  }
  return empty
}

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

/** Capacity in agents for an edge, derived from its physical width.
 *  Anything narrower than MIN_EDGE_SLOTS is clamped up so degenerate
 *  geometries don't gridlock the building. */
function edgeSlotCapacity(width: number): number {
  return Math.max(MIN_EDGE_SLOTS, Math.floor(width * EDGE_SLOTS_PER_METER))
}

/** Effective speed multiplier from cumulative hazard dose. Below 60% of the
 *  trap threshold the agent is unaffected. Past 60% they degrade linearly
 *  down to 55% of base speed at 100% threshold — fatigue, disorientation,
 *  impaired vision from heat / smoke. */
function doseSpeedFactor(dose: number): number {
  const ratio = dose / INCAPACITATION_DOSE
  if (ratio < DOSE_SPEED_DEGRADATION_START) return 1
  const t = Math.min(1, (ratio - DOSE_SPEED_DEGRADATION_START) / (1 - DOSE_SPEED_DEGRADATION_START))
  return 1 - t * 0.45
}

/* ── Agent update ── */
function updateAgent(
  agent: Agent,
  state: SimulationState,
  floor: FloorModel,
  dt: number,
  liveEdgeCounts: Record<string, number>,
  liveNodeCounts: Record<string, number>,
) {
  if (agent.state === 'evacuated' || agent.state === 'trapped') return

  if (agent.retreatCooldown > 0) {
    agent.retreatCooldown = Math.max(0, agent.retreatCooldown - dt)
  }
  if (agent.threatRerouteCooldown > 0) {
    agent.threatRerouteCooldown = Math.max(0, agent.threatRerouteCooldown - dt)
  }

  if (agent.rerouteAnchor && agent.rerouteAnchor.progress < 1) {
    const anchor = agent.rerouteAnchor
    if (anchor.distance > 0) {
      let anchorPanic = 1
      for (const h of state.hazards) {
        if (!h.active) continue
        const isHard = h.zone.type === 'fire' || h.zone.type === 'debris' || h.zone.type === 'blocked'
        const d = Math.hypot(anchor.x - h.zone.x, anchor.y - h.zone.y)
        if (isHard) {
          if (d < h.currentRadius) anchorPanic = Math.max(anchorPanic, 2.4)
          else if (d < h.currentRadius * 1.8) anchorPanic = Math.max(anchorPanic, 1.75)
        } else if (d < h.currentRadius * 1.5) {
          anchorPanic = Math.max(anchorPanic, 1.25)
        }
      }
      anchor.progress = Math.min(1, anchor.progress + (agent.speed * anchorPanic * dt) / anchor.distance)
    } else {
      anchor.progress = 1
    }
    if (anchor.progress >= 1) {
      agent.rerouteAnchor = undefined
    }
    return
  }

  if (agent.state === 'waiting') {
    agent.elapsedWait += dt
    if (agent.elapsedWait < agent.reactionDelay) return

    if (agent.isUserAgent && agent.path.length >= 2) {
      agent.state = 'moving'
      return
    }

    if (!replanAgent(agent, state, floor)) {
      agent.state = 'rerouting'
      agent.rerouteStallTime = 0
      return
    }
    agent.state = 'moving'
    return
  }

  if (agent.state === 'rerouting') {
    if (replanAgent(agent, state, floor)) {
      agent.state = 'moving'
      agent.rerouteStallTime = 0
      if (agent.threatRerouteCooldown <= 0) {
        agent.threatRerouteCooldown = 2
      }
    } else {
      agent.rerouteStallTime += dt
      if (agent.retreatCooldown <= 0 && (agentIsInsideHardHazard(agent, floor, state) || agent.rerouteStallTime >= 2)) {
        if (retreatOneNode(agent, floor)) {
          agent.retreatCooldown = 1.2
          agent.rerouteStallTime = 0
        }
      }
      if (agent.rerouteStallTime >= 10) {
        if (!agentHasEscapeRoute(agent, state)) {
          agent.state = 'trapped'
        } else {
          agent.rerouteStallTime = 0
          agent.threatRerouteCooldown = 0
          agent.retreatCooldown = 0
        }
      }
    }
    return
  }

  if (agent.state === 'moving' && agent.pathIndex < agent.path.length - 1) {
    const nextEdgeKey = edgeKey(agent.path[agent.pathIndex], agent.path[agent.pathIndex + 1])
    const nextHardBlocked = state.blockedEdges.has(nextEdgeKey)
    const aheadHardBlocked = !nextHardBlocked && remainingPathHasHardBlock(agent.path, agent.pathIndex, state.blockedEdges)
    const threatTriggered =
      !agent.isUserAgent &&
      !nextHardBlocked &&
      !aheadHardBlocked &&
      agent.threatRerouteCooldown <= 0 &&
      remainingPathHasThreatenedEdge(agent.path, agent.pathIndex, state.threatenedEdges, THREAT_LOOKAHEAD_EDGES)

    const proximityDanger = !agent.isUserAgent && !nextHardBlocked && !aheadHardBlocked
      ? findFireProximityDanger(agent, floor, state)
      : { triggered: false, excludeExits: new Set<string>(), forbiddenNodes: new Set<string>() }
    const fireProximityTriggered =
      proximityDanger.triggered &&
      agent.threatRerouteCooldown <= 0 &&
      proximityDanger.excludeExits.size > 0

    if (nextHardBlocked || aheadHardBlocked || threatTriggered || fireProximityTriggered) {
      if (agent.isUserAgent) {
        // User-drawn path is fixed — but only declare them trapped when no
        // exit is reachable at all. If a path exists through the residual
        // graph, the user agent stays in 'moving' state and walks until
        // they physically reach the blockage; the evaluator reports their
        // chosen route failed without flat-out removing them from the run
        // the instant a remote edge gets blocked.
        if (nextHardBlocked && !agentHasEscapeRoute(agent, state)) {
          agent.state = 'trapped'
          return
        }
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
        const replanExcludes = fireProximityTriggered ? proximityDanger.excludeExits : undefined
        if (replanAgent(agent, state, floor, replanExcludes)) {
          agent.state = 'moving'
        }
        if (fireProximityTriggered) {
          agent.threatRerouteCooldown = FIRE_DANGER_REROUTE_COOLDOWN
        } else if (threatTriggered) {
          agent.threatRerouteCooldown = THREAT_REROUTE_COOLDOWN
        } else {
          agent.threatRerouteCooldown = Math.max(agent.threatRerouteCooldown, 1.5)
        }
        return
      }
    }
  }

  if (agent.state === 'moving' || agent.state === 'rerouting') {
    if (agent.pathIndex >= agent.path.length - 1) {
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

    const edge = floor.edges.find(
      e => (e.from === fromId && e.to === toId) || (e.from === toId && e.to === fromId),
    )
    const edgeDist = edge?.distance || 10

    const ek = edgeKey(fromId, toId)
    const edgeWidth = edge?.width || 2

    const slotCap = edgeSlotCapacity(edgeWidth)
    const isAlreadyOnEdge = agent.progress > 0
    if (!isAlreadyOnEdge) {
      liveEdgeCounts[ek] = (liveEdgeCounts[ek] || 0) + 1
      liveNodeCounts[fromId] = Math.max(0, (liveNodeCounts[fromId] || 1) - 1)
    }

    const edgeCount = liveEdgeCounts[ek] || 0
    const congestionFactor = edgeCount <= slotCap
      ? 1
      : Math.max(CONGESTION_MIN_SPEED_FACTOR, slotCap / edgeCount)

    const destLoad = liveNodeCounts[toId] || 0
    const destCap = Math.max(1, toNode.capacity) * NODE_CAPACITY_HEADROOM
    const destCongestionFactor = (toNode.type === 'exit' || destLoad <= destCap)
      ? 1
      : Math.max(CONGESTION_MIN_SPEED_FACTOR, destCap / destLoad)

    const ax = fromNode.x + (toNode.x - fromNode.x) * agent.progress
    const ay = fromNode.y + (toNode.y - fromNode.y) * agent.progress

    let smokeFactor = 1.0
    let panicFactor = 1.0
    let insideHardHazard = false
    const panicCap = AGENT_TYPE_CONFIG[agent.type].panicCap

    for (const h of state.hazards) {
      if (!h.active) continue
      const dist = Math.hypot(ax - h.zone.x, ay - h.zone.y)
      const isHardHazard = h.zone.type === 'fire' || h.zone.type === 'debris' || h.zone.type === 'blocked'

      if (isHardHazard) {
        if (dist < h.currentRadius) {
          insideHardHazard = true
          panicFactor = Math.max(panicFactor, Math.min(panicCap, 2.4))
          agent.hazardExposure += dt * 2
        } else if (dist < h.currentRadius * 1.8) {
          panicFactor = Math.max(panicFactor, Math.min(panicCap, 1.75))
        }
      } else if (dist < h.currentRadius * 1.5) {
        panicFactor = Math.max(panicFactor, Math.min(panicCap, 1.25))
        agent.hazardExposure += dt
      }
    }

    if (state.softBlockedEdges.has(ek)) {
      smokeFactor = Math.min(smokeFactor, 0.5)
      agent.hazardExposure += dt
    }

    const hazardFactor = panicFactor > 1 ? panicFactor : smokeFactor

    const tremorFactor = isInTremorPhase(state) ? EARTHQUAKE_TREMOR_SPEED_MULTIPLIER : 1

    if (insideHardHazard) {
      agent.fireDose += DOSE_PER_SEC_INSIDE_FIRE * dt
    } else if (state.softBlockedEdges.has(ek)) {
      agent.fireDose += DOSE_PER_SEC_INSIDE_SMOKE_EDGE * dt
    } else {
      agent.fireDose = Math.max(0, agent.fireDose - DOSE_DECAY_RATE * dt)
    }
    if (agent.fireDose >= INCAPACITATION_DOSE) {
      if (!agentHasEscapeRoute(agent, state)) {
        agent.state = 'trapped'
        return
      }
      agent.fireDose = INCAPACITATION_DOSE
      if (insideHardHazard && agent.retreatCooldown <= 0) {
        if (retreatOneNode(agent, floor)) {
          agent.retreatCooldown = 1.5
          agent.state = 'rerouting'
          agent.rerouteStallTime = 0
          return
        }
      }
    }
    const doseFactor = doseSpeedFactor(agent.fireDose)

    const effectiveSpeed =
      agent.speed * congestionFactor * destCongestionFactor * hazardFactor * tremorFactor * doseFactor
    agent.progress += (effectiveSpeed * dt) / edgeDist

    if (agent.progress >= 1) {
      liveEdgeCounts[ek] = Math.max(0, (liveEdgeCounts[ek] || 1) - 1)
      liveNodeCounts[toId] = (liveNodeCounts[toId] || 0) + 1

      agent.progress = 0
      agent.pathIndex++
      agent.currentNodeId = toId
      agent.state = 'moving'
      agent.history.push({ nodeId: toId, time: state.elapsedTime })

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

