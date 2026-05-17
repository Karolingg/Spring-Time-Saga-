'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/src/hooks/useAuth'
import {
  buildBottleneckSummaries,
  buildZoneSummaries,
  computeAccurateCongestion,
  createAutonomousTrace,
  getAgentRenderPosition,
  getEdgeIntensity,
  getGlobalPeakDensityPercent,
  getNodeIntensity,
  getPeakCongestion,
  getTopNodeHotspots,
  updateAutonomousTrace,
  type AccurateCongestion,
  type AutonomousTrace,
} from '@/src/simulation/autonomous-analytics'
import { createSimulation, evaluateSimulation, getTremorTimeRemaining, isInTremorPhase, stepSimulation, type QuakeScenario, type SimulationResults, type SimulationState } from '@/src/simulation/engine'
import { edgeKey, getBuildingById, getNode, type FloorModel } from '@/src/simulation/building-model'
import { createSimulationRun, saveDensityCells, saveSimulationResults } from '@/src/services/simulation.service'
import { getFriendlyErrorMessage, isRateLimitError } from '@/src/services/rate-limit.service'
import { computeFireSeverity, getHazardStorageKey, isHazardStorageAvailable, loadHazardPlan, placedHazardToZone, saveHazardPlan, type PlacedHazard } from '@/src/simulation/hazard-placement'
import {
  getOccupancyRatio,
  getPresetsFor,
  getSeverityAccent,
  resolvePresetHazardRadius,
  type DemoPreset,
} from '@/src/simulation/presets/demo-presets'
import {
  createSpatialGridTrace,
  densityCellsFromTrace,
  updateSpatialGridTrace,
  type SpatialGridTrace,
} from '@/src/simulation/spatial-grid'

type DisasterType = 'fire' | 'earthquake'

const SIMULATION_SECONDS_PER_MS = 0.35 / 120
const MAX_FRAME_DELTA_MS = 48
const HAZARD_GROWTH_MULTIPLIER = 0.45

/** Brand teal — used for all UI chrome (buttons, sliders, section labels,
 *  highlights, links). Disaster-specific colors (`meta.accent`) are reserved
 *  for the visualization layer (exit markers contrasting against the hazard
 *  rendering on the floorplan). */
const APP_ACCENT = '#2db8b0'
const APP_ACCENT_DARK = '#1f9189'
// Flip to true to reveal the underlying navigation graph (edges + corridor nodes) for debugging.
const SHOW_DEBUG_GRAPH = false

const DISASTER_META: Record<DisasterType, {
  accent: string
  label: string
  subtitle: string
}> = {
  fire: {
    accent: '#ff6b35',
    label: 'Autonomous Fire Drill',
    subtitle: 'Agents accelerate toward the nearest reachable exit and reroute around expanding smoke and fire zones.',
  },
  earthquake: {
    accent: '#f59e0b',
    label: 'Autonomous Earthquake Drill',
    subtitle: 'Agents move conservatively toward stair exits while debris zones progressively choke key corridors.',
  },
}

/** Earthquake severity presets. The administrator picks a scenario — an
 *  earthquake happens to the building, it isn't a magnitude dial they set.
 *  The engine rolls a concrete magnitude inside the scenario's band. */
const QUAKE_SCENARIOS: { id: QuakeScenario; label: string; description: string; accent: string }[] = [
  { id: 'minor', label: 'Minor', description: 'Light shaking — fragile points usually hold.', accent: '#f59e0b' },
  { id: 'moderate', label: 'Moderate', description: 'A stairwell or long span is likely to fail.', accent: '#f97316' },
  { id: 'severe', label: 'Severe', description: 'Most weak points collapse; aftershocks follow.', accent: '#ef4444' },
]

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function hazardLabel(type: 'fire' | 'smoke' | 'debris', disaster: DisasterType): string {
  if (type === 'smoke' && disaster === 'earthquake') return 'Dust'
  if (type === 'fire') return 'Fire'
  if (type === 'debris') return 'Debris'
  return 'Smoke'
}

function createHazardDragImage(type: 'fire' | 'smoke' | 'debris'): HTMLElement {
  const el = document.createElement('div')
  el.style.width = '64px'
  el.style.height = '64px'
  el.style.borderRadius = '999px'
  el.style.position = 'fixed'
  el.style.top = '-9999px'
  el.style.left = '-9999px'
  el.style.pointerEvents = 'none'
  el.style.display = 'flex'
  el.style.alignItems = 'center'
  el.style.justifyContent = 'center'

  if (type === 'debris') {
    el.style.borderRadius = '10px'
    el.style.background = 'rgba(120, 53, 15, 0.55)'
    el.style.border = '2px solid #92400e'
  } else if (type === 'fire') {
    el.style.background = 'rgba(239, 68, 68, 0.45)'
    el.style.border = '2px solid #ef4444'
  } else {
    el.style.background = 'rgba(100, 116, 139, 0.45)'
    el.style.border = '2px solid #64748b'
  }

  document.body.appendChild(el)
  return el
}

const OCCUPANCY_PRESETS = [
  { label: 'Low', ratio: 0.35 },
  { label: 'Medium', ratio: 0.6 },
  { label: 'High', ratio: 0.8 },
  { label: 'Full', ratio: 1 },
] as const

const SIMULATION_SPEED_OPTIONS = [
  { label: '0.5x', value: 0.5 },
  { label: '1x', value: 1 },
  { label: '2x', value: 2 },
  { label: '3x', value: 3 },
] as const

function formatSeconds(seconds: number) {
  return `${seconds.toFixed(1)}s`
}

function getCounts(state: SimulationState | null, floor: FloorModel | null): AccurateCongestion {
  if (!state || !floor) {
    return { nodeCounts: {}, edgeCounts: {} }
  }

  return computeAccurateCongestion(state)
}

function getActiveAgentCount(state: SimulationState | null) {
  if (!state) return 0
  return state.agents.filter((agent) => agent.state !== 'evacuated' && agent.state !== 'trapped').length
}

function getEvacuatedAgentCount(state: SimulationState | null) {
  if (!state) return 0
  return state.agents.filter((agent) => agent.state === 'evacuated').length
}

function getTrappedAgentCount(state: SimulationState | null) {
  if (!state) return 0
  return state.agents.filter((agent) => agent.state === 'trapped').length
}

function getBlockedEdgeCount(state: SimulationState | null) {
  if (!state) return 0
  return state.blockedEdges.size
}

function getHeatColor(intensity: number) {
  if (intensity >= 0.75) return '#ef4444'
  if (intensity >= 0.45) return '#f97316'
  if (intensity >= 0.2) return '#f59e0b'
  return '#22c55e'
}

function describeExitUsage(results: SimulationResults | null) {
  if (!results) return []
  return Object.entries(results.exitUsage).sort((left, right) => right[1] - left[1])
}

function describePresetOutcome(preset: DemoPreset, results: SimulationResults, peakCongestion: number): string {
  // Tier 1: severe outcomes first — those carry the strongest stakeholder signal.
  if (results.trappedCount > 0) {
    return `${results.trappedCount} occupant${results.trappedCount === 1 ? '' : 's'} trapped — hazards blocked the only legal egress route. Matches the preset intent: ${preset.expectedOutcome}`
  }
  if (peakCongestion >= 75) {
    return `Critical congestion (${peakCongestion} simultaneous agents on one edge) confirms the preset stress. ${preset.expectedOutcome}`
  }
  if (results.totalReroutes >= results.evacuatedCount * 0.4) {
    return `${results.totalReroutes} reroutes triggered — agents heavily replanned mid-evacuation. ${preset.expectedOutcome}`
  }
  // Tier 2: clean completion under preset conditions.
  return `Evacuation completed without critical blockage. ${preset.expectedOutcome}`
}

