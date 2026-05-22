/**
 * EVACSIM — Simulation Engine
 *
 * Manages agent movement along the navigation graph,
 * hazard progression, congestion modeling, and evaluation.
 */

import type { FloorModel, HazardForecast, HazardZone } from './building-model'
import { getNode, findShortestPathToExitWeighted, edgeKey } from './building-model'
import { hazardGrowthRate } from './hazard-physics'

/* ── Behavioral agent types ──
 *
 * Real evacuees are not uniform. Some respond to the alarm immediately and
 * move quickly; most move at average pace with a normal reaction delay; a
 * minority freeze, follow others, or move slowly due to mobility limits.
 * Modeling these three populations meaningfully changes flow dynamics —
 * a queue forms behind slow agents, fast agents thin out the crowd, and the
 * tail of evacuation time is driven by the slow class.
 *
 * Distribution defaults: 20% fast / 60% average / 20% slow. The seeded RNG
 * picks the type so replays reconstruct the same population.
 */
export type AgentType = 'fast' | 'average' | 'slow'

/** Per-type tuning. Speed range narrows around realistic walking speeds
 *  (~0.8–1.5 m/s flat-ground human walk; fast responders sprint). Reaction
 *  delay is a multiplier on the disaster's base reaction window. Panic cap
 *  bounds the in-fire panic speed multiplier so slow agents can't suddenly
 *  sprint past the average class — fatigue, age, mobility all factor in. */
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
  /** Behavioral class — drives speed range, reaction-delay scaling, and
   *  the upper bound on panic-mode speed boost. */
  type: AgentType
  state: 'waiting' | 'moving' | 'rerouting' | 'evacuated' | 'trapped'
  reactionDelay: number // seconds before starting to move
  elapsedWait: number
  /** Accumulated hazard exposure */
  hazardExposure: number
  /** Number of reroutes taken */
  reroutes: number
  /** History of visited nodes with timestamps */
  history: { nodeId: string; time: number }[]
  /** Cumulative dose-units of fire exposure. Each second inside a hard hazard
   *  adds 1.0; each second inside smoke adds 0.3. Decays VERY slowly when the
   *  agent is clear of hazards (5% per second) so a brush with fire that
   *  didn't trap the agent still degrades their next re-entry. Trapped when
   *  dose ≥ INCAPACITATION_DOSE; speed reduces gradually past 60% threshold. */
  fireDose: number
  /** Cumulative seconds since the last attempt to retreat out of a fire so
   *  we don't oscillate retreating every tick. */
  retreatCooldown: number
  /** Seconds remaining on the agent's commit window after a predictor-driven
   *  reroute. While >0 they won't re-evaluate the threat predictor again, so
   *  near-equal alternatives don't ping-pong. Hard-block reroutes ignore it. */
  threatRerouteCooldown: number
  /** Whether this agent uses a fixed user-drawn path (no auto-reroute) */
  isUserAgent?: boolean
  /** Preferred door node for rooms with multiple doors (initial routing only). */
  preferredDoorId?: string
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
  /** Edges in the THREAT zone of an active hard hazard — within
   *  `currentRadius + THREAT_BUFFER_PX` but not yet inside the radius. The
   *  predictor warning zone: agents pathfind with a heavy cost penalty on
   *  these and reroute proactively when their committed path passes through
   *  one, rather than waiting for the hazard to actually swallow the edge. */
  threatenedEdges: Set<string>
  /** Nodes from which SOME exit is reachable through the residual graph
   *  (i.e. ignoring hard-blocked edges only). Recomputed once per tick by a
   *  single BFS from every exit. This is the canonical "can this agent still
   *  evacuate?" test used by every trap-decision site — an agent is only
   *  declared `trapped` when their `currentNodeId` is NOT in this set, i.e.
   *  the fire / debris graph has structurally severed them from every exit.
   *  Smoke, congestion, threat penalties, and high fire dose do NOT remove a
   *  node from this set — those are slowdowns, not severs. */
  reachableFromExit: Set<string>
  /** Is the simulation running */
  running: boolean
  /** Is the simulation finished */
  finished: boolean
  /** Active disaster type. Drives behavior gated on quake vs fire — currently
   *  the tremor-phase movement penalty and the agent reaction-delay window. */
  disasterType: 'fire' | 'earthquake'
}

/** Seconds of "shaking" at the start of an earthquake run during which
 *  movement is sharply reduced. Models the period where the ground itself is
 *  still moving — occupants who do start walking can only shuffle. After this
 *  window, normal movement resumes. */
const EARTHQUAKE_TREMOR_DURATION = 8
/** Movement multiplier applied to any agent that's mid-walk during the tremor
 *  window. Bounded above 0 so tremor agents still progress, just slowly. */
