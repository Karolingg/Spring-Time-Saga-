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
import { createSimulation, EARTHQUAKE_TREMOR_DURATION, evaluateSimulation, getTremorTimeRemaining, isInTremorPhase, stepSimulation, type QuakeScenario, type SimulationResults, type SimulationState } from '@/src/simulation/engine'
import { getBuildingById, getNode, type FloorModel } from '@/src/simulation/building-model'
import { createSimulationRun, saveDensityCells, saveSimulationResults } from '@/src/services/simulation.service'
import { getFriendlyErrorMessage, isRateLimitError } from '@/src/services/rate-limit.service'
import { computeFireSeverity, getHazardStorageKey, isHazardStorageAvailable, loadHazardPlan, placedHazardToZone, saveHazardPlan, type PlacedHazard } from '@/src/simulation/hazard-placement'
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

const APP_ACCENT = '#2db8b0'
const APP_ACCENT_DARK = '#1f9189'
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

function clampHazardPosition(x: number, y: number, radius: number) {
  return {
    x: clamp(x, radius, 1200 - radius),
    y: clamp(y, radius, 675 - radius),
  }
}

function hazardColor(type: 'fire' | 'smoke' | 'debris' | 'blocked', selected = false) {
  if (type === 'smoke') return {
    fill: selected ? 'rgba(100, 116, 139, 0.38)' : 'rgba(100, 116, 139, 0.22)',
    stroke: '#64748b',
  }
  if (type === 'debris' || type === 'blocked') return {
    fill: selected ? 'rgba(245, 158, 11, 0.35)' : 'rgba(120, 53, 15, 0.28)',
    stroke: selected ? '#f59e0b' : '#92400e',
  }
  return {
    fill: selected ? 'rgba(239, 68, 68, 0.38)' : 'rgba(239, 68, 68, 0.24)',
    stroke: '#ef4444',
  }
}