export default function AutonomousScienceBuildingPage() {
  const { isAuthenticated, isLoading } = useAuth()
  const params = useParams()
  const router = useRouter()
  const search = useSearchParams()

  const regionId = params.id as string
  const parsedFloor = Number.parseInt(search.get('floor') || '0', 10)
  const floorIndex = Number.isFinite(parsedFloor) ? Math.max(0, parsedFloor) : 0
  const disaster = ((search.get('disaster') || 'fire') as DisasterType)
  const meta = DISASTER_META[disaster] ?? DISASTER_META.fire

  const building = useMemo(() => getBuildingById(regionId), [regionId])
  const floor = useMemo(() => {
    if (!building) return null
    return building.floors[floorIndex] ?? building.floors[0] ?? null
  }, [building, floorIndex])

  const maxAgents = useMemo(() => (
    floor
      ? floor.nodes
        .filter((node) => node.type === 'room')
        .reduce((sum, node) => sum + node.capacity, 0)
      : 0
  ), [floor])

  const defaultAgentCount = useMemo(() => (
    maxAgents ? Math.max(1, Math.round(maxAgents * 0.6)) : 1
  ), [maxAgents])
  const baseTrace = useMemo(() => (floor ? createAutonomousTrace(floor) : null), [floor])

  const [agentCountOverride, setAgentCountOverride] = useState<number | null>(null)
  /** Per-room population overrides keyed by NavNode.id. Rooms in this map use
   *  their fixed value; rooms NOT in this map share the remaining budget
   *  (totalAgents − sum of overrides) proportionally to their capacity. */
  const [roomOverrides, setRoomOverrides] = useState<Record<string, number>>({})
  const [roomFilter, setRoomFilter] = useState<string>('')
  const [simulationSpeed, setSimulationSpeed] = useState(1)
  const [simState, setSimState] = useState<SimulationState | null>(null)
  const [trace, setTrace] = useState<AutonomousTrace | null>(null)
  const [gridTrace, setGridTrace] = useState<SpatialGridTrace | null>(null)
  const [results, setResults] = useState<SimulationResults | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveMessage, setSaveMessage] = useState('')
  const [isRunLimitPopupOpen, setIsRunLimitPopupOpen] = useState(false)
  const [savedRunId, setSavedRunId] = useState<string | null>(null)
  const [placedHazards, setPlacedHazards] = useState<PlacedHazard[]>([])
  const [selectedHazardId, setSelectedHazardId] = useState<string | null>(null)
  const [storageAvailable] = useState(() => isHazardStorageAvailable())
  const [appliedPreset, setAppliedPreset] = useState<DemoPreset | null>(null)
  // Earthquake-only. Severity scenario — the engine rolls a magnitude inside
  // the scenario's band and the structural-collapse model runs the building's
  // fragile edges against it on the next run.
  const [quakeScenario, setQuakeScenario] = useState<QuakeScenario>('moderate')
  const dropRef = useRef<HTMLDivElement | null>(null)

  const simStateRef = useRef<SimulationState | null>(null)
  const traceRef = useRef<AutonomousTrace | null>(null)
  const gridTraceRef = useRef<SpatialGridTrace | null>(null)
  const launchedAgentCountRef = useRef(0)
  const animationFrameRef = useRef<number | null>(null)
  const lastFrameTimeRef = useRef<number | null>(null)
  // Snapshot of the exact inputs the engine was given for the current run,
  // captured at launch so the analysis "Replay" view can rebuild a bit-for-bit
  // copy of the simulation later.
  const launchedReplayInputsRef = useRef<{
    seed: number
    hazards: PlacedHazard[]
    agentsPerRoom: Record<string, number>
  } | null>(null)
  // Severity bucket the launched run falls into. Earthquakes inherit it from
  // the picked QuakeScenario; fires are auto-classified from the hazards
  // placed on the floor. Captured at launch and persisted to the saved run
  // so the building-readiness score can apply difficulty weighting and the
  // mandatory-coverage cap downstream.
  const launchedSeverityRef = useRef<'minor' | 'moderate' | 'severe'>('minor')
  const totalAgents = maxAgents > 0
    ? clamp(agentCountOverride ?? defaultAgentCount, 1, maxAgents)
    : 1
  const activeTrace = trace ?? baseTrace
  const hazardStorageKey = useMemo(() => getHazardStorageKey(regionId, floorIndex, disaster), [regionId, floorIndex, disaster])
  const hazardZones = useMemo(() => placedHazards.map((hazard) => placedHazardToZone(hazard, `ui-${regionId}-${floorIndex}`)), [placedHazards, regionId, floorIndex])
  const allowedHazardTypes = useMemo(() => {
    return disaster === 'earthquake' ? ['debris', 'smoke'] as const : ['fire', 'smoke'] as const
  }, [disaster])

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      window.location.href = '/auth'
    }
  }, [isLoading, isAuthenticated])

  useEffect(() => {
    const plan = loadHazardPlan(hazardStorageKey)
    queueMicrotask(() => {
      setPlacedHazards(plan?.hazards ?? [])
      setSelectedHazardId(null)
    })
  }, [hazardStorageKey])

  // Per-room overrides become meaningless when the floor's room set changes
  // (different building or different floor), so wipe them on floor switch.
  useEffect(() => {
    queueMicrotask(() => setRoomOverrides({}))
  }, [floor])

  useEffect(() => {
    if (!hazardStorageKey) return
    saveHazardPlan(hazardStorageKey, placedHazards)
  }, [hazardStorageKey, placedHazards])

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    const type = event.dataTransfer.getData('application/x-hazard') as PlacedHazard['type']
    if (!type || !dropRef.current) return
    const rect = dropRef.current.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    const px = ((event.clientX - rect.left) / rect.width) * 1200
    const py = ((event.clientY - rect.top) / rect.height) * 675
    const radius = type === 'fire' ? 38 : type === 'smoke' ? 46 : 34
    const x = clamp(px, radius, 1200 - radius)
    const y = clamp(py, radius, 675 - radius)

    setPlacedHazards((prev) => [
      ...prev,
      {
        id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type,
        x,
        y,
        radius,
      },
    ])
  }, [])

  const handleDragStart = (type: PlacedHazard['type']) => (event: React.DragEvent<HTMLButtonElement>) => {
    event.dataTransfer.setData('application/x-hazard', type)
    event.dataTransfer.effectAllowed = 'copy'
    if (typeof document !== 'undefined') {
      const dragImage = createHazardDragImage(type)
      event.dataTransfer.setDragImage(dragImage, 32, 32)
      window.setTimeout(() => dragImage.remove(), 0)
    }
  }

  const removeHazard = useCallback((hazardId: string) => {
    setPlacedHazards((prev) => prev.filter((hazard) => hazard.id !== hazardId))
    if (selectedHazardId === hazardId) setSelectedHazardId(null)
  }, [selectedHazardId])

  const clearHazards = useCallback(() => {
    setPlacedHazards([])
    setSelectedHazardId(null)
    setAppliedPreset(null)
  }, [])

  const availablePresets = useMemo(
    () => getPresetsFor(regionId, floorIndex, disaster),
    [regionId, floorIndex, disaster],
  )

  const applyPreset = useCallback((preset: DemoPreset) => {
    const stamp = Date.now()
    const hazards: PlacedHazard[] = preset.hazards.map((hazard, index) => {
      const radius = resolvePresetHazardRadius(hazard)
      return {
        id: `${preset.id}-${index}-${stamp}`,
        type: hazard.type,
        x: clamp(hazard.x, radius, 1200 - radius),
        y: clamp(hazard.y, radius, 675 - radius),
        radius,
      }
    })
    setPlacedHazards(hazards)
    setSelectedHazardId(null)
    setAppliedPreset(preset)
    if (maxAgents > 0) {
      setAgentCountOverride(Math.max(1, Math.round(maxAgents * getOccupancyRatio(preset.occupancyPreset))))
    }
    setRoomOverrides({})
  }, [maxAgents])

  // Whenever the user manually edits hazards or occupancy, the "preset
  // applied" label stops being accurate — drop it so the chip badge clears.
  const clearAppliedPreset = useCallback(() => setAppliedPreset(null), [])

  useEffect(() => {
    simStateRef.current = simState
  }, [simState])

  useEffect(() => {
    traceRef.current = activeTrace
  }, [activeTrace])

  useEffect(() => {
    gridTraceRef.current = gridTrace
  }, [gridTrace])

  const persistCompletedRun = useCallback(async (
    completedTrace: AutonomousTrace,
    completedGridTrace: SpatialGridTrace,
    completedResults: SimulationResults,
    agentCount: number,
    floorModel: FloorModel,
  ) => {
    try {
      setSaveStatus('saving')
      setSaveMessage('Saving autonomous run to analysis history...')

      const replayInputs = launchedReplayInputsRef.current
      const runId = await createSimulationRun({
        disasterType: disaster,
        agentCount,
        gridWidth: 1200,
        gridHeight: 675,
        exitCount: floorModel.nodes.filter((node) => node.type === 'exit').length,
        wallDensity: 0,
        speedMs: Math.round(140 / simulationSpeed),
      }, regionId, floorIndex, replayInputs ?? undefined, launchedSeverityRef.current)

      await saveSimulationResults(
        runId,
        {
          totalSteps: completedTrace.tickCount,
          evacuatedCount: completedResults.evacuatedCount,
          maxCongestion: getPeakCongestion(completedTrace),
          evacuationTime: Number(completedResults.totalTime.toFixed(2)),
          congestionExposure: Number(completedResults.avgHazardExposure.toFixed(2)),
          globalPeakDensity: getGlobalPeakDensityPercent(floorModel, completedTrace),
          status: 'completed',
        },
        buildZoneSummaries(floorModel, completedTrace),
        buildBottleneckSummaries(floorModel, completedTrace),
      )

      await saveDensityCells(runId, densityCellsFromTrace(completedGridTrace))

      setSavedRunId(runId)
      setSaveStatus('saved')
      setSaveMessage('Run saved. You can open the analysis page to inspect congestion zones and grid density.')
      setIsRunLimitPopupOpen(false)
    } catch (error) {
      console.error('Failed to save autonomous run:', error)
      const friendlyMessage = getFriendlyErrorMessage(error, 'Simulation completed, but saving to analysis failed.')
      setSaveStatus('error')
      setSaveMessage(friendlyMessage)
      if (isRateLimitError(error)) setIsRunLimitPopupOpen(true)
    }
  }, [disaster, regionId, floorIndex, simulationSpeed])

  useEffect(() => {
    if (!floor || !isPlaying) return

    const stepFrame = (timestamp: number) => {
      const currentState = simStateRef.current
      const currentTrace = traceRef.current
      const currentGridTrace = gridTraceRef.current

      if (!currentState || !currentTrace || !currentGridTrace) {
        animationFrameRef.current = window.requestAnimationFrame(stepFrame)
        return
      }

      if (lastFrameTimeRef.current === null) {
        lastFrameTimeRef.current = timestamp
        animationFrameRef.current = window.requestAnimationFrame(stepFrame)
        return
      }

      const elapsedMs = Math.min(timestamp - lastFrameTimeRef.current, MAX_FRAME_DELTA_MS)
      lastFrameTimeRef.current = timestamp
      const dt = elapsedMs * SIMULATION_SECONDS_PER_MS * simulationSpeed
      currentState.hazardGrowthMultiplier = HAZARD_GROWTH_MULTIPLIER
      const nextState = stepSimulation(currentState, floor, dt)
      const nextCongestion = computeAccurateCongestion(nextState)
      const nextTrace = updateAutonomousTrace(currentTrace, nextCongestion, dt)
      const agentPositions = nextState.agents
        .filter((agent) => agent.state !== 'evacuated' && agent.state !== 'trapped')
        .map((agent) => getAgentRenderPosition(agent, floor))
      const nextGridTrace = updateSpatialGridTrace(
        currentGridTrace,
        agentPositions,
        nextState.hazards.map((hazard) => ({
          x: hazard.zone.x,
          y: hazard.zone.y,
          currentRadius: hazard.currentRadius,
          active: hazard.active,
        })),
        dt,
      )

      simStateRef.current = nextState
      traceRef.current = nextTrace
      gridTraceRef.current = nextGridTrace
      setSimState(nextState)
      setTrace(nextTrace)
      setGridTrace(nextGridTrace)

      if (nextState.finished) {
        setIsPlaying(false)
        const completedResults = evaluateSimulation(nextState, floor)
        setResults(completedResults)
        void persistCompletedRun(
          nextTrace,
          nextGridTrace,
          completedResults,
          launchedAgentCountRef.current,
          floor,
        )
        return
      }

      animationFrameRef.current = window.requestAnimationFrame(stepFrame)
    }

    lastFrameTimeRef.current = null
    animationFrameRef.current = window.requestAnimationFrame(stepFrame)

    return () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
      lastFrameTimeRef.current = null
    }
  }, [floor, isPlaying, persistCompletedRun, simulationSpeed])

  /**
   * Final per-room agent counts. Rooms with explicit overrides use that exact
   * number (clamped to capacity). Remaining rooms split the leftover budget
   * (`totalAgents − sum of overrides`) proportionally to their capacity, using
   * the same algorithm as `distributeAgentsByCapacity`.
   */
  const roomAllocations = useMemo<Record<string, number>>(() => {
    if (!floor) return {}
    const rooms = floor.nodes.filter((node) => node.type === 'room')

    // Pin overrides first.
    const result: Record<string, number> = {}
    let overriddenSum = 0
    for (const r of rooms) {
      if (Object.prototype.hasOwnProperty.call(roomOverrides, r.id)) {
        const v = clamp(Math.floor(roomOverrides[r.id]), 0, r.capacity)
        result[r.id] = v
        overriddenSum += v
      }
    }

    // Distribute remaining budget proportionally across non-overridden rooms.
    const remainingRooms = rooms.filter(
      (r) => !Object.prototype.hasOwnProperty.call(roomOverrides, r.id),
    )
    const remainingCap = remainingRooms.reduce((sum, r) => sum + r.capacity, 0)
    const remainingBudget = Math.max(0, totalAgents - overriddenSum)

    if (remainingRooms.length > 0 && remainingCap > 0 && remainingBudget > 0) {
      // Largest-remainder rounding so the per-room shares sum back to
      // `remainingBudget` exactly (no off-by-one drift).
      const exact = remainingRooms.map((r) => ({
        id: r.id,
        capacity: r.capacity,
        share: (remainingBudget * r.capacity) / remainingCap,
      }))
      const floors = exact.map((e) => ({ ...e, floorVal: Math.floor(e.share), frac: e.share - Math.floor(e.share) }))
      let assigned = floors.reduce((s, e) => s + e.floorVal, 0)
      const sortedByFrac = [...floors].sort((a, b) => b.frac - a.frac)
      let i = 0
      while (assigned < remainingBudget && i < sortedByFrac.length) {
        sortedByFrac[i].floorVal++
        assigned++
        i++
      }
      for (const e of floors) {
        result[e.id] = clamp(e.floorVal, 0, e.capacity)
      }
    } else {
      for (const r of remainingRooms) result[r.id] = 0
    }

    return result
  }, [floor, totalAgents, roomOverrides])

  /** Sum of room allocations actually being launched (may differ from
   *  `totalAgents` when overrides exceed the budget — overrides win). */
  const effectiveAgentCount = useMemo(
    () => Object.values(roomAllocations).reduce((sum, n) => sum + n, 0),
    [roomAllocations],
  )

  const setRoomOverride = useCallback((roomId: string, value: number, capacity: number) => {
    const clamped = clamp(Math.floor(value), 0, capacity)
    setRoomOverrides((prev) => ({ ...prev, [roomId]: clamped }))
  }, [])

  const clearRoomOverride = useCallback((roomId: string) => {
    setRoomOverrides((prev) => {
      if (!Object.prototype.hasOwnProperty.call(prev, roomId)) return prev
      const next = { ...prev }
      delete next[roomId]
      return next
    })
  }, [])

  const clearAllRoomOverrides = useCallback(() => {
    setRoomOverrides({})
  }, [])

  // Previewed severity bucket this run would save as if launched right now.
  // Shown next to the hazard placement panel so the user knows whether their
  // scenario counts as minor / moderate / severe toward the building's
  // Evacuation Readiness Score — buildings can't earn an A without at least
  // one severe drill on file.
  const previewSeverity: 'minor' | 'moderate' | 'severe' = useMemo(() => (
    disaster === 'earthquake' ? quakeScenario : computeFireSeverity(placedHazards)
  ), [disaster, quakeScenario, placedHazards])

  const liveCongestion = useMemo(() => getCounts(simState, floor), [simState, floor])
  const topHotspots = useMemo(() => (
    floor && activeTrace ? getTopNodeHotspots(floor, activeTrace, 4) : []
  ), [activeTrace, floor])
  const topBottlenecks = useMemo(() => (
    floor && activeTrace ? buildBottleneckSummaries(floor, activeTrace) : []
  ), [activeTrace, floor])
  const exitUsage = useMemo(() => describeExitUsage(results), [results])
  const peakCongestion = useMemo(() => (activeTrace ? getPeakCongestion(activeTrace) : 0), [activeTrace])

  const setPreset = useCallback((ratio: number) => {
    if (!maxAgents) return
    setAgentCountOverride(Math.max(1, Math.round(maxAgents * ratio)))
  }, [maxAgents])

  const launchSimulation = useCallback(() => {
    if (!floor) return

    // Capture the inputs needed to replay this run exactly later. The seed
    // makes per-agent attributes (reaction delay, speed, jitter)
    // reproducible; the hazards + room allocations make the world state
    // reproducible.
    const seed = Math.floor(Math.random() * 0xffffffff) >>> 0
    launchedReplayInputsRef.current = {
      seed,
      hazards: placedHazards.map((h) => ({ ...h })),
      agentsPerRoom: { ...roomAllocations },
    }
    // Earthquake severity is picked explicitly via the scenario buttons.
    // Fire severity is derived from the hazards the user actually placed —
    // an empty placement counts as 'minor', and the score scales up with
    // hazard count and type (see computeFireSeverity).
    launchedSeverityRef.current = disaster === 'earthquake'
      ? quakeScenario
      : computeFireSeverity(placedHazards)

    const nextState = createSimulation(floor, {
      disasterType: disaster,
      agentsPerRoom: roomAllocations,
      hazardGrowthMultiplier: HAZARD_GROWTH_MULTIPLIER,
      hazardOverrides: hazardZones,
      seed,
      quakeScenario: disaster === 'earthquake' ? quakeScenario : undefined,
    })

    nextState.running = true
    launchedAgentCountRef.current = effectiveAgentCount

    const nextTrace = createAutonomousTrace(floor)
    const initialCongestion = computeAccurateCongestion(nextState)
    const primedTrace = updateAutonomousTrace(nextTrace, initialCongestion, 0)
    const initialPositions = nextState.agents
      .filter((agent) => agent.state !== 'evacuated' && agent.state !== 'trapped')
      .map((agent) => getAgentRenderPosition(agent, floor))
    const primedGridTrace = updateSpatialGridTrace(
      createSpatialGridTrace(),
      initialPositions,
      nextState.hazards.map((hazard) => ({
        x: hazard.zone.x,
        y: hazard.zone.y,
        currentRadius: hazard.currentRadius,
        active: hazard.active,
      })),
      0,
    )

    simStateRef.current = nextState
    traceRef.current = primedTrace
    gridTraceRef.current = primedGridTrace
    setSimState(nextState)
    setTrace(primedTrace)
    setGridTrace(primedGridTrace)
    setResults(null)
    setSavedRunId(null)
    setSaveStatus('idle')
    setSaveMessage('')
    setIsRunLimitPopupOpen(false)
    setIsPlaying(true)
  }, [disaster, floor, roomAllocations, effectiveAgentCount, hazardZones, placedHazards, quakeScenario])

  const resetSimulation = useCallback(() => {
    clearHazards()
    setIsPlaying(false)
    setSimState(null)
    setTrace(null)
    setGridTrace(null)
    traceRef.current = baseTrace
    gridTraceRef.current = null
    launchedAgentCountRef.current = 0
    simStateRef.current = null
    setResults(null)
    setSavedRunId(null)
    setSaveStatus('idle')
    setSaveMessage('')
    setIsRunLimitPopupOpen(false)
  }, [baseTrace, clearHazards])

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Loading...</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  const unsupportedRoute = !building || !floor

  if (unsupportedRoute) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '88px 24px 56px', background: 'linear-gradient(180deg, #eaeff5 0%, #e4e9f1 100%)' }}>
        <div style={{ width: '100%', maxWidth: '620px', background: '#ffffff', border: '1px solid var(--border)', borderRadius: '16px', padding: '28px 30px', boxShadow: '0 10px 35px rgba(15, 23, 42, 0.08)' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#2db8b0', marginBottom: '12px' }}>
            Autonomous Simulation
          </div>
          <h1 style={{ margin: '0 0 10px', fontSize: '26px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Floor data not available
          </h1>
          <p style={{ margin: '0 0 20px', fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            {!building
              ? `No simulation data is registered for building "${regionId}".`
              : `Floor ${floorIndex + 1} is not available for this building yet.`}
          </p>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              onClick={() => router.push(`/simulate/${encodeURIComponent(regionId)}/disaster`)}
              style={{ padding: '10px 18px', borderRadius: '8px', border: 'none', background: '#2db8b0', color: '#ffffff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
            >
              Back to Disaster Setup
            </button>
            <button
              onClick={() => router.push(`/simulate/${encodeURIComponent(regionId)}/run?disaster=${disaster}&floor=${floorIndex}`)}
              style={{ padding: '10px 18px', borderRadius: '8px', border: '1px solid var(--border)', background: '#ffffff', color: 'var(--text-primary)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
            >
              Open Manual Run
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      padding: '88px 24px 56px',
      // Layered darker-white background — slightly cooler than pure off-white
      // to give white panels and cards visible separation from the page.
      background:
        'radial-gradient(circle at 100% 0%, rgba(45, 184, 176, 0.05) 0%, transparent 35%),' +
        'linear-gradient(180deg, #eaeff5 0%, #e4e9f1 100%)',
    }}>
      <style>{`
        @keyframes tremorPulse {
          0% { opacity: 0.4; transform: scale(0.85); }
          100% { opacity: 1; transform: scale(1.15); }
        }
        .auto-layout {
          display: grid;
          grid-template-columns: minmax(280px, 320px) minmax(0, 1fr) minmax(300px, 360px);
          gap: 18px;
          max-width: 1600px;
          margin: 0 auto;
          align-items: start;
        }

        .auto-panel {
          background: #fcfdfe;
          border: 1px solid #d8dfe8;
          border-radius: 16px;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04), 0 8px 24px -10px rgba(15, 23, 42, 0.08);
        }

        .auto-panel--sticky {
          position: sticky;
          top: 96px;
        }

        .auto-panel-section {
          padding: 18px 20px;
          border-bottom: 1px solid #e4e9ef;
          /* Consistent vertical rhythm between stacked sections. */
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .auto-panel-section > :first-child { margin-top: 0; }
        .auto-panel-section > :last-child { margin-bottom: 0; }

        .auto-panel-section:last-child {
          border-bottom: 0;
        }

        .auto-chip-row {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .auto-choice {
          padding: 7px 12px;
          border-radius: 8px;
          border: 1px solid var(--border);
          background: #ffffff;
          color: var(--text-primary);
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
        }

        .auto-choice:hover {
          border-color: var(--text-muted);
        }

        .auto-choice--active {
          color: #ffffff;
          border-color: transparent;
        }

        /* Brand-teal slider — replaces the OS default accent so the slider
           matches the rest of the EVACSIM chrome regardless of disaster. */
        .auto-range {
          appearance: none;
          -webkit-appearance: none;
          height: 6px;
          border-radius: 3px;
          background: var(--border);
          outline: none;
          cursor: pointer;
        }
        .auto-range::-webkit-slider-thumb {
          appearance: none;
          -webkit-appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: ${APP_ACCENT};
          border: 2px solid #ffffff;
          box-shadow: 0 2px 6px -2px rgba(45, 184, 176, 0.5);
          cursor: pointer;
          transition: transform 0.15s, box-shadow 0.15s;
        }
        .auto-range::-webkit-slider-thumb:hover {
          transform: scale(1.1);
          box-shadow: 0 3px 10px -2px rgba(45, 184, 176, 0.7);
        }
        .auto-range::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: ${APP_ACCENT};
          border: 2px solid #ffffff;
          box-shadow: 0 2px 6px -2px rgba(45, 184, 176, 0.5);
          cursor: pointer;
        }
        .auto-range::-moz-range-track {
          height: 6px;
          border-radius: 3px;
          background: var(--border);
        }

        .auto-stat-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        .auto-stat-grid--three {
          grid-template-columns: 1fr 1fr 1fr;
        }

        .auto-stat {
          border-radius: 12px;
          border: 1px solid #dee5ee;
          background: linear-gradient(180deg, #ffffff 0%, #f4f7fb 100%);
          padding: 12px 14px;
          /* Match the height of the largest stat in the same grid so the
             panel sections look balanced. */
          display: flex;
          flex-direction: column;
          justify-content: center;
          min-height: 64px;
        }

        .auto-map-card {
          padding: 16px;
        }

        .auto-map-shell {
          position: relative;
          width: 100%;
          aspect-ratio: 1200 / 675;
          border-radius: 16px;
          overflow: hidden;
          background: #0f172a;
          border: 1px solid #cbd5e1;
        }

        .auto-map-shell img,
        .auto-map-shell svg {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          display: block;
        }

        /* Compact single-column list — scales to dozens of rooms without
           dominating the side panel. Caps height and scrolls internally. */
        .auto-room-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
          max-height: 380px;
          overflow-y: auto;
          padding-right: 4px;
        }
        .auto-room-list::-webkit-scrollbar { width: 6px; }
        .auto-room-list::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 3px;
        }

        .auto-room-row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 56px 60px 34px;
          align-items: center;
          gap: 8px;
          padding: 6px 10px;
          border-radius: 8px;
          border: 1px solid #dee5ee;
          background: #ffffff;
          transition: border-color 120ms, box-shadow 120ms;
        }
        .auto-room-row--override {
          border-color: ${APP_ACCENT};
          box-shadow: 0 0 0 1px ${APP_ACCENT}33;
        }
        .auto-room-row__label {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-primary);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .auto-room-row__capacity {
          font-size: 10px;
          color: var(--text-muted);
          font-weight: 500;
        }
        .auto-room-row__input {
          width: 100%;
          padding: 5px 6px;
          border-radius: 6px;
          border: 1px solid var(--border);
          background: #ffffff;
          color: ${APP_ACCENT_DARK};
          font-size: 13px;
          font-weight: 700;
          text-align: center;
          outline: none;
          font-feature-settings: "tnum";
        }
        .auto-room-row__input--override {
          border-color: ${APP_ACCENT};
        }
        .auto-room-row__bar {
          height: 4px;
          border-radius: 2px;
          background: #e2e8f0;
          overflow: hidden;
        }
        .auto-room-row__bar-fill {
          height: 100%;
          transition: width 200ms, background 200ms;
        }
        .auto-room-row__pct {
          font-size: 10px;
          font-weight: 700;
          text-align: right;
          font-feature-settings: "tnum";
        }

        .auto-room-search {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 10px;
          border-radius: 8px;
          border: 1px solid var(--border);
          background: #ffffff;
        }
        .auto-room-search input {
          flex: 1;
          border: none;
          outline: none;
          font-size: 12px;
          color: var(--text-primary);
          background: transparent;
        }

        .auto-map-insights {
          margin-top: 14px;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .auto-map-insight {
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          background: #ffffff;
          padding: 12px 14px;
        }

        .auto-map-insight-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        @media (max-width: 1320px) {
          .auto-layout {
            grid-template-columns: minmax(280px, 320px) minmax(0, 1fr);
          }
        }

        @media (max-width: 980px) {
          .auto-layout {
            grid-template-columns: 1fr;
          }

          .auto-map-insights {
            grid-template-columns: 1fr;
          }

          .auto-panel--sticky {
            position: static;
          }
        }
      `}</style>

      <div style={{ maxWidth: '1600px', margin: '0 auto 18px' }}>
        <button
          onClick={() => router.push(`/simulate/${encodeURIComponent(regionId)}/disaster`)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            fontSize: '13px',
            cursor: 'pointer',
            padding: 0,
            marginBottom: '18px',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back to floor picker
        </button>

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '16px', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 12px', borderRadius: '999px', background: `${APP_ACCENT}14`, border: `1px solid ${APP_ACCENT}33`, marginBottom: '12px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: APP_ACCENT }} />
              <span style={{ fontSize: '12px', fontWeight: 600, color: APP_ACCENT_DARK, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{building?.name ?? regionId} / {floor.label} / Autonomous</span>
            </div>
            <h1 style={{ margin: '0 0 4px', fontSize: '26px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{meta.label}</h1>
            <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: '840px' }}>
              {meta.subtitle} Agents stay on the navigation graph only. They spawn from room nodes, move along legal corridor edges, and never cut through walls.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={launchSimulation}
              disabled={isPlaying}
              style={{
                padding: '10px 18px',
                borderRadius: '8px',
                border: 'none',
                background: isPlaying ? 'var(--bg-subtle, #f1f5f9)' : APP_ACCENT_DARK,
                color: isPlaying ? 'var(--text-muted)' : '#ffffff',
                fontSize: '13px',
                fontWeight: 600,
                cursor: isPlaying ? 'not-allowed' : 'pointer',
                boxShadow: isPlaying ? 'none' : '0 1px 2px rgba(31, 145, 137, 0.15), 0 4px 12px -4px rgba(31, 145, 137, 0.4)',
                transition: 'all 0.15s',
              }}
            >
              {simState ? 'Restart Autonomous Run' : 'Start Autonomous Run'}
            </button>
            <button
              onClick={() => setIsPlaying((current) => !current)}
              disabled={!simState || simState.finished}
              style={{
                padding: '10px 18px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: '#ffffff',
                color: 'var(--text-primary)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: !simState || simState.finished ? 'not-allowed' : 'pointer',
                opacity: !simState || simState.finished ? 0.5 : 1,
                transition: 'all 0.15s',
              }}
            >
              {isPlaying ? 'Pause' : 'Resume'}
            </button>
            <button
              onClick={resetSimulation}
              style={{
                padding: '10px 18px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: '#ffffff',
                color: 'var(--text-primary)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {isRunLimitPopupOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1200,
          background: 'rgba(15, 23, 42, 0.45)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
        }}>
          <div style={{
            width: '100%',
            maxWidth: '440px',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '16px',
            boxShadow: '0 24px 60px -24px rgba(15, 23, 42, 0.45)',
            padding: '28px',
          }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: '#fef2f2',
              color: '#dc2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px',
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v5" />
                <path d="M12 17h.01" />
              </svg>
            </div>

            <h2 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Saved run limit reached
            </h2>
            <p style={{ margin: '0 0 8px', fontSize: '14px', lineHeight: 1.6, color: 'var(--text-secondary)' }}>
              You have used all saved autonomous runs for now. Wait a few minutes, then try saving another run.
            </p>
            {saveMessage && (
              <p style={{ margin: '0 0 24px', fontSize: '12px', lineHeight: 1.5, color: '#991b1b' }}>
                {saveMessage}
              </p>
            )}

            <button
              type="button"
              onClick={() => setIsRunLimitPopupOpen(false)}
              style={{
                width: '100%',
                padding: '10px 16px',
                borderRadius: '8px',
                border: 'none',
                background: APP_ACCENT_DARK,
                color: '#ffffff',
                fontSize: '14px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Got it
            </button>
          </div>
        </div>
      )}

      <div className="auto-layout">
        <aside className="auto-panel auto-panel--sticky">
          <section className="auto-panel-section">
            <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: APP_ACCENT_DARK, marginBottom: '12px' }}>
              Setup
            </div>

            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>Occupancy preset</div>
              <div className="auto-chip-row">
                {OCCUPANCY_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => setPreset(preset.ratio)}
                    className={`auto-choice ${totalAgents === Math.max(1, Math.round(maxAgents * preset.ratio)) ? 'auto-choice--active' : ''}`}
                    style={{ background: totalAgents === Math.max(1, Math.round(maxAgents * preset.ratio)) ? APP_ACCENT_DARK : '#ffffff' }}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '8px' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Total agents</div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: APP_ACCENT_DARK }}>
                  {effectiveAgentCount} / {maxAgents}
                  {effectiveAgentCount !== totalAgents && (
                    <span style={{ marginLeft: '6px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                      (target {totalAgents})
                    </span>
                  )}
                </div>
              </div>
              <input
                type="range"
                className="auto-range"
                min={1}
                max={Math.max(1, maxAgents)}
                value={totalAgents}
                onChange={(event) => setAgentCountOverride(clamp(Number.parseInt(event.target.value || '1', 10), 1, Math.max(1, maxAgents)))}
                style={{ width: '100%' }}
              />
              {Object.keys(roomOverrides).length > 0 && (
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '6px', lineHeight: 1.5 }}>
                  {Object.keys(roomOverrides).length} room{Object.keys(roomOverrides).length === 1 ? ' is' : 's are'} pinned. Slider only redistributes the rest.
                </div>
              )}
            </div>

            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>Simulation speed</div>
              <div className="auto-chip-row">
                {SIMULATION_SPEED_OPTIONS.map((option) => (
                  <button
                    key={option.label}
                    onClick={() => setSimulationSpeed(option.value)}
                    className={`auto-choice ${simulationSpeed === option.value ? 'auto-choice--active' : ''}`}
                    style={{ background: simulationSpeed === option.value ? APP_ACCENT_DARK : '#ffffff' }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                Scales timers, hazard spread, and agent movement together.
              </div>
            </div>
          </section>

          {availablePresets.length > 0 && (
            <section className="auto-panel-section">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '10px' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: APP_ACCENT_DARK }}>
                  Scenario Presets
                </div>
                {appliedPreset && (
                  <button
                    type="button"
                    onClick={clearAppliedPreset}
                    style={{
                      background: 'none', border: 'none', padding: 0,
                      color: APP_ACCENT_DARK, fontSize: '11px', fontWeight: 600,
                      cursor: 'pointer', textDecoration: 'underline',
                    }}
                  >
                    Clear label
                  </button>
                )}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '12px', lineHeight: 1.5 }}>
                One-click recipes from the stakeholder demo guide. Applying a preset replaces hazards and occupancy.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {availablePresets.map((preset) => {
                  const isActive = appliedPreset?.id === preset.id
                  const accent = getSeverityAccent(preset.severity)
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyPreset(preset)}
                      style={{
                        textAlign: 'left',
                        padding: '10px 12px',
                        borderRadius: '10px',
                        border: `1px solid ${isActive ? accent : 'var(--border)'}`,
                        background: isActive ? `${accent}14` : '#ffffff',
                        boxShadow: isActive ? `0 0 0 1px ${accent}40` : 'none',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', marginBottom: '4px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {preset.label}
                        </div>
                        <span style={{
                          fontSize: '9px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                          color: accent, padding: '2px 6px', borderRadius: '999px',
                          background: `${accent}1f`,
                        }}>
                          {preset.severity}
                        </span>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.4, marginBottom: '4px' }}>
                        {preset.description}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                        {preset.hazards.length} hazard{preset.hazards.length === 1 ? '' : 's'} · {preset.occupancyPreset} occupancy
                      </div>
                    </button>
                  )
                })}
              </div>
              {appliedPreset && (
                <div style={{
                  marginTop: '10px',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  background: `${getSeverityAccent(appliedPreset.severity)}14`,
                  border: `1px solid ${getSeverityAccent(appliedPreset.severity)}40`,
                  fontSize: '11px',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.5,
                }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Watch for:</strong> {appliedPreset.expectedOutcome}
                </div>
              )}
            </section>
          )}

          {disaster === 'earthquake' && (
            <section className="auto-panel-section">
              <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: APP_ACCENT_DARK, marginBottom: '12px' }}>
                Earthquake scenario
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
                Pick a severity and run. You don&apos;t place debris — the building&apos;s
                own weak points decide what fails. Stairwells and long spans are rolled
                against the quake; collapsed sections drop debris, and aftershocks
                re-roll whatever is still standing.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {QUAKE_SCENARIOS.map((scenario) => {
                  const active = quakeScenario === scenario.id
                  return (
                    <button
                      key={scenario.id}
                      type="button"
                      onClick={() => setQuakeScenario(scenario.id)}
                      disabled={!!simState}
                      style={{
                        display: 'flex', flexDirection: 'column', gap: '2px', textAlign: 'left',
                        padding: '10px 12px', borderRadius: '8px',
                        border: `1px solid ${active ? scenario.accent : 'var(--border)'}`,
                        background: active ? `${scenario.accent}14` : '#ffffff',
                        cursor: simState ? 'not-allowed' : 'pointer',
                        transition: 'all 0.15s',
                      }}
                    >
                      <span style={{ fontSize: '12px', fontWeight: 700, color: active ? scenario.accent : 'var(--text-primary)' }}>
                        {scenario.label}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        {scenario.description}
                      </span>
                    </button>
                  )
                })}
              </div>
              <div style={{ marginTop: '10px', fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Collapse points are defined per floor. Science Building 2F has its
                stairwells and east span flagged — other floors fall back to authored
                hazards only.
              </div>
            </section>
          )}

          <section className="auto-panel-section">
            <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: APP_ACCENT_DARK, marginBottom: '12px' }}>
              Hazard placement
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
              Drag hazards onto the map. You can place multiple fire, smoke, or debris zones.
            </div>
            {/* Severity preview — tells the user how this run will count
                toward the building's Evacuation Readiness Score. */}
            <div style={{
              marginBottom: '12px', padding: '8px 10px', borderRadius: '8px',
              background: previewSeverity === 'severe' ? '#fef2f2'
                : previewSeverity === 'moderate' ? '#fff7ed' : '#f0f9ff',
              border: `1px solid ${previewSeverity === 'severe' ? '#fecaca'
                : previewSeverity === 'moderate' ? '#fed7aa' : '#bae6fd'}`,
              fontSize: '11px', color: previewSeverity === 'severe' ? '#991b1b'
                : previewSeverity === 'moderate' ? '#9a3412' : '#075985',
              lineHeight: 1.5,
            }}>
              <strong style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Saves as: {previewSeverity}
              </strong>
              <div style={{ marginTop: '2px', opacity: 0.85 }}>
                {previewSeverity === 'severe'
                  ? 'Severe drills unlock A–F grading for this building.'
                  : previewSeverity === 'moderate'
                  ? 'Moderate drills cap the building grade at B.'
                  : 'Minor / clean drills cap the building grade at C.'}
              </div>
            </div>
            {!storageAvailable && (
              <div style={{
                marginBottom: '12px', padding: '8px 10px', borderRadius: '8px',
                background: '#fff7ed', border: '1px solid #fed7aa',
                fontSize: '11px', color: '#9a3412', lineHeight: 1.4,
              }}>
                Local storage is unavailable. Hazards will be kept in memory but lost on refresh.
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
              {allowedHazardTypes.map((type) => (
                <button
                  key={type}
                  draggable
                  onDragStart={handleDragStart(type)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
                    padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)',
                    background: '#ffffff', color: 'var(--text-primary)', fontSize: '12px', fontWeight: 600, cursor: 'grab',
                    transition: 'all 0.15s',
                  }}
                >
                  {hazardLabel(type, disaster)}
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Drag to map</span>
                </button>
              ))}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Active hazards are listed on the right panel.</div>
          </section>

          <section className="auto-panel-section">
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '10px', marginBottom: '4px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Room population</div>
              <div style={{ fontSize: '11px', fontWeight: 600, color: APP_ACCENT_DARK }}>
                {effectiveAgentCount} / {maxAgents}
              </div>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '12px', lineHeight: 1.5 }}>
              Type a number to lock a room. Untouched rooms split the remaining budget by capacity.
              {Object.keys(roomOverrides).length > 0 && (
                <>
                  {' '}
                  <button
                    type="button"
                    onClick={clearAllRoomOverrides}
                    style={{ background: 'none', border: 'none', padding: 0, color: APP_ACCENT_DARK, fontSize: '11px', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    Reset all
                  </button>
                </>
              )}
            </div>
            {(() => {
              const allRooms = floor.nodes.filter((node) => node.type === 'room')
              const needle = roomFilter.trim().toLowerCase()
              const visibleRooms = needle
                ? allRooms.filter((r) => r.label.toLowerCase().includes(needle))
                : allRooms

              return (
                <>
                  {/* Search filter — only shown when there are enough rooms
                      to justify it, so small buildings stay clean. */}
                  {allRooms.length > 8 && (
                    <div className="auto-room-search">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                      </svg>
                      <input
                        type="text"
                        placeholder={`Search ${allRooms.length} rooms…`}
                        value={roomFilter}
                        onChange={(e) => setRoomFilter(e.target.value)}
                      />
                      {roomFilter && (
                        <button
                          type="button"
                          onClick={() => setRoomFilter('')}
                          style={{ background: 'none', border: 'none', padding: 0, color: 'var(--text-muted)', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  )}

                  <div className="auto-room-list">
                    {visibleRooms.map((roomNode) => {
                      const allocated = roomAllocations[roomNode.id] ?? 0
                      const isOverridden = Object.prototype.hasOwnProperty.call(roomOverrides, roomNode.id)
                      const utilization = roomNode.capacity > 0 ? allocated / roomNode.capacity : 0
                      const utilColor = utilization >= 0.9 ? '#ef4444' : utilization >= 0.6 ? '#f59e0b' : '#22c55e'
                      return (
                        <div
                          key={roomNode.id}
                          className={`auto-room-row${isOverridden ? ' auto-room-row--override' : ''}`}
                        >
                          {/* Room label + capacity */}
                          <div style={{ minWidth: 0 }}>
                            <div className="auto-room-row__label" title={roomNode.label}>
                              {roomNode.label}
                            </div>
                            <div className="auto-room-row__capacity">
                              cap {roomNode.capacity}
                              {isOverridden && (
                                <>
                                  {' · '}
                                  <button
                                    type="button"
                                    onClick={() => clearRoomOverride(roomNode.id)}
                                    style={{ background: 'none', border: 'none', padding: 0, color: APP_ACCENT_DARK, fontSize: '10px', fontWeight: 600, cursor: 'pointer' }}
                                  >
                                    auto
                                  </button>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Number input */}
                          <input
                            type="number"
                            min={0}
                            max={roomNode.capacity}
                            step={1}
                            value={allocated}
                            onChange={(event) => {
                              const raw = event.target.value
                              if (raw === '') {
                                clearRoomOverride(roomNode.id)
                                return
                              }
                              const parsed = Number.parseInt(raw, 10)
                              if (!Number.isFinite(parsed)) return
                              setRoomOverride(roomNode.id, parsed, roomNode.capacity)
                            }}
                            onFocus={(event) => event.currentTarget.select()}
                            className={`auto-room-row__input${isOverridden ? ' auto-room-row__input--override' : ''}`}
                          />

                          {/* Utilization bar */}
                          <div className="auto-room-row__bar">
                            <div
                              className="auto-room-row__bar-fill"
                              style={{
                                width: `${Math.min(100, utilization * 100)}%`,
                                background: utilColor,
                              }}
                            />
                          </div>

                          {/* Percent */}
                          <span className="auto-room-row__pct" style={{ color: utilColor }}>
                            {Math.round(utilization * 100)}%
                          </span>
                        </div>
                      )
                    })}
                    {visibleRooms.length === 0 && (
                      <div style={{ padding: '14px 10px', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>
                        No rooms match &ldquo;{roomFilter}&rdquo;.
                      </div>
                    )}
                  </div>
                </>
              )
            })()}
          </section>

        </aside>

        <main className="auto-panel auto-map-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{building?.name ?? regionId} {floor.label}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Autonomous crowd overlay on the real floorplan</div>
            </div>
            <div className="auto-chip-row">
              {simState && isInTremorPhase(simState) && (
                <div style={{
                  padding: '6px 10px', borderRadius: '8px',
                  background: '#fef3c7', border: '1px solid #fcd34d',
                  fontSize: '12px', fontWeight: 700, color: '#92400e',
                  display: 'flex', alignItems: 'center', gap: '6px',
                }}>
                  <span style={{
                    width: '8px', height: '8px', borderRadius: '50%',
                    background: '#f59e0b', animation: 'tremorPulse 0.6s infinite alternate',
                  }} />
                  Tremor {getTremorTimeRemaining(simState).toFixed(1)}s
                </div>
              )}
              <div style={{ padding: '6px 10px', borderRadius: '8px', background: '#e8f0fb', border: '1px solid #c8d8ec', fontSize: '12px', fontWeight: 600, color: '#1e40af' }}>
                Active {getActiveAgentCount(simState)}
              </div>
              <div style={{ padding: '6px 10px', borderRadius: '8px', background: '#e8f5ec', border: '1px solid #c5dfce', fontSize: '12px', fontWeight: 600, color: '#166534' }}>
                Evacuated {getEvacuatedAgentCount(simState)}
              </div>
              <div style={{ padding: '6px 10px', borderRadius: '8px', background: '#fbf0e6', border: '1px solid #f0d4b3', fontSize: '12px', fontWeight: 600, color: '#9a3412' }}>
                Blocked edges {getBlockedEdgeCount(simState)}
              </div>
            </div>
          </div>

          <div
            className="auto-map-shell"
            ref={dropRef}
            onDrop={handleDrop}
            onDragOver={(event) => event.preventDefault()}
          >
            {floor.floorplanSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={floor.floorplanSrc} alt={`${building?.name ?? regionId} ${floor.label} floor plan`} />
            ) : null}
            <svg viewBox="0 0 1200 675" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
              {SHOW_DEBUG_GRAPH && floor.edges.map((edge) => {
                const fromNode = getNode(floor, edge.from)
                const toNode = getNode(floor, edge.to)
                if (!fromNode || !toNode) return null

                const intensity = activeTrace ? getEdgeIntensity(edge, activeTrace) : 0
                const blocked = simState?.blockedEdges.has(edgeKey(edge.from, edge.to)) ?? false
                const stroke = blocked ? '#ef4444' : getHeatColor(intensity)
                const opacity = blocked ? 0.95 : 0.25 + intensity * 0.6

                const midX = (fromNode.x + toNode.x) / 2
                const midY = (fromNode.y + toNode.y) / 2

                return (
                  <g key={`${edge.from}-${edge.to}`}>
                    <line
                      x1={fromNode.x}
                      y1={fromNode.y}
                      x2={toNode.x}
                      y2={toNode.y}
                      stroke={stroke}
                      strokeWidth={blocked ? 7 : 4 + intensity * 5}
                      strokeLinecap="round"
                      opacity={opacity}
                    />
                    <text x={midX} y={midY - 5} textAnchor="middle" fontSize="8" fontWeight="700" fill={blocked ? '#b91c1c' : '#475569'}>
                      {edge.width.toFixed(1)}m
                    </text>
                  </g>
                )
              })}

              {SHOW_DEBUG_GRAPH && floor.nodes.filter((node) => node.type !== 'room').map((node) => {
                const intensity = activeTrace ? getNodeIntensity(node, activeTrace) : 0
                const fill = getHeatColor(intensity)
                const liveCount = liveCongestion.nodeCounts[node.id] || 0

                return (
                  <g key={node.id}>
                    <circle cx={node.x} cy={node.y} r={12 + intensity * 12} fill={fill} opacity={0.15 + intensity * 0.2} />
                    <circle cx={node.x} cy={node.y} r={5.5} fill={fill} stroke="#ffffff" strokeWidth="2" />
                    {liveCount > 0 && (
                      <text x={node.x} y={node.y - 14} textAnchor="middle" fontSize="10" fontWeight="700" fill="#0f172a">
                        {liveCount}
                      </text>
                    )}
                    <text x={node.x} y={node.y + 18} textAnchor="middle" fontSize="8" fontWeight="700" fill="#334155">
                      {node.kind ?? node.type}
                    </text>
                  </g>
                )
              })}

              {!simState && placedHazards.map((hazard) => (
                <g key={hazard.id} onClick={() => setSelectedHazardId(hazard.id)} style={{ cursor: 'pointer' }}>
                  {hazard.type === 'debris' ? (
                    <rect
                      x={hazard.x - hazard.radius}
                      y={hazard.y - hazard.radius}
                      width={hazard.radius * 2}
                      height={hazard.radius * 2}
                      fill={selectedHazardId === hazard.id ? 'rgba(245, 158, 11, 0.35)' : 'rgba(120, 53, 15, 0.35)'}
                      stroke={selectedHazardId === hazard.id ? '#f59e0b' : '#92400e'}
                      strokeWidth="2"
                      rx="4"
                    />
                  ) : (
                    <circle
                      cx={hazard.x}
                      cy={hazard.y}
                      r={hazard.radius}
                      fill={hazard.type === 'fire' ? 'rgba(239, 68, 68, 0.28)' : 'rgba(100, 116, 139, 0.28)'}
                      stroke={hazard.type === 'fire' ? '#ef4444' : '#64748b'}
                      strokeWidth="2"
                    />
                  )}
                  <text x={hazard.x} y={hazard.y + 4} textAnchor="middle" fontSize="10" fontWeight="700" fill="#0f172a">
                    {hazardLabel(hazard.type, disaster)}
                  </text>
                </g>
              ))}

              {simState?.hazards.filter((hazard) => hazard.active).map((hazard) => (
                <g key={hazard.zone.id}>
                  <circle
                    cx={hazard.zone.x}
                    cy={hazard.zone.y}
                    r={hazard.currentRadius}
                    fill={hazard.zone.type === 'smoke' ? 'rgba(100, 116, 139, 0.18)' : hazard.zone.type === 'debris' ? 'rgba(245, 158, 11, 0.18)' : 'rgba(239, 68, 68, 0.18)'}
                    stroke={hazard.zone.type === 'smoke' ? '#64748b' : hazard.zone.type === 'debris' ? '#f59e0b' : '#ef4444'}
                    strokeWidth="2"
                    strokeDasharray={hazard.zone.type === 'blocked' ? '6 6' : undefined}
                  />
                  <text x={hazard.zone.x} y={hazard.zone.y} textAnchor="middle" fontSize="10" fontWeight="700" fill="#0f172a">
                    {hazard.zone.type.toUpperCase()}
                  </text>
                </g>
              ))}

              {simState?.agents.filter((agent) => agent.state !== 'evacuated').map((agent) => {
                const position = getAgentRenderPosition(agent, floor)
                const fill = agent.state === 'trapped' ? '#ef4444' : '#2db8b0'

                return (
                  <circle
                    key={agent.id}
                    cx={position.x}
                    cy={position.y}
                    r="4"
                    fill={fill}
                    stroke="#ffffff"
                    strokeWidth="1.4"
                    opacity={agent.state === 'trapped' ? 1 : 0.9}
                  />
                )
              })}

              {floor.nodes.filter((node) => node.type === 'exit').map((node) => (
                <g key={node.id}>
                  <circle cx={node.x} cy={node.y} r="12" fill="#ffffff" stroke={meta.accent} strokeWidth="3" />
                  <text x={node.x} y={node.y + 4} textAnchor="middle" fontSize="10" fontWeight="800" fill={meta.accent}>
                    {node.label.replace('Exit ', '')}
                  </text>
                </g>
              ))}
            </svg>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', marginTop: '14px', fontSize: '12px', color: 'var(--text-secondary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#2db8b0', display: 'inline-block' }} />
              Active agents
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
              Trapped / blocked
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ffffff', border: '2px solid #ff6b35', display: 'inline-block' }} />
              Exits
            </div>
          </div>

          <div className="auto-map-insights">
            <div className="auto-map-insight">
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>Top hotspots</div>
              <div className="auto-map-insight-list">
                {topHotspots.map(({ node, peak, average }) => (
                  <div key={node.id} style={{ borderRadius: '10px', border: '1px solid var(--border)', background: '#f4f7fb', padding: '10px 12px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>{node.label}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Peak load {peak}, average load {average.toFixed(1)}</div>
                  </div>
                ))}
                {topHotspots.length === 0 && (
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Start a run to reveal crowd hotspots.</div>
                )}
              </div>
            </div>

            <div className="auto-map-insight">
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>Edge bottlenecks</div>
              <div className="auto-map-insight-list">
                {topBottlenecks.slice(0, 4).map((bottleneck) => (
                  <div key={bottleneck.zoneName} style={{ borderRadius: '10px', border: '1px solid var(--border)', background: '#ffffff', padding: '10px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '4px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{bottleneck.zoneName}</div>
                      <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', color: bottleneck.severity === 'HIGH' ? '#ef4444' : bottleneck.severity === 'MEDIUM' ? '#f97316' : '#22c55e' }}>
                        {bottleneck.severity}
                      </div>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{bottleneck.description}</div>
                  </div>
                ))}
                {topBottlenecks.length === 0 && (
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Bottleneck ranking will populate during the simulation.</div>
                )}
              </div>
            </div>
          </div>
        </main>

        <aside className="auto-panel">
          <section className="auto-panel-section">
            <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: APP_ACCENT_DARK, marginBottom: '12px' }}>
              Live Metrics
            </div>
            <div className="auto-stat-grid auto-stat-grid--three">
              <div className="auto-stat">
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>Peak congestion</div>
                <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{peakCongestion}</div>
              </div>
              <div className="auto-stat">
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>Evacuated</div>
                <div style={{ fontSize: '22px', fontWeight: 700, color: '#15803d', letterSpacing: '-0.02em' }}>{getEvacuatedAgentCount(simState)}</div>
              </div>
              <div className="auto-stat">
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>Trapped</div>
                <div style={{ fontSize: '22px', fontWeight: 700, color: getTrappedAgentCount(simState) > 0 ? '#ef4444' : 'var(--text-primary)', letterSpacing: '-0.02em' }}>{getTrappedAgentCount(simState)}</div>
              </div>
            </div>
          </section>

          <section className="auto-panel-section">
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>Run state</div>
            <div className="auto-stat-grid">
              <div className="auto-stat">
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>Elapsed</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{formatSeconds(simState?.elapsedTime || 0)}</div>
              </div>
              <div className="auto-stat">
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>Status</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: isPlaying ? APP_ACCENT_DARK : simState?.finished ? '#22c55e' : 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                  {simState?.finished ? 'Done' : isPlaying ? 'Running' : simState ? 'Paused' : 'Ready'}
                </div>
              </div>
            </div>
            {saveStatus !== 'idle' && (
              <div style={{ marginTop: '12px', padding: '10px 12px', borderRadius: '10px', background: saveStatus === 'error' ? '#fbeeee' : '#ecf4ee', border: `1px solid ${saveStatus === 'error' ? '#f0c8c8' : '#c5dfce'}`, fontSize: '12px', color: saveStatus === 'error' ? '#991b1b' : '#166534' }}>
                {saveMessage}
                {savedRunId ? ` (run ${savedRunId.slice(0, 8)})` : ''}
              </div>
            )}
          </section>

          <section className="auto-panel-section">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Active hazards</div>
              <button
                onClick={clearHazards}
                disabled={placedHazards.length === 0}
                style={{
                  padding: '5px 10px', borderRadius: '6px', border: `1px solid ${placedHazards.length === 0 ? 'var(--border)' : 'rgba(239,68,68,0.2)'}`,
                  background: placedHazards.length === 0 ? '#f8fafc' : '#fef2f2',
                  color: placedHazards.length === 0 ? 'var(--text-muted)' : '#b91c1c',
                  fontSize: '11px', fontWeight: 600, cursor: placedHazards.length === 0 ? 'not-allowed' : 'pointer',
                }}
              >
                Clear
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '220px', overflowY: 'auto' }}>
              {placedHazards.length === 0 && (
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No hazards placed yet.</div>
              )}
              {placedHazards.map((hazard, index) => (
                <div
                  key={hazard.id}
                  onClick={() => setSelectedHazardId(hazard.id)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px',
                    padding: '8px 10px', borderRadius: '10px',
                    border: selectedHazardId === hazard.id ? `1px solid ${APP_ACCENT}66` : '1px solid var(--border)',
                    background: selectedHazardId === hazard.id ? `${APP_ACCENT}14` : '#ffffff',
                    cursor: 'pointer',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{index + 1}. {hazardLabel(hazard.type, disaster)}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>x {Math.round(hazard.x)}, y {Math.round(hazard.y)}</div>
                  </div>
                  <button
                    onClick={(event) => {
                      event.stopPropagation()
                      removeHazard(hazard.id)
                    }}
                    style={{
                      padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.2)',
                      background: '#fef2f2', color: '#b91c1c', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className="auto-panel-section">
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>Completion summary</div>
            {results ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ borderRadius: '12px', border: '1px solid var(--border)', background: '#f4f7fb', padding: '12px 14px' }}>
                  <div style={{ fontSize: '32px', fontWeight: 700, color: results.trappedCount > 0 ? '#f97316' : '#22c55e', lineHeight: 1, letterSpacing: '-0.02em' }}>{formatSeconds(results.totalTime)}</div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '4px' }}>Evacuation time</div>
                </div>
                {appliedPreset && (() => {
                  const narrative = describePresetOutcome(appliedPreset, results, peakCongestion)
                  const accent = getSeverityAccent(appliedPreset.severity)
                  return (
                    <div style={{
                      borderRadius: '12px',
                      border: `1px solid ${accent}40`,
                      background: `${accent}10`,
                      padding: '12px 14px',
                    }}>
                      <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: accent, marginBottom: '4px' }}>
                        Preset · {appliedPreset.label}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                        {narrative}
                      </div>
                    </div>
                  )
                })()}
                {/* Compact 2-up grid — Peak congestion and Trapped already
                    appear in the Live Metrics section above, so we keep
                    only the post-run summary metrics here. */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div className="auto-stat">
                    <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>Reroutes</div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{results.totalReroutes}</div>
                  </div>
                  <div className="auto-stat">
                    <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>Avg exposure</div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{results.avgHazardExposure.toFixed(1)}s</div>
                  </div>
                </div>
                {exitUsage.length > 0 && (
                  <div style={{ borderRadius: '12px', border: '1px solid var(--border)', background: '#ffffff', padding: '12px 14px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>
                      Exit usage
                    </div>
                    {exitUsage.map(([exitId, count]) => (
                      <div key={exitId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', fontSize: '12px', color: 'var(--text-primary)', marginBottom: '4px' }}>
                        <span>{exitId}</span>
                        <strong>{count}</strong>
                      </div>
                    ))}
                  </div>
                )}
                {results.feedback.length > 0 && (
                  <div style={{ borderRadius: '12px', border: '1px solid var(--border)', background: '#ffffff', padding: '12px 14px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>
                      Evaluator
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                      {results.feedback.map((line) => (
                        <div key={line} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                          <span style={{ width: '6px', height: '6px', marginTop: '6px', borderRadius: '50%', background: APP_ACCENT, flexShrink: 0 }} />
                          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{line}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => router.push('/analysis')}
                    style={{ padding: '10px 16px', borderRadius: '8px', border: 'none', background: '#2db8b0', color: '#ffffff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Open Analysis
                  </button>
                  <button
                    onClick={() => router.push(`/simulate/${encodeURIComponent(regionId)}/run?disaster=${disaster}&floor=${floorIndex}`)}
                    style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid var(--border)', background: '#ffffff', color: 'var(--text-primary)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Open Manual Drill
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                Run the autonomous simulation to generate evacuation time, reroutes, congestion peaks, and saved heatmap analysis data.
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  )
}