const EARTHQUAKE_TREMOR_SPEED_MULTIPLIER = 0.3

/** True while the earthquake tremor window is still ramping — used by the
 *  agent loop to clamp movement speed and by the UI to badge "Tremor active." */
export function isInTremorPhase(state: SimulationState): boolean {
  return state.disasterType === 'earthquake' && state.elapsedTime < EARTHQUAKE_TREMOR_DURATION
}

export function getTremorTimeRemaining(state: SimulationState): number {
  if (!isInTremorPhase(state)) return 0
  return Math.max(0, EARTHQUAKE_TREMOR_DURATION - state.elapsedTime)
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

/** Predictor / proactive avoidance.
 *  Pixels of buffer beyond a hard hazard's current radius where an edge is
 *  flagged as "threatened". Sized to roughly one growth-period of typical
 *  hazards — enough lead time for agents to detour, small enough that the
 *  threat ring doesn't swallow most of the graph when several hazards are
 *  active simultaneously. */
const THREAT_BUFFER_PX = 12

/** Cost multiplier applied to threatened edges during path search. Higher
 *  than SOFT_EDGE_COST_MULTIPLIER because walking next to a growing fire is
 *  worse than walking through smoke — but still finite so agents take a
 *  threatened path when it's the only way out. */
const THREATENED_EDGE_COST_MULTIPLIER = 5

/** How many edges ahead the predictor looks when deciding whether to reroute
 *  proactively. Threats further along the committed path are ignored — by
 *  the time the agent reaches them, the situation will have changed and
 *  another check will fire if it's still relevant. Keeps the trigger from
 *  thrashing on distant hazards that don't yet matter. */
const THREAT_LOOKAHEAD_EDGES = 3

/** Seconds an agent commits to a freshly-replanned path after a threat
 *  reroute before re-checking the threat predictor. Prevents oscillation
 *  when the alternative is also (slightly) threatened — the agent goes,
 *  rather than thrashing between two near-equal options. Hard-block reroutes
 *  bypass this cooldown because their path is actually severed. */
const THREAT_REROUTE_COOLDOWN = 3

/** Fire-hazard "danger zone" multiplier. When an agent's interpolated
 *  position is within `currentRadius * FIRE_DANGER_RADIUS_MULTIPLIER` of an
 *  active fire (smoke is excluded — agents walk through smoke), they
 *  immediately replan toward a different exit. The multiplier is greater
 *  than 1 so the agent reacts before they're actually inside the flames,
 *  giving them lead time to redirect to a safer route. */
const FIRE_DANGER_RADIUS_MULTIPLIER = 1.4

/** Seconds an agent commits to the new path after a fire-proximity reroute.
 *  Same purpose as THREAT_REROUTE_COOLDOWN but specifically for the
 *  proximity-triggered "find another exit" reroute — long enough to clear
 *  the danger zone, short enough that the agent re-evaluates if the new
 *  path also takes them near another fire. */
const FIRE_DANGER_REROUTE_COOLDOWN = 4

/* ── Soft queue model + congestion-based capacity ──
 *
 * An earlier revision used HARD gates: an agent could not step onto a full
 * edge (it waited at the source) and could not enter a full node (it froze
 * at 95% of the edge). That produced realistic-looking queues but also
 * produced DEADLOCKS — when nodes ended up waiting on each other in a cycle,
 * a crowd of agents could freeze permanently and never evacuate.
 *
 * The model is now SOFT. Capacity still matters, but it is expressed as a
 * speed penalty, never a freeze:
 *   • An over-capacity edge slows every agent on it toward a 15% crawl.
 *   • An over-capacity destination node slows the agent's approach the
 *     same way.
 * Agents always make some forward progress, so a crowd ALWAYS drains and
 * no agent is ever permanently stuck. Visually a queue still forms — a
 * slow, dense bunch of agents — and the congestion still drives bottleneck
 * analytics (edge counts, density heatmap, longer evacuation times).
 *
 * EDGE_SLOTS_PER_METER sets an edge's comfortable capacity (agents that fit
 * before the slowdown kicks in); NODE_CAPACITY_HEADROOM does the same for
 * nodes. CONGESTION_MIN_SPEED_FACTOR is the crawl floor — speed never drops
 * below this fraction from crowding alone. */
const EDGE_SLOTS_PER_METER = 2
/** Minimum comfortable capacity for any edge, even narrow ones. */
const MIN_EDGE_SLOTS = 2
/** Multiplier on each node's authored capacity before the crowding
 *  slowdown begins — a little headroom for agents passing through. */
const NODE_CAPACITY_HEADROOM = 1.25
/** Crawl floor: crowding alone never slows an agent below this fraction of
 *  their walking speed. Guarantees forward progress → no deadlock. */
const CONGESTION_MIN_SPEED_FACTOR = 0.15

/* ── Cumulative exposure (dose-response trap model) ──
 *
 * Previously, an agent inside fire accumulated `timeInsideFire` which decayed
 * at 0.5 per second outside the hazard — so a 2.9s exposure reset to 0 in
 * under 6 seconds. Re-entering the same fire gave a fresh 3s grace period.
 * That ignored the central physiological fact about fire injury: damage is
 * cumulative. Heat, CO, and smoke inhalation add up. A previously-exposed
 * occupant collapses sooner on a second exposure.
 *
 * The replacement: `fireDose` accumulates per second in hazard, decays at a
 * much slower rate when clear (5%/s), and the trap threshold is higher
 * (5 dose-units instead of 3 seconds) to compensate. Past 60% of threshold
 * the agent's speed is degraded — modeling fatigue, disorientation, and
 * impaired vision — making subsequent re-entries even more dangerous. */
const INCAPACITATION_DOSE = 5.0
const DOSE_PER_SEC_INSIDE_FIRE = 1.0
const DOSE_PER_SEC_INSIDE_SMOKE_EDGE = 0.3
const DOSE_DECAY_RATE = 0.05 // 5%/s linear decay when fully clear of hazards
/** Dose threshold past which the agent's effective speed is degraded.
 *  Linear ramp from 1.0x at 60% threshold down to 0.55x at 100%. */
const DOSE_SPEED_DEGRADATION_START = 0.6

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
  /** Earthquake-only. Severity scenario the administrator selected. When set
   *  on an earthquake run, a magnitude is rolled within the scenario's band
   *  (see QUAKE_SCENARIO_RANGES) and the building's structurally fragile
   *  edges (stairwells / long spans) are rolled against it — collapsed edges
   *  spawn debris instead of the user hand-placing it. Unset → no structural
   *  collapse model (authored hazards only). */
  quakeScenario?: QuakeScenario
}

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