function renderHazardShape(
  hazard: { type: 'fire' | 'smoke' | 'debris' | 'blocked'; x: number; y: number; radius: number },
  currentRadius: number,
  selected = false,
  extraProps: { strokeWidth?: number } = {},
) {
  const colors = hazardColor(hazard.type, selected)
  if (hazard.type === 'debris' || hazard.type === 'blocked') {
    return (
      <rect
        x={hazard.x - currentRadius}
        y={hazard.y - currentRadius}
        width={currentRadius * 2}
        height={currentRadius * 2}
        fill={colors.fill}
        stroke={colors.stroke}
        strokeWidth="2"
        strokeDasharray={hazard.type === 'blocked' ? '6 6' : undefined}
        rx="4"
        {...extraProps}
      />
    )
  }
  return (
    <circle
      cx={hazard.x}
      cy={hazard.y}
      r={currentRadius}
      fill={colors.fill}
      stroke={colors.stroke}
      strokeWidth="2"
      {...extraProps}
    />
  )
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
  const [hoveredHazardId, setHoveredHazardId] = useState<string | null>(null)
  const [draggingHazardId, setDraggingHazardId] = useState<string | null>(null)
  const [storageAvailable] = useState(() => isHazardStorageAvailable())
  const [quakeScenario, setQuakeScenario] = useState<QuakeScenario>('moderate')
  const dropRef = useRef<HTMLDivElement | null>(null)

  const simStateRef = useRef<SimulationState | null>(null)
  const traceRef = useRef<AutonomousTrace | null>(null)
  const gridTraceRef = useRef<SpatialGridTrace | null>(null)
  const launchedAgentCountRef = useRef(0)
  const animationFrameRef = useRef<number | null>(null)
  const lastFrameTimeRef = useRef<number | null>(null)
  const launchedReplayInputsRef = useRef<{
    seed: number
    hazards: PlacedHazard[]
    agentsPerRoom: Record<string, number>
  } | null>(null)
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

  useEffect(() => {
    queueMicrotask(() => setRoomOverrides({}))
  }, [floor])

  useEffect(() => {
    if (!hazardStorageKey) return
    saveHazardPlan(hazardStorageKey, placedHazards)
  }, [hazardStorageKey, placedHazards])

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    if (simStateRef.current) return
    const type = event.dataTransfer.getData('application/x-hazard') as PlacedHazard['type']
    const hazardId = event.dataTransfer.getData('application/x-hazard-id')
    if (!type || !dropRef.current) return
    const rect = dropRef.current.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    const px = ((event.clientX - rect.left) / rect.width) * 1200
    const py = ((event.clientY - rect.top) / rect.height) * 675
    const radius = type === 'fire' ? 38 : type === 'smoke' ? 46 : 34
    const { x, y } = clampHazardPosition(px, py, radius)

    if (hazardId) {
      setPlacedHazards((prev) => prev.map((hazard) => (
        hazard.id === hazardId
          ? { ...hazard, x, y }
          : hazard
      )))
      setSelectedHazardId(hazardId)
    } else {
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
    }
    setDraggingHazardId(null)
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

  const getMapPointFromClient = useCallback((clientX: number, clientY: number) => {
    if (!dropRef.current) return null
    const rect = dropRef.current.getBoundingClientRect()
    if (!rect.width || !rect.height) return null
    return {
      x: ((clientX - rect.left) / rect.width) * 1200,
      y: ((clientY - rect.top) / rect.height) * 675,
    }
  }, [])

  const handlePlacedHazardMouseDown = (hazard: PlacedHazard) => (event: React.MouseEvent<SVGGElement>) => {
    if (simStateRef.current) return
    event.preventDefault()
    setSelectedHazardId(hazard.id)
    setDraggingHazardId(hazard.id)
  }

  const handleMapMouseMove = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!draggingHazardId || simStateRef.current) return
    const point = getMapPointFromClient(event.clientX, event.clientY)
    if (!point) return
    setPlacedHazards((prev) => prev.map((hazard) => {
      if (hazard.id !== draggingHazardId) return hazard
      const next = clampHazardPosition(point.x, point.y, hazard.radius)
      return { ...hazard, ...next }
    }))
  }, [draggingHazardId, getMapPointFromClient])

  const removeHazard = useCallback((hazardId: string) => {
    setPlacedHazards((prev) => prev.filter((hazard) => hazard.id !== hazardId))
    if (selectedHazardId === hazardId) setSelectedHazardId(null)
  }, [selectedHazardId])

  const clearHazards = useCallback(() => {
    setPlacedHazards([])
    setSelectedHazardId(null)
  }, [])

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

  const roomAllocations = useMemo<Record<string, number>>(() => {
    if (!floor) return {}
    const rooms = floor.nodes.filter((node) => node.type === 'room')

    const result: Record<string, number> = {}
    let overriddenSum = 0
    for (const r of rooms) {
      if (Object.prototype.hasOwnProperty.call(roomOverrides, r.id)) {
        const v = clamp(Math.floor(roomOverrides[r.id]), 0, r.capacity)
        result[r.id] = v
        overriddenSum += v
      }
    }

    const remainingRooms = rooms.filter(
      (r) => !Object.prototype.hasOwnProperty.call(roomOverrides, r.id),
    )
    const remainingCap = remainingRooms.reduce((sum, r) => sum + r.capacity, 0)
    const remainingBudget = Math.max(0, totalAgents - overriddenSum)

    if (remainingRooms.length > 0 && remainingCap > 0 && remainingBudget > 0) {
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
  const activeDebrisCount = simState?.hazards.filter((h) => h.active && h.zone.type === 'debris').length ?? 0
  const pendingDebrisCount = simState?.hazards.filter((h) => !h.active && h.zone.type === 'debris').length ?? 0
  const tremorRemaining = simState && disaster === 'earthquake' ? getTremorTimeRemaining(simState) : 0
  const quakePhaseLabel = disaster === 'earthquake'
    ? !simState
      ? 'Ready'
      : tremorRemaining > 0
      ? 'Tremor'
      : pendingDebrisCount > 0
      ? 'Aftershock watch'
      : 'Collapse settled'
    : 'Hazard plan'


  const setPreset = useCallback((ratio: number) => {
    if (!maxAgents) return
    setAgentCountOverride(Math.max(1, Math.round(maxAgents * ratio)))
  }, [maxAgents])

  const launchSimulation = useCallback(() => {
    if (!floor) return

    const seed = Math.floor(Math.random() * 0xffffffff) >>> 0
    launchedReplayInputsRef.current = {
      seed,
      hazards: placedHazards.map((h) => ({ ...h })),
      agentsPerRoom: { ...roomAllocations },
    }
    launchedSeverityRef.current = disaster === 'earthquake'
      ? quakeScenario
      : computeFireSeverity(placedHazards)

    const nextState = createSimulation(floor, {
      disasterType: disaster,
      agentsPerRoom: roomAllocations,
      hazardGrowthMultiplier: HAZARD_GROWTH_MULTIPLIER,
      hazardOverrides: disaster === 'earthquake' ? undefined : hazardZones,
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
        <div style={{ color: 'var(--text-secondary)', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}><span className="spinner" />Loading...</div>
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
        <div style={{ width: '100%', maxWidth: '620px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '28px 30px', boxShadow: '0 10px 35px rgba(15, 23, 42, 0.08)' }}>
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
              onClick={() => router.push('/map')}
              style={{ padding: '10px 18px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
            >
              Back to Map
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="auto-page-root" style={{
      minHeight: '100vh',
      padding: '88px 24px 56px',
      // Layered background — a soft teal halo over the theme surface so
      // panels and cards keep visible separation from the page.
      background:
        'radial-gradient(circle at 100% 0%, rgba(45, 184, 176, 0.05) 0%, transparent 35%),' +
        'linear-gradient(180deg, var(--bg) 0%, var(--bg) 100%)',
    }}>
      <style>{`
        @keyframes tremorPulse {
          0% { opacity: 0.4; transform: scale(0.85); }
          100% { opacity: 1; transform: scale(1.15); }
        }
        .auto-layout {
          display: grid;
          grid-template-columns: minmax(300px, 340px) minmax(0, 1fr) minmax(300px, 340px);
          gap: 18px;
          max-width: 1600px;
          margin: 0 auto;
          align-items: start;
        }

        @media (max-width: 1100px) {
          .auto-layout {
            grid-template-columns: 1fr 1fr;
            grid-template-areas: "map map" "setup metrics";
            gap: 14px;
          }
          .auto-layout > :nth-child(1) { grid-area: setup; }
          .auto-layout > :nth-child(2) { grid-area: map; }
          .auto-layout > :nth-child(3) { grid-area: metrics; }
        }

        @media (max-width: 720px) {
          .auto-layout {
            grid-template-columns: 1fr;
            grid-template-areas: "map" "setup" "metrics";
            gap: 12px;
          }
          .auto-panel--sticky {
            position: static;
          }
          .auto-page-root {
            padding: 72px 14px 32px !important;
          }
          .auto-panel-section {
            padding: 14px 16px !important;
          }
        }

        .auto-panel {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 16px;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04), 0 8px 24px -10px rgba(15, 23, 42, 0.08);
        }

        .auto-panel--sticky {
          position: sticky;
          top: 96px;
        }

        .auto-panel-section {
          padding: 18px 20px;
          border-bottom: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .auto-panel-section > :first-child { margin-top: 0; }
        .auto-panel-section > :last-child { margin-bottom: 0; }

        .auto-panel-section:last-child {
          border-bottom: 0;
        }

        .auto-section-title {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: ${APP_ACCENT_DARK};
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
          background: var(--bg-card);
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
          border: 1px solid var(--border);
          background: var(--bg-subtle);
          padding: 12px 14px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          min-height: 64px;
        }

        .auto-map-card {
          padding: 16px;
        }

        .auto-summary-strip {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
          margin-top: 16px;
        }

        .auto-summary-card {
          min-height: 74px;
          border-radius: 14px;
          border: 1px solid var(--border);
          background: var(--bg-card);
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
          padding: 12px 14px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 8px;
        }

        .auto-summary-card__label {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--text-muted);
        }

        .auto-summary-card__value {
          font-size: 16px;
          font-weight: 800;
          color: var(--text-primary);
          letter-spacing: -0.01em;
        }

        .auto-summary-card__note {
          font-size: 11px;
          color: var(--text-secondary);
          line-height: 1.35;
        }

        .auto-tremor-banner {
          position: absolute;
          left: 14px;
          top: 14px;
          z-index: 5;
          max-width: min(430px, calc(100% - 28px));
          border-radius: 12px;
          border: 1px solid rgba(245, 158, 11, 0.45);
          background: rgba(255, 251, 235, 0.94);
          box-shadow: 0 12px 28px rgba(15, 23, 42, 0.16);
          padding: 10px 12px;
          color: #92400e;
          pointer-events: none;
        }

        .auto-tremor-banner__title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          font-weight: 800;
          margin-bottom: 3px;
        }

        .auto-tremor-banner__copy {
          font-size: 11px;
          line-height: 1.45;
          color: #78350f;
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
          border: 1px solid var(--border);
          background: var(--bg-card);
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
          background: var(--bg-card);
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
          background: var(--bg-card);
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
          background: var(--bg-card);
          padding: 12px 14px;
        }

        .auto-map-insight-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        @media (max-width: 980px) {
          .auto-summary-strip {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 720px) {
          .auto-summary-strip {
            grid-template-columns: 1fr;
          }
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
                background: 'var(--bg-card)',
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
                background: 'var(--bg-card)',
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

        <div className="auto-summary-strip" aria-label="Autonomous drill summary">
          <div className="auto-summary-card">
            <div className="auto-summary-card__label">Scenario</div>
            <div className="auto-summary-card__value" style={{ color: disaster === 'earthquake' ? '#b45309' : '#b91c1c', textTransform: 'capitalize' }}>
              {disaster === 'earthquake' ? `${quakeScenario} quake` : previewSeverity}
            </div>
            <div className="auto-summary-card__note">{disaster === 'earthquake' ? quakePhaseLabel : `${placedHazards.length} placed hazard${placedHazards.length === 1 ? '' : 's'}`}</div>
          </div>
          <div className="auto-summary-card">
            <div className="auto-summary-card__label">Population</div>
            <div className="auto-summary-card__value">{effectiveAgentCount} agents</div>
            <div className="auto-summary-card__note">{Object.keys(roomOverrides).length > 0 ? `${Object.keys(roomOverrides).length} room override${Object.keys(roomOverrides).length === 1 ? '' : 's'}` : 'Distributed by room capacity'}</div>
          </div>
          <div className="auto-summary-card">
            <div className="auto-summary-card__label">Hazard timing</div>
            <div className="auto-summary-card__value">{disaster === 'earthquake' ? `${EARTHQUAKE_TREMOR_DURATION}s tremor` : 'Live spread'}</div>
            <div className="auto-summary-card__note">{disaster === 'earthquake' ? 'Debris appears after shaking ends' : 'Fire and smoke grow during the run'}</div>
          </div>
          <div className="auto-summary-card">
            <div className="auto-summary-card__label">Run state</div>
            <div className="auto-summary-card__value">{simState?.finished ? 'Complete' : isPlaying ? 'Running' : simState ? 'Paused' : 'Ready'}</div>
            <div className="auto-summary-card__note">{results ? `${results.totalReroutes} reroute${results.totalReroutes === 1 ? '' : 's'} recorded` : 'Awaiting launch'}</div>
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
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
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

          {disaster === 'earthquake' && (
            <section className="auto-panel-section">
              <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: APP_ACCENT_DARK, marginBottom: '12px' }}>
                Earthquake scenario
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
                Pick a severity and run. The first {EARTHQUAKE_TREMOR_DURATION} seconds are a
                tremor phase: agents move slowly, and debris is held back until shaking ends.
                After that, the building&apos;s weak spans and stairwells collapse according
                to the selected scenario.
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
                Debris is generated automatically after the tremor phase. Initial
                collapses and later aftershocks land on corridor spans, so the map
                changes mid-run without placing debris inside rooms or walls.
              </div>
              <div style={{
                marginTop: '10px', padding: '8px 10px', borderRadius: '8px',
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
                    : 'Minor drills cap the building grade at C.'}
                </div>
              </div>
            </section>
          )}

          {disaster === 'fire' && (
          <section className="auto-panel-section">
            <div className="auto-section-title" style={{ marginBottom: '12px' }}>
              Hazard placement
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
              Drag hazards onto the map. You can place multiple fire or smoke zones.
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
                    background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '12px', fontWeight: 600, cursor: 'grab',
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
          )}

          <section className="auto-panel-section">
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '10px', marginBottom: '4px' }}>
              <div className="auto-section-title">Room population</div>
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
            onMouseMove={handleMapMouseMove}
            onMouseUp={() => setDraggingHazardId(null)}
            onMouseLeave={() => setDraggingHazardId(null)}
          >
            {floor.floorplanSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={floor.floorplanSrc} alt={`${building?.name ?? regionId} ${floor.label} floor plan`} />
            ) : null}
            {disaster === 'earthquake' && simState && tremorRemaining > 0 && (
              <div className="auto-tremor-banner">
                <div className="auto-tremor-banner__title">
                  <span style={{
                    width: '8px', height: '8px', borderRadius: '50%',
                    background: '#f59e0b', animation: 'tremorPulse 0.6s infinite alternate',
                    flexShrink: 0,
                  }} />
                  Tremor phase - {tremorRemaining.toFixed(1)}s
                </div>
                <div className="auto-tremor-banner__copy">
                  Debris is withheld until shaking ends; agents move at reduced speed.
                </div>
              </div>
            )}
            <svg viewBox="0 0 1200 675" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
              {SHOW_DEBUG_GRAPH && !simState && floor.edges.map((edge) => {
                const fromNode = getNode(floor, edge.from)
                const toNode = getNode(floor, edge.to)
                if (!fromNode || !toNode) return null

                const intensity = activeTrace ? getEdgeIntensity(edge, activeTrace) : 0
                const blocked = false
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

              {SHOW_DEBUG_GRAPH && !simState && floor.nodes.filter((node) => (
                node.type !== 'room'
                && node.kind !== 'door'
                && !/(entry|entrance|exit)$/i.test(node.label)
              )).map((node) => {
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
                <g
                  key={hazard.id}
                  onClick={() => setSelectedHazardId(hazard.id)}
                  onMouseDown={handlePlacedHazardMouseDown(hazard)}
                  onMouseEnter={() => setHoveredHazardId(hazard.id)}
                  onMouseLeave={() => setHoveredHazardId(null)}
                  style={{ cursor: draggingHazardId === hazard.id ? 'grabbing' : 'grab', opacity: draggingHazardId === hazard.id ? 0.55 : 1 }}
                >
                  {renderHazardShape(
                    hazard,
                    hazard.radius,
                    selectedHazardId === hazard.id || hoveredHazardId === hazard.id,
                    {
                      strokeWidth: selectedHazardId === hazard.id || hoveredHazardId === hazard.id ? 3 : 2,
                    },
                  )}
                  <text x={hazard.x} y={hazard.y + 4} textAnchor="middle" fontSize="10" fontWeight="700" fill="#0f172a" pointerEvents="none">
                    {hazardLabel(hazard.type, disaster)}
                  </text>
                </g>
              ))}

              {simState?.hazards.filter((hazard) => hazard.active).map((hazard) => (
                <g key={hazard.zone.id}>
                  {renderHazardShape(hazard.zone, hazard.currentRadius)}
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
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--bg-card)', border: '2px solid #ff6b35', display: 'inline-block' }} />
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
                  <div key={bottleneck.zoneName} style={{ borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '10px 12px' }}>
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
            <div className="auto-section-title" style={{ marginBottom: '12px' }}>Run state</div>
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

          {disaster === 'fire' ? (
          <section className="auto-panel-section">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
              <div className="auto-section-title">Active hazards</div>
              <button
                onClick={clearHazards}
                disabled={placedHazards.length === 0 || !!simState}
                style={{
                  padding: '5px 10px', borderRadius: '6px', border: `1px solid ${placedHazards.length === 0 || simState ? 'var(--border)' : 'rgba(239,68,68,0.2)'}`,
                  background: placedHazards.length === 0 || simState ? '#f8fafc' : '#fef2f2',
                  color: placedHazards.length === 0 || simState ? 'var(--text-muted)' : '#b91c1c',
                  fontSize: '11px', fontWeight: 600, cursor: placedHazards.length === 0 || simState ? 'not-allowed' : 'pointer',
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
                    {!simState && <div style={{ fontSize: '10px', color: APP_ACCENT_DARK, fontWeight: 600 }}>Drag on map to reposition</div>}
                  </div>
                  <button
                    disabled={!!simState}
                    onClick={(event) => {
                      event.stopPropagation()
                      removeHazard(hazard.id)
                    }}
                    style={{
                      padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.2)',
                      background: simState ? '#f8fafc' : '#fef2f2', color: simState ? 'var(--text-muted)' : '#b91c1c', fontSize: '11px', fontWeight: 600, cursor: simState ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </section>
          ) : (
          <section className="auto-panel-section">
            <div className="auto-section-title" style={{ marginBottom: '8px' }}>Structural debris</div>
            <div style={{
              borderRadius: '12px', border: '1px solid #f0d4b3',
              background: '#fbf6ef', padding: '12px 14px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ width: '11px', height: '11px', borderRadius: '3px', background: '#f59e0b', flexShrink: 0 }} />
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#9a3412', textTransform: 'capitalize' }}>
                  {quakeScenario} quake
                </div>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                Debris remains hidden during the tremor phase, then collapsed
                corridor spans appear as active blockage. Aftershocks can add
                more debris later in the run.
              </div>
              {simState && (
                <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #f0d4b3' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' }}>
                    <div style={{ borderRadius: '10px', background: 'var(--bg-card)', border: '1px solid #f0d4b3', padding: '8px 10px' }}>
                      <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Active</div>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: '#9a3412', letterSpacing: '-0.02em' }}>{activeDebrisCount}</div>
                    </div>
                    <div style={{ borderRadius: '10px', background: 'var(--bg-card)', border: '1px solid #f0d4b3', padding: '8px 10px' }}>
                      <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Waiting</div>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: '#9a3412', letterSpacing: '-0.02em' }}>{pendingDebrisCount}</div>
                    </div>
                  </div>
                  {tremorRemaining > 0 && (
                    <div style={{ marginTop: '8px', fontSize: '11px', fontWeight: 600, color: '#92400e' }}>
                      First debris release in {tremorRemaining.toFixed(1)}s.
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
          )}

          <section className="auto-panel-section">
            <div className="auto-section-title" style={{ marginBottom: '12px' }}>Completion summary</div>
            {results ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ borderRadius: '12px', border: '1px solid var(--border)', background: '#f4f7fb', padding: '12px 14px' }}>
                  <div style={{ fontSize: '32px', fontWeight: 700, color: results.trappedCount > 0 ? '#f97316' : '#22c55e', lineHeight: 1, letterSpacing: '-0.02em' }}>{formatSeconds(results.totalTime)}</div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '4px' }}>Evacuation time</div>
                </div>
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
                  <div style={{ borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '12px 14px' }}>
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
                  <div style={{ borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '12px 14px' }}>
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
                    onClick={launchSimulation}
                    style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Run Again
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