/* ── Earthquake structural-collapse model ──
 *
 * Fire is spatial: the user places a source and it spreads outward. An
 * earthquake is structural: the user sets a magnitude and the building's
 * own weak points fail. Every edge flagged `fragile` (stairwell approaches,
 * long unsupported spans, plus anything auto-derived from a `stairs` node)
 * is rolled against the magnitude; a collapsed edge drops a debris hazard at
 * its midpoint. Aftershocks re-roll the survivors, so a route that holds the
 * main shock can still fail mid-evacuation.
 */

/** Probability a single fragile edge collapses in the main shock, as a
 *  function of magnitude (0–1). Quadratic: low magnitudes barely disturb the
 *  building, high magnitudes reliably sever weak points. */
function edgeCollapseProbability(magnitude: number): number {
  const m = Math.max(0, Math.min(1, magnitude))
  return Math.min(0.95, m * m * 1.1)
}

/** Earthquake severity scenarios. The administrator picks one of these
 *  instead of a raw magnitude — an earthquake is something that happens to
 *  the building, not a dial you set. */
export type QuakeScenario = 'minor' | 'moderate' | 'severe'

/** Scenario → magnitude band. The actual magnitude is rolled inside the band
 *  at simulation start, so two runs of the same scenario differ slightly —
 *  but a seeded run reproduces exactly. */
const QUAKE_SCENARIO_RANGES: Record<QuakeScenario, [number, number]> = {
  minor: [0.25, 0.35],
  moderate: [0.55, 0.65],
  severe: [0.85, 0.95],
}

/** Roll a concrete magnitude inside the scenario's band. */
function rollQuakeMagnitude(scenario: QuakeScenario, rand: () => number): number {
  const [lo, hi] = QUAKE_SCENARIO_RANGES[scenario]
  return lo + rand() * (hi - lo)
}

const EARTHQUAKE_SHOCK_TIMES = [0, 18, 36].map(t => t + EARTHQUAKE_TREMOR_DURATION)
const AFTERSHOCK_PROBABILITY_FACTOR = 0.5
/** Collapse debris is kept tight to the edge it severs — big enough to block
 *  that edge's midpoint, small enough that it does not bleed into a
 *  neighbouring room's only doorway and seal it. */
const COLLAPSE_DEBRIS_RADIUS = 16
const COLLAPSE_DEBRIS_MAX_RADIUS = 26

/** Edges hard-blocked by a set of hazard zones evaluated at each zone's
 *  initial radius — the picture at the moment a shock drops its debris,
 *  before any growth. Smoke is ignored (it never hard-blocks). Mirrors the
 *  runtime logic in `updateBlockedEdges`, but for the static drop-instant
 *  picture used by the earthquake realism guard. */
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

/** True when every room can still reach some exit through the residual graph
 *  (all edges minus `blockedEdges`). */
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

/**
 * Roll the floor's fragile edges against `magnitude` across the shock
 * timeline and return a debris HazardZone for each collapsed edge. Consumes
 * `rand` so a seeded run reproduces the exact collapse pattern. Returns []
 * when the floor has no fragile edges authored.
 *
 * Realism guard: an earthquake can block routes and trap individuals, but it
 * should never seal a room from the instant a shock hits. After rolling, the
 * drop-instant blocked-edge picture (collapse debris + authored hazards, at
 * initial radius) is checked for per-room reachability; while any room is
 * fully sealed, the most recent collapse is dropped — aftershock debris
 * first — until every room retains at least one viable path to an exit when
 * the debris appears. Debris still grows and aftershocks still pile on, so
 * occupants who linger can be cut off later — only the unsurvivable
 * instant-seal case is ruled out.
 */
function generateEarthquakeCollapses(
  floor: FloorModel,
  magnitude: number,
  rand: () => number,
  authoredHazards: HazardZone[],
): HazardZone[] {
  const fragileEdges = floor.edges.filter(e => e.fragile)
  if (fragileEdges.length === 0) return []

  const baseProb = edgeCollapseProbability(magnitude)
  const collapsed = new Set<string>()
  const zones: HazardZone[] = []
  let idx = 0

  for (const [shockIndex, shockTime] of EARTHQUAKE_SHOCK_TIMES.entries()) {
    // The first entry is always the main shock (full collapse probability);
    // every entry after it is a weaker aftershock. Keyed by index — not by
    // `shockTime === 0` — so shifting the timeline past the tremor window
    // doesn't accidentally demote the main shock to aftershock strength.
    const shockProb = shockIndex === 0 ? baseProb : baseProb * AFTERSHOCK_PROBABILITY_FACTOR
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

  // Realism guard — drop collapses (newest first) until no room is sealed at
  // the moment its debris drops. Runs after every `rand()` draw above, so it
  // never shifts the seeded collapse pattern; it only trims a tail that would
  // be unrealistic.
  while (zones.length > 0) {
    const blocked = edgesHardBlockedOnDrop(floor, [...authoredHazards, ...zones])
    if (allRoomsCanReachExit(floor, blocked)) break
    zones.pop()
  }

  return zones
}

/* ── Create initial simulation state ── */
export function createSimulation(
  floor: FloorModel,
  config: SimConfig,
): SimulationState {
  const agents: Agent[] = []
  let agentIdx = 0

  const rand = config.seed != null ? createSeededRng(config.seed) : Math.random
  /** Roll a speed inside the agent type's range. Each call advances RNG so
   *  the spawning order has to stay stable for replay determinism. */
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

    const doorIds = doorIdsByRoom.get(roomId) ?? []
    const useDoorSplit = doorIds.length > 1

    for (let i = 0; i < count; i++) {
      // Roll behavioral type first — every other per-agent property depends
      // on it. RNG order is fixed: type → reaction → speed → jitter.
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
        // Jitter range 0.85–1.15 — enough to swap ties between near-equal
        // routes without ever making a bad route look better than a good one.
        routingJitter: 0.85 + rand() * 0.30,
        rerouteStallTime: 0,
        rerouteAnchor: undefined,
        fireDose: 0,
        retreatCooldown: 0,
        threatRerouteCooldown: 0,
      })
    }
  }

  // Inject user agent if a user-drawn path was provided
  if (config.userPath && config.userPath.length >= 2) {
    const startRoomId = config.userPath[0]
    const exitId = config.userPath[config.userPath.length - 1]
    // The user agent is always treated as 'average' for class metadata; their
    // path is fixed by the drawn route, so the type only matters for speed
    // banding (kept slightly above avg since the user is actively engaged).
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

  // Initialize hazards. For an earthquake run with a magnitude set, the
  // structural-collapse model generates debris from the building's fragile
  // edges and appends it to any authored hazards. Generated last so it never
  // shifts the RNG draws used for agent spawning above.
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
  const hazardDefs = [...authoredHazards, ...collapseHazards]
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
    // Seeded permissive — no hazards have spawned yet, so every node is
    // reachable. updateExitReachability will tighten this each tick once
    // hard-blocks start severing the graph.
    reachableFromExit: new Set(floor.nodes.map(n => n.id)),
    running: false,
    finished: false,
    disasterType: config.disasterType,
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

  // 2a. Refresh the structural exit-reachability cache. Every trap site
  //     downstream gates on this set so an agent is only declared trapped
  //     when no exit remains reachable through unblocked edges — never
  //     because a hazard is nearby, because their dose is high, or because
  //     their preferred route is severed while alternatives still exist.
  updateExitReachability(newState, floor)

  // 3. Update congestion counts (snapshot from previous tick's positions)
  updateCongestion(newState)

  // 3a. Build live counters seeded from the tick's snapshot. Agents that
  //     ENTER an edge during this tick increment the live edge count
  //     immediately; agents that ARRIVE at a node increment the live
  //     node count. Subsequent agents in the iteration order use these
  //     mutated values for queue / capacity checks, which is what stops
  //     a swarm of agents from all stepping onto the same doorway in
  //     the same tick.
  const liveEdgeCounts: Record<string, number> = { ...newState.congestion.edgeCounts }
  const liveNodeCounts: Record<string, number> = { ...newState.congestion.nodeCounts }

  // Iteration order: by progress ASCENDING. Agents standing at a node
  // (progress 0, about to step onto an outbound edge) are processed first,
  // so they vacate the node — decrementing its live occupancy — BEFORE the
  // agents arriving at that same node (progress ≈ 1 on an inbound edge) are
  // processed. Without this ordering a node could read "full" of agents
  // who were already leaving it, and arrivals would needlessly stall — the
  // crowd-deadlock the queue model used to produce. Edge-slot fairness is
  // unaffected: a mid-edge agent's slot is already reserved in the seeded
  // `liveEdgeCounts` snapshot, so they never lose it to iteration order.
  const agentsByPriority = [...newState.agents].sort((a, b) => a.progress - b.progress)

  // 4. Update each agent
  for (const agent of agentsByPriority) {
    updateAgent(agent, newState, floor, dt, liveEdgeCounts, liveNodeCounts)
  }

  // 5. Check if simulation is done
  const activeAgents = newState.agents.filter(a => a.state !== 'evacuated' && a.state !== 'trapped')
  if (activeAgents.length === 0) {
    newState.finished = true
    newState.running = false
  }

  return newState
}

/** Convert the runtime ActiveHazard list into the lightweight HazardForecast
 *  shape expected by the pathfinder. Used by replanAgent so hazard-aware
 *  routing knows how each zone will grow in the seconds to come. */
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
 *
 * Also populates a THREAT zone for each hard hazard — the ring of edges just
 * outside the current radius, within `THREAT_BUFFER_PX`. These edges aren't
 * blocked yet, but the predictor flags them so agents route around them
 * proactively and only walk them when no clean alternative exists.
 */
function updateBlockedEdges(state: SimulationState, floor: FloorModel) {
  state.blockedEdges.clear()
  state.softBlockedEdges.clear()
  state.threatenedEdges.clear()

  for (const h of state.hazards) {
    if (!h.active) continue
    const r = h.currentRadius
    const isSoft = h.zone.type === 'smoke'
    // Smoke has no threat ring — agents push through it under panic; only
    // hard hazards (fire / debris / blocked) get a predictor zone.
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
        // Only downgrade to soft if no hard block already applies.
        if (!state.blockedEdges.has(key)) state.softBlockedEdges.add(key)
      } else if (dist < r) {
        state.blockedEdges.add(key)
        // A hard block supersedes any earlier soft / threat flag.
        state.softBlockedEdges.delete(key)
        state.threatenedEdges.delete(key)
      } else if (!state.blockedEdges.has(key)) {
        // Inside the threat ring but outside the radius — predictor zone.
        state.threatenedEdges.add(key)
      }
    }
  }
}

/* ── Exit reachability (last-resort trap gate) ──
 *
 * BFS from every exit backwards through the residual graph (all edges minus
 * hard-blocks). A node is "reachable" if there exists SOME unblocked path
 * from it to SOME exit. Smoke, congestion, and threat penalties are ignored
 * — those are routing costs, not severs. This Set is the single source of
 * truth for the "is the agent truly out of options?" check that every trap
 * site now consults before marking an agent unevacuable.
 *
 * Hazards only grow over the course of a run, never shrink — so once a node
 * drops out of this set, it stays out. That property makes the BFS safe to
 * cache for the tick.
 */
function updateExitReachability(state: SimulationState, floor: FloorModel) {
  const reachable = new Set<string>()
  const queue: string[] = []
  for (const node of floor.nodes) {
    if (node.type === 'exit') {
      reachable.add(node.id)
      queue.push(node.id)
    }
  }
  // Build a one-shot adjacency map keyed by node id so the BFS doesn't
  // re-scan `floor.edges` for every node it pops.
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

/** Last-resort test: does the agent's current node still have ANY path to
 *  ANY exit through the residual (hard-block-only) graph? If yes, the agent
 *  is NOT trapped — they may be in distress, dosed, blocked from their
 *  preferred route, or stuck behind congestion, but a way out exists and
 *  the engine should keep them on their feet. Trap state is reserved for
 *  agents whose `currentNodeId` is structurally severed from every exit. */
function agentHasEscapeRoute(agent: Agent, state: SimulationState): boolean {
  return state.reachableFromExit.has(agent.currentNodeId)
}

/* ── Congestion tracking ── */
function updateCongestion(state: SimulationState) {
  const nodeCounts: Record<string, number> = {}
  const edgeCounts: Record<string, number> = {}

  for (const agent of state.agents) {
    if (agent.state === 'evacuated' || agent.state === 'trapped') continue

    // Node occupancy counts ONLY agents physically standing at a node
    // (progress == 0). An agent mid-edge still has `currentNodeId` pointing
    // at the edge's SOURCE — but they have already walked off it. Counting
    // them at the source kept a node reading "full" of agents who had
    // departed, which stalled every arrival behind them: the crowd
    // deadlock. A node's live count must reflect who is actually there.
    if (agent.progress === 0) {
      nodeCounts[agent.currentNodeId] = (nodeCounts[agent.currentNodeId] || 0) + 1
    }

    // Edge occupancy counts agents who have actually stepped onto the edge
    // (progress > 0). At progress == 0 the agent is still at the source
    // node, not on the edge yet — counting them here double-charged the
    // queue model and gridlocked two agents at a shared source.
    if (agent.progress > 0 && agent.pathIndex < agent.path.length - 1) {
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

/** Does the next `lookahead` edges of the agent's path fall inside an active
 *  hazard's THREAT zone? Predictor trigger — fires before a hard block, so
 *  the agent reroutes while a clean alternative is still available rather
 *  than walking up to the wall of fire and only then changing course. We
 *  scan a small window rather than the whole remaining path: distant threats
 *  may resolve themselves (or get superseded by other reroutes) before the
 *  agent reaches them, and reacting to them now just produces thrashing. */
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
/** Scan all exit nodes and return any that sit within the danger ring of an
 *  active fire hazard. Used by `replanAgent` so every replan — including the
 *  initial path picked when an agent first wakes from its reaction delay —
 *  proactively avoids exits that are already compromised, rather than the
 *  old behavior of "pick the closest exit, then reroute once the threat
 *  predictor fires." The agent still has the fallback path inside replanAgent
 *  if every exit is compromised. */
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

  // Hazard-aware exit filtering: at spawn time and on every replan, avoid
  // any exit currently sitting inside a fire danger ring. Caller-supplied
  // excludes (e.g. proximity reroute's targetExitId ban) are unioned in so
  // both sources of "don't pick this exit" are respected together.
  const compromisedExits = findHazardCompromisedExits(floor, state)
  let effectiveExcludeExits = excludeExitIds
  if (compromisedExits.size > 0) {
    effectiveExcludeExits = new Set<string>(compromisedExits)
    if (excludeExitIds) {
      for (const id of excludeExitIds) effectiveExcludeExits.add(id)
    }
  }

  // Back-and-forth guard: forbid the agent's immediately-previous graph
  // node by default. This stops a fresh replan from opening with a U-turn
  // along the edge the agent just traversed, which was the most common
  // cause of "agents oscillating near a fire hazard." The fallback below
  // releases this constraint when it would leave the agent with no path.
  let effectiveForbiddenNodes = forbiddenNodeIds
  if (!effectiveForbiddenNodes && agent.history.length >= 2) {
    const prev = agent.history[agent.history.length - 2]
    if (prev?.nodeId && prev.nodeId !== agent.currentNodeId) {
      effectiveForbiddenNodes = new Set<string>([prev.nodeId])
    }
  }

  // Build hazard forecasts once per replan — passing them in lets Dijkstra
  // predict each hazard's radius at the agent's arrival time at every edge
  // it considers. The agent's own speed is used as the lookahead clock.
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

/** Detect whether the agent's current rendered position is within the
 *  proximity "danger zone" of an active fire hazard. Returns the exit IDs
 *  that should now be avoided — typically the agent's current target exit
 *  if that exit's path takes them too close to the flames.
 *
 *  This is the reactive trigger that makes agents abandon their current
 *  exit and pick a different one as soon as they get near fire. */
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

  // Always tick the retreat cooldown. Decrementing it only inside the
  // moving branch leaves the cooldown frozen while the agent is stuck
  // rerouting — preventing the second retreat attempt and condemning the
  // agent to the 6s stall trap.
  if (agent.retreatCooldown > 0) {
    agent.retreatCooldown = Math.max(0, agent.retreatCooldown - dt)
  }
  // Threat reroute cooldown — commits the agent to a freshly-replanned path
  // for a few seconds after a predictor reroute so they don't ping-pong
  // between two near-equal threatened options.
  if (agent.threatRerouteCooldown > 0) {
    agent.threatRerouteCooldown = Math.max(0, agent.threatRerouteCooldown - dt)
  }

  if (agent.rerouteAnchor && agent.rerouteAnchor.progress < 1) {
    const anchor = agent.rerouteAnchor
    if (anchor.distance > 0) {
      // Match the in-edge panic boost when the agent is sliding to their
      // anchor near an active hazard — otherwise rerouting visibly looked
      // like a slowdown right when the agent should be running fastest.
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
      // The weighted planner couldn't find a path right now. Promote to
      // 'rerouting' rather than trapping outright: the rerouting branch
      // retries every tick and only declares the agent trapped when the
      // structural escape-route test fails. Avoids the bug where a
      // transient routing failure (e.g. all preferred-door alternatives
      // momentarily threatened) instantly trapped a freshly-woken agent
      // who actually had a viable path.
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
      // Attempt a retreat out of a dead end while one is available.
      if (agent.retreatCooldown <= 0 && (agentIsInsideHardHazard(agent, floor, state) || agent.rerouteStallTime >= 2)) {
        if (retreatOneNode(agent, floor)) {
          // Retreating moved the agent to a new node, so the stall window
          // resets — they just made progress, even if it's backward.
          agent.retreatCooldown = 1.2
          agent.rerouteStallTime = 0
        }
      }
      // Resolve a long stall — INDEPENDENTLY of the retreat attempt above.
      // Previously this was an `else if`, so once the stall passed 2s the
      // retreat branch always won and the trap check could never run: an
      // agent with no history to retreat into (e.g. spawned on a floor
      // whose graph cannot reach any exit) stayed in 'rerouting' forever,
      // neither evacuating nor trapping. Now the check always runs.
      if (agent.rerouteStallTime >= 10) {
        // Trapped only as the last resort — no exit structurally reachable.
        // Otherwise drop every cooldown and let the next tick re-plan clean.
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

  // Revalidate path: look ahead at the *entire* remaining portion, not just the
  // next edge. Three triggers fire here:
  //   1. Hard block on remaining path  → must reroute (path is severed).
  //   2. Predictor threat on remaining path + cooldown ready → should reroute
  //      now so the agent reaches the exit through a clean corridor instead
  //      of walking up to the fire and only then reacting.
  //   3. Fire-proximity danger → agent is within the expanded danger ring of
  //      an active fire and must immediately pick a different exit.
  if (agent.state === 'moving' && agent.pathIndex < agent.path.length - 1) {
    const nextEdgeKey = edgeKey(agent.path[agent.pathIndex], agent.path[agent.pathIndex + 1])
    const nextHardBlocked = state.blockedEdges.has(nextEdgeKey)
    const aheadHardBlocked = !nextHardBlocked && remainingPathHasHardBlock(agent.path, agent.pathIndex, state.blockedEdges)
    // Predictor trigger — only for auto agents, only when no hard-block reroute
    // already covers it, and only when the cooldown has elapsed (so the agent
    // doesn't re-evaluate the predictor every tick on a still-threatened path).
    const threatTriggered =
      !agent.isUserAgent &&
      !nextHardBlocked &&
      !aheadHardBlocked &&
      agent.threatRerouteCooldown <= 0 &&
      remainingPathHasThreatenedEdge(agent.path, agent.pathIndex, state.threatenedEdges, THREAT_LOOKAHEAD_EDGES)

    // Fire-proximity trigger — agent has gotten close to an active fire and
    // must redirect to a different exit. Auto agents only; user agents are
    // committed to their drawn path. Shares the threat cooldown so we don't
    // trigger this on every tick after a fresh reroute, but is independent
    // enough that hard blocks still take priority.
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
        const replanExcludes = fireProximityTriggered ? proximityDanger.excludeExits : undefined
        if (replanAgent(agent, state, floor, replanExcludes)) {
          agent.state = 'moving'
        }
        // Always commit to the new path after a reroute. Without this,
        // overlapping triggers (hard-block + proximity) left the cooldown
        // at zero, causing frame-by-frame re-triggering and stuck agents.
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

    const ek = edgeKey(fromId, toId)
    const edgeWidth = edge?.width || 2

    // ── Soft queue model: edge congestion slows, never freezes ───────────
    // An edge has a comfortable capacity proportional to its width. Agents
    // are NEVER hard-blocked from stepping on — instead, an over-capacity
    // edge slows everyone on it toward the crawl floor. This still forms a
    // visible queue (a slow dense bunch) and still drives bottleneck
    // analytics, but it can never deadlock: forward progress is guaranteed.
    const slotCap = edgeSlotCapacity(edgeWidth)
    const isAlreadyOnEdge = agent.progress > 0
    if (!isAlreadyOnEdge) {
      // Stepping onto the edge: register edge occupancy and release the
      // source node's occupancy NOW (not at arrival) — a node must read as
      // having room the instant an agent starts leaving it, or arrivals
      // stall behind agents who have already departed.
      liveEdgeCounts[ek] = (liveEdgeCounts[ek] || 0) + 1
      liveNodeCounts[fromId] = Math.max(0, (liveNodeCounts[fromId] || 1) - 1)
    }

    // Edge congestion: at/under the comfortable capacity → no penalty;
    // over capacity → slow proportionally, floored at the crawl speed so
    // the edge always keeps draining.
    const edgeCount = liveEdgeCounts[ek] || 0
    const congestionFactor = edgeCount <= slotCap
      ? 1
      : Math.max(CONGESTION_MIN_SPEED_FACTOR, slotCap / edgeCount)

    // Destination-node congestion: an over-capacity next node slows the
    // agent's approach (soft enforcement) rather than hard-holding them at
    // the edge's end. Exits never crowd — they absorb agents instantly.
    const destLoad = liveNodeCounts[toId] || 0
    const destCap = Math.max(1, toNode.capacity) * NODE_CAPACITY_HEADROOM
    const destCongestionFactor = (toNode.type === 'exit' || destLoad <= destCap)
      ? 1
      : Math.max(CONGESTION_MIN_SPEED_FACTOR, destCap / destLoad)

    // Hazard proximity behavior:
    //   • Soft hazards (smoke):   slow down — discourage walking through.
    //   • Hard hazards (fire / debris / blocked): predictor + panic boost.
    //       Within 1.5x radius: speed up so the agent can clear the proximity.
    //       Inside the radius:  speed up MORE (panic, capped per agent type)
    //                            and tick `fireDose` toward incapacitation.
    // The agent's current rendered position is interpolated along the edge so
    // proximity checks reflect where the agent actually is, not just the
    // edge midpoint.
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
          // Touched by a hard hazard — full panic sprint to clear it. Speed
          // boost is capped by the agent type (slow/elderly can't sprint as
          // fast as fast responders).
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

    // Walking directly through smoke (a soft-blocked edge) — cap speed at 0.5x
    // and double the exposure tick. The agent keeps moving; they're not stuck.
    if (state.softBlockedEdges.has(ek)) {
      smokeFactor = Math.min(smokeFactor, 0.5)
      agent.hazardExposure += dt
    }

    // Panic always overrides smoke caution — the agent needs to GTFO.
    const hazardFactor = panicFactor > 1 ? panicFactor : smokeFactor

    // Earthquake tremor: while the ground is still shaking, even moving
    // agents only shuffle. Panic doesn't override this — the limit is the
    // floor moving under them, not the agent's willingness to run.
    const tremorFactor = isInTremorPhase(state) ? EARTHQUAKE_TREMOR_SPEED_MULTIPLIER : 1

    // ── Cumulative dose-response exposure ───────────────────────────────
    // Fire dose accumulates per second inside a hard hazard (1.0/s), plus a
    // smaller per-second contribution while on a smoke edge (0.3/s). Outside
    // any hazard the dose decays slowly (5%/s) — far slower than the old 0.5
    // rate, so an agent who survived a brush with fire is still impaired on
    // their next exposure.
    //
    // Trap policy (LAST RESORT): high dose alone does NOT trap an agent.
    // Even at threshold, if the residual graph still offers a path to an
    // exit the agent keeps moving — they just suffer the maximum speed
    // degradation from `doseSpeedFactor`, and if they're currently inside
    // a fire they're nudged into a retreat to give them a chance to
    // disengage. An agent is only marked `trapped` here when BOTH the
    // dose is at threshold AND there's no longer any exit reachable from
    // their node — i.e. fire has structurally severed them and they're
    // also too saturated to push through.
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
      // Has an escape route — clamp so the dose doesn't run away every
      // tick, and force a single retreat attempt out of the current fire
      // if one is available. The retreat puts the agent on a different
      // node where dose can start decaying and a fresh replan can find
      // the survivable path the residual graph still contains.
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
      // No hard hold any more — destination-node crowding already slowed the
      // agent's approach via `destCongestionFactor`. The crossing is simply
      // committed. Capacity is enforced softly (as slowdown), so a node may
      // briefly exceed its nominal capacity instead of gridlocking every
      // agent queued behind it. This is what eliminates the crowd-deadlock.
      //
      // Release the edge occupancy we registered at entry and register the
      // arrival at the destination node. `fromId` is NOT decremented here:
      // that already happened the moment the agent stepped onto the edge.
      liveEdgeCounts[ek] = Math.max(0, (liveEdgeCounts[ek] || 1) - 1)
      liveNodeCounts[toId] = (liveNodeCounts[toId] || 0) + 1

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

