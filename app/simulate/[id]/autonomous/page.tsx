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
import { createSimulation, evaluateSimulation, stepSimulation, type SimulationResults, type SimulationState } from '@/src/simulation/engine'
import { edgeKey, getBuildingById, getNode, type FloorModel } from '@/src/simulation/building-model'
import { createSimulationRun, saveDensityCells, saveSimulationResults } from '@/src/services/simulation.service'
import { getDefaultHazardRadius, getHazardStorageKey, loadHazardPlan, placedHazardToZone, saveHazardPlan, type PlacedHazard } from '@/src/simulation/hazard-placement'
import {
  createSpatialGridTrace,
  densityCellsFromTrace,
  getRenderableGridCells,
  gridCellRect,
  updateSpatialGridTrace,
  type SpatialGridTrace,
} from '@/src/simulation/spatial-grid'

type DisasterType = 'fire' | 'earthquake'

const SIMULATION_SECONDS_PER_MS = 0.35 / 120
const MAX_FRAME_DELTA_MS = 48
const HAZARD_GROWTH_MULTIPLIER = 0.45
const FLOOR_VIEW_WIDTH = 1200
const FLOOR_VIEW_HEIGHT = 675

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

/**
 * Softer pastel palette for the heatmap overlay. Distinct from `getHeatColor`
 * (which is used for alert-style severity badges) — these tones are
 * deliberately light so they layer over the floorplan without overwhelming
 * the underlying detail or competing with the agent dots.
 */
function getHeatmapColor(intensity: number) {
  if (intensity >= 0.78) return '#fb7185'   // soft coral
  if (intensity >= 0.55) return '#fb923c'   // soft orange
  if (intensity >= 0.32) return '#fcd34d'   // soft amber
  if (intensity >= 0.12) return '#86efac'   // soft mint
  return '#a7f3d0'                           // very pale mint
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
  /** Per-room population overrides keyed by NavNode.id. Rooms in this map use
   *  their fixed value; rooms NOT in this map share the remaining budget
   *  (totalAgents − sum of overrides) proportionally to their capacity. */
  const [roomOverrides, setRoomOverrides] = useState<Record<string, number>>({})
  /** Toggle for the soft pastel congestion heatmap overlay on the floorplan. */
  const [showHeatmap, setShowHeatmap] = useState(true)
  const [simulationSpeed, setSimulationSpeed] = useState(1)
  const [simState, setSimState] = useState<SimulationState | null>(null)
  const [trace, setTrace] = useState<AutonomousTrace | null>(null)
  const [gridTrace, setGridTrace] = useState<SpatialGridTrace | null>(null)
  const [results, setResults] = useState<SimulationResults | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveMessage, setSaveMessage] = useState('')
  const [savedRunId, setSavedRunId] = useState<string | null>(null)
  const [placedHazards, setPlacedHazards] = useState<PlacedHazard[]>([])
  const [selectedHazardId, setSelectedHazardId] = useState<string | null>(null)
  const dropRef = useRef<HTMLDivElement | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const hazardDragRef = useRef<{ id: string; pointerId: number; offsetX: number; offsetY: number; invalidated: boolean } | null>(null)
  const [draggingHazardId, setDraggingHazardId] = useState<string | null>(null)

  const simStateRef = useRef<SimulationState | null>(null)
  const traceRef = useRef<AutonomousTrace | null>(null)
  const gridTraceRef = useRef<SpatialGridTrace | null>(null)
  const launchedAgentCountRef = useRef(0)
  const animationFrameRef = useRef<number | null>(null)
  const lastFrameTimeRef = useRef<number | null>(null)
  const totalAgents = maxAgents > 0
    ? clamp(agentCountOverride ?? defaultAgentCount, 1, maxAgents)
    : 1
  const activeTrace = trace ?? baseTrace
  const hazardEditingLocked = isPlaying
  const selectedHazard = useMemo(
    () => placedHazards.find((hazard) => hazard.id === selectedHazardId) ?? null,
    [placedHazards, selectedHazardId],
  )
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

  const invalidateRuntimePreview = useCallback(() => {
    if (isPlaying) return
    if (!simStateRef.current && !gridTraceRef.current && !results && !savedRunId && saveStatus === 'idle') return

    setSimState(null)
    setTrace(null)
    setGridTrace(null)
    setResults(null)
    setSavedRunId(null)
    setSaveStatus('idle')
    setSaveMessage('')
    traceRef.current = baseTrace
    gridTraceRef.current = null
    simStateRef.current = null
    launchedAgentCountRef.current = 0
  }, [baseTrace, isPlaying, results, saveStatus, savedRunId])

  const floorPointFromClient = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current
    if (!svg) return null
    const rect = svg.getBoundingClientRect()
    if (!rect.width || !rect.height) return null
    return {
      x: ((clientX - rect.left) / rect.width) * FLOOR_VIEW_WIDTH,
      y: ((clientY - rect.top) / rect.height) * FLOOR_VIEW_HEIGHT,
    }
  }, [])

  const updateHazard = useCallback((hazardId: string, updater: (hazard: PlacedHazard) => PlacedHazard) => {
    if (hazardEditingLocked) return
    invalidateRuntimePreview()
    setPlacedHazards((prev) => prev.map((hazard) => (
      hazard.id === hazardId ? updater(hazard) : hazard
    )))
  }, [hazardEditingLocked, invalidateRuntimePreview])

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    if (hazardEditingLocked) return
    const type = event.dataTransfer.getData('application/x-hazard') as PlacedHazard['type']
    if (!type || !dropRef.current) return
    const rect = dropRef.current.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    const px = ((event.clientX - rect.left) / rect.width) * FLOOR_VIEW_WIDTH
    const py = ((event.clientY - rect.top) / rect.height) * FLOOR_VIEW_HEIGHT
    const radius = getDefaultHazardRadius(type)
    const x = clamp(px, radius, FLOOR_VIEW_WIDTH - radius)
    const y = clamp(py, radius, FLOOR_VIEW_HEIGHT - radius)
    const id = `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

    invalidateRuntimePreview()
    setSelectedHazardId(id)
    setPlacedHazards((prev) => [
      ...prev,
      {
        id,
        type,
        x,
        y,
        radius,
      },
    ])
  }, [hazardEditingLocked, invalidateRuntimePreview])

  const handleDragStart = (type: PlacedHazard['type']) => (event: React.DragEvent<HTMLButtonElement>) => {
    if (hazardEditingLocked) {
      event.preventDefault()
      return
    }
    event.dataTransfer.setData('application/x-hazard', type)
    event.dataTransfer.effectAllowed = 'copy'
    if (typeof document !== 'undefined') {
      const dragImage = createHazardDragImage(type)
      event.dataTransfer.setDragImage(dragImage, 32, 32)
      window.setTimeout(() => dragImage.remove(), 0)
    }
  }

  const removeHazard = useCallback((hazardId: string) => {
    if (hazardEditingLocked) return
    invalidateRuntimePreview()
    setPlacedHazards((prev) => prev.filter((hazard) => hazard.id !== hazardId))
    if (selectedHazardId === hazardId) setSelectedHazardId(null)
  }, [hazardEditingLocked, invalidateRuntimePreview, selectedHazardId])

  const clearHazards = useCallback(() => {
    if (hazardEditingLocked) return
    invalidateRuntimePreview()
    setPlacedHazards([])
    setSelectedHazardId(null)
  }, [hazardEditingLocked, invalidateRuntimePreview])

  const handleHazardPointerDown = useCallback((hazard: PlacedHazard) => (event: React.PointerEvent<SVGGElement>) => {
    if (hazardEditingLocked) return
    const point = floorPointFromClient(event.clientX, event.clientY)
    if (!point) return

    event.preventDefault()
    event.stopPropagation()
    setSelectedHazardId(hazard.id)
    hazardDragRef.current = {
      id: hazard.id,
      pointerId: event.pointerId,
      offsetX: point.x - hazard.x,
      offsetY: point.y - hazard.y,
      invalidated: false,
    }
    setDraggingHazardId(hazard.id)
    event.currentTarget.setPointerCapture(event.pointerId)
  }, [floorPointFromClient, hazardEditingLocked])

  const handleHazardPointerMove = useCallback((event: React.PointerEvent<SVGSVGElement>) => {
    const drag = hazardDragRef.current
    if (!drag || hazardEditingLocked) return
    const point = floorPointFromClient(event.clientX, event.clientY)
    if (!point) return
    if (!drag.invalidated) {
      invalidateRuntimePreview()
      drag.invalidated = true
    }

    setPlacedHazards((prev) => prev.map((hazard) => {
      if (hazard.id !== drag.id) return hazard
      return {
        ...hazard,
        x: clamp(point.x - drag.offsetX, hazard.radius, FLOOR_VIEW_WIDTH - hazard.radius),
        y: clamp(point.y - drag.offsetY, hazard.radius, FLOOR_VIEW_HEIGHT - hazard.radius),
      }
    }))
  }, [floorPointFromClient, hazardEditingLocked, invalidateRuntimePreview])

  const handleHazardPointerEnd = useCallback((event: React.PointerEvent<SVGSVGElement>) => {
    const drag = hazardDragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    hazardDragRef.current = null
    setDraggingHazardId(null)
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

      const runId = await createSimulationRun({
        disasterType: disaster,
        agentCount,
        gridWidth: 1200,
        gridHeight: 675,
        exitCount: floorModel.nodes.filter((node) => node.type === 'exit').length,
        wallDensity: 0,
        speedMs: Math.round(140 / simulationSpeed),
      }, regionId)

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
      setSaveMessage('Run saved. Open the linked analysis to inspect this exact run.')
    } catch (error) {
      console.error('Failed to save autonomous run:', error)
      setSaveStatus('error')
      setSaveMessage('Simulation completed, but saving to analysis failed.')
    }
  }, [disaster, regionId, simulationSpeed])

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

  const liveCongestion = useMemo(() => getCounts(simState, floor), [simState, floor])
  const topHotspots = useMemo(() => (
    floor && activeTrace ? getTopNodeHotspots(floor, activeTrace, 4) : []
  ), [activeTrace, floor])
  const topBottlenecks = useMemo(() => (
    floor && activeTrace ? buildBottleneckSummaries(floor, activeTrace) : []
  ), [activeTrace, floor])
  const gridCells = useMemo(() => (
    gridTrace ? getRenderableGridCells(gridTrace) : []
  ), [gridTrace])
  const exitUsage = useMemo(() => describeExitUsage(results), [results])
  const peakCongestion = useMemo(() => (activeTrace ? getPeakCongestion(activeTrace) : 0), [activeTrace])

  const setPreset = useCallback((ratio: number) => {
    if (!maxAgents) return
    setAgentCountOverride(Math.max(1, Math.round(maxAgents * ratio)))
  }, [maxAgents])

  const launchSimulation = useCallback(() => {
    if (!floor) return

    const nextState = createSimulation(floor, {
      disasterType: disaster,
      agentsPerRoom: roomAllocations,
      hazardGrowthMultiplier: HAZARD_GROWTH_MULTIPLIER,
      hazardOverrides: hazardZones,
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
    setIsPlaying(true)
  }, [disaster, floor, roomAllocations, effectiveAgentCount, hazardZones])

  const resetSimulation = useCallback(() => {
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
  }, [baseTrace])

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
        }

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
          background: #f4f7fb;
          padding: 12px 14px;
        }

        /* Gentle breathing pulse on heatmap blobs — adds life without
           being distracting. */
        @keyframes heatmap-pulse {
          0%, 100% { opacity: 0.55; }
          50%      { opacity: 0.75; }
        }
        .auto-heatmap-layer circle,
        .auto-heatmap-layer line {
          animation: heatmap-pulse 4s ease-in-out infinite;
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

        .auto-room-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }

        .auto-room-card {
          border-radius: 12px;
          border: 1px solid #dee5ee;
          background: #f4f7fb;
          padding: 10px 12px;
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

          <section className="auto-panel-section">
            <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: APP_ACCENT_DARK, marginBottom: '12px' }}>
              Hazard placement
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
              Drag hazards onto the map. You can place multiple fire, smoke, or debris zones.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
              {allowedHazardTypes.map((type) => (
                <button
                  key={type}
                  draggable={!hazardEditingLocked}
                  disabled={hazardEditingLocked}
                  onDragStart={handleDragStart(type)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
                    padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)',
                    background: hazardEditingLocked ? '#f8fafc' : '#ffffff',
                    color: hazardEditingLocked ? 'var(--text-muted)' : 'var(--text-primary)',
                    fontSize: '12px', fontWeight: 600, cursor: hazardEditingLocked ? 'not-allowed' : 'grab',
                    opacity: hazardEditingLocked ? 0.65 : 1,
                    transition: 'all 0.15s',
                  }}
                >
                  {hazardLabel(type, disaster)}
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{hazardEditingLocked ? 'Locked' : 'Drag to map'}</span>
                </button>
              ))}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {hazardEditingLocked ? 'Hazard editing unlocks when the run is paused, stopped, or reset.' : 'Placed hazards stay selectable and draggable on the map.'}
            </div>
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
            <div className="auto-room-grid">
              {floor.nodes.filter((node) => node.type === 'room').map((roomNode) => {
                const allocated = roomAllocations[roomNode.id] ?? 0
                const isOverridden = Object.prototype.hasOwnProperty.call(roomOverrides, roomNode.id)
                const utilization = roomNode.capacity > 0 ? allocated / roomNode.capacity : 0
                const utilColor = utilization >= 0.9 ? '#ef4444' : utilization >= 0.6 ? '#f59e0b' : '#22c55e'
                return (
                  <div
                    key={roomNode.id}
                    className="auto-room-card"
                    style={{
                      borderColor: isOverridden ? APP_ACCENT : 'var(--border)',
                      boxShadow: isOverridden ? `0 0 0 1px ${APP_ACCENT}` : 'none',
                      transition: 'box-shadow 120ms, border-color 120ms',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', marginBottom: '6px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {roomNode.label}
                      </div>
                      {isOverridden && (
                        <button
                          type="button"
                          onClick={() => clearRoomOverride(roomNode.id)}
                          aria-label={`Reset ${roomNode.label} to auto`}
                          title="Reset to auto"
                          style={{ background: 'none', border: 'none', padding: 0, color: 'var(--text-muted)', fontSize: '10px', fontWeight: 600, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.08em' }}
                        >
                          Auto
                        </button>
                      )}
                    </div>
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
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        borderRadius: '8px',
                        border: `1px solid ${isOverridden ? APP_ACCENT : 'var(--border)'}`,
                        background: '#ffffff',
                        color: APP_ACCENT_DARK,
                        fontSize: '18px',
                        fontWeight: 700,
                        letterSpacing: '-0.02em',
                        textAlign: 'center',
                        outline: 'none',
                      }}
                    />
                    <div style={{ marginTop: '6px', height: '4px', borderRadius: '2px', background: '#e2e8f0', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${Math.min(100, utilization * 100)}%`,
                          height: '100%',
                          background: utilColor,
                          transition: 'width 200ms, background 200ms',
                        }}
                      />
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '4px', display: 'flex', justifyContent: 'space-between' }}>
                      <span>capacity {roomNode.capacity}</span>
                      <span style={{ color: utilColor, fontWeight: 700 }}>{Math.round(utilization * 100)}%</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

        </aside>

        <main className="auto-panel auto-map-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{building?.name ?? regionId} {floor.label}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Autonomous crowd overlay on the real floorplan</div>
            </div>
            <div className="auto-chip-row">
              <button
                type="button"
                onClick={() => setShowHeatmap((v) => !v)}
                title="Toggle congestion heatmap overlay"
                style={{
                  padding: '6px 10px',
                  borderRadius: '8px',
                  background: showHeatmap ? `${APP_ACCENT}14` : '#ffffff',
                  border: `1px solid ${showHeatmap ? `${APP_ACCENT}44` : 'var(--border)'}`,
                  fontSize: '12px',
                  fontWeight: 600,
                  color: showHeatmap ? APP_ACCENT_DARK : 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.15s',
                }}
              >
                <span style={{
                  width: '24px',
                  height: '6px',
                  borderRadius: '3px',
                  background: showHeatmap
                    ? 'linear-gradient(90deg, #a7f3d0 0%, #fcd34d 50%, #fb923c 80%, #fb7185 100%)'
                    : '#e2e8f0',
                  transition: 'background 0.15s',
                }} />
                Heatmap {showHeatmap ? 'on' : 'off'}
              </button>
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
            onDragOver={(event) => {
              if (!hazardEditingLocked) event.preventDefault()
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={floor.floorplanSrc} alt={`${building?.name ?? regionId} ${floor.label} floor plan`} />
            <svg
              ref={svgRef}
              viewBox={`0 0 ${FLOOR_VIEW_WIDTH} ${FLOOR_VIEW_HEIGHT}`}
              preserveAspectRatio="xMidYMid meet"
              aria-hidden="true"
              onPointerMove={handleHazardPointerMove}
              onPointerUp={handleHazardPointerEnd}
              onPointerCancel={handleHazardPointerEnd}
            >
              {/* Defs: Gaussian blur filter for the heatmap blobs. */}
              <defs>
                <filter id="heatmap-soft-blur" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="16" />
                </filter>
              </defs>

              {/* ── Heatmap layer (drawn FIRST so agents and exits sit on top) ──
                   Pastel colors layered behind a Gaussian blur produce smooth
                   atmospheric blobs at congested nodes — readable at a glance,
                   never harsh, never competing with agent dots. */}
              {showHeatmap && gridCells.length > 0 && (
                <g
                  className="auto-heatmap-layer"
                  style={{ filter: 'url(#heatmap-soft-blur)' }}
                  pointerEvents="none"
                >
                  {gridCells.map((cell) => {
                    const rect = gridCellRect(cell)
                    const intensity = Math.max(cell.intensity, cell.hazardIntensity * 0.75)
                    if (intensity < 0.08) return null
                    return (
                      <rect
                        key={`grid-cell-${cell.cellX}-${cell.cellY}`}
                        x={rect.x}
                        y={rect.y}
                        width={rect.width}
                        height={rect.height}
                        rx="4"
                        fill={getHeatmapColor(intensity)}
                        opacity={0.32 + intensity * 0.42}
                      />
                    )
                  })}
                </g>
              )}

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

              {!hazardEditingLocked && placedHazards.map((hazard) => (
                <g
                  key={hazard.id}
                  onPointerDown={handleHazardPointerDown(hazard)}
                  style={{ cursor: hazardEditingLocked ? 'not-allowed' : draggingHazardId === hazard.id ? 'grabbing' : 'grab' }}
                >
                  {hazard.type === 'debris' ? (
                    <rect
                      x={hazard.x - hazard.radius}
                      y={hazard.y - hazard.radius}
                      width={hazard.radius * 2}
                      height={hazard.radius * 2}
                      fill={selectedHazardId === hazard.id ? 'rgba(245, 158, 11, 0.35)' : 'rgba(120, 53, 15, 0.35)'}
                      stroke={selectedHazardId === hazard.id ? '#f59e0b' : '#92400e'}
                      strokeWidth={selectedHazardId === hazard.id ? '3' : '2'}
                      rx="4"
                    />
                  ) : (
                    <circle
                      cx={hazard.x}
                      cy={hazard.y}
                      r={hazard.radius}
                      fill={hazard.type === 'fire' ? 'rgba(239, 68, 68, 0.28)' : 'rgba(100, 116, 139, 0.28)'}
                      stroke={selectedHazardId === hazard.id ? APP_ACCENT_DARK : hazard.type === 'fire' ? '#ef4444' : '#64748b'}
                      strokeWidth={selectedHazardId === hazard.id ? '3' : '2'}
                    />
                  )}
                  <text x={hazard.x} y={hazard.y + 4} textAnchor="middle" fontSize="10" fontWeight="700" fill="#0f172a">
                    {hazardLabel(hazard.type, disaster)}
                  </text>
                </g>
              ))}

              {simState?.hazards.filter((hazard) => hazard.active).map((hazard) => (
                <g key={hazard.zone.id} pointerEvents="none" opacity={hazardEditingLocked ? 1 : 0.4}>
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
            {showHeatmap && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '12px', borderLeft: '1px solid var(--border)' }}>
                <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Congestion
                </span>
                <span style={{
                  display: 'inline-block',
                  width: '120px',
                  height: '8px',
                  borderRadius: '4px',
                  background: 'linear-gradient(90deg, #a7f3d0 0%, #fcd34d 50%, #fb923c 80%, #fb7185 100%)',
                  boxShadow: '0 1px 2px rgba(15,23,42,0.05)',
                }} />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Low → High</span>
              </div>
            )}
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
                disabled={placedHazards.length === 0 || hazardEditingLocked}
                style={{
                  padding: '5px 10px', borderRadius: '6px', border: `1px solid ${placedHazards.length === 0 || hazardEditingLocked ? 'var(--border)' : 'rgba(239,68,68,0.2)'}`,
                  background: placedHazards.length === 0 || hazardEditingLocked ? '#f8fafc' : '#fef2f2',
                  color: placedHazards.length === 0 || hazardEditingLocked ? 'var(--text-muted)' : '#b91c1c',
                  fontSize: '11px', fontWeight: 600, cursor: placedHazards.length === 0 || hazardEditingLocked ? 'not-allowed' : 'pointer',
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
                  onClick={() => {
                    if (!hazardEditingLocked) setSelectedHazardId(hazard.id)
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px',
                    padding: '8px 10px', borderRadius: '10px',
                    border: selectedHazardId === hazard.id ? `1px solid ${APP_ACCENT}66` : '1px solid var(--border)',
                    background: selectedHazardId === hazard.id ? `${APP_ACCENT}14` : '#ffffff',
                    cursor: hazardEditingLocked ? 'not-allowed' : 'pointer',
                    opacity: hazardEditingLocked ? 0.7 : 1,
                  }}
                >
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{index + 1}. {hazardLabel(hazard.type, disaster)}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>x {Math.round(hazard.x)}, y {Math.round(hazard.y)}</div>
                  </div>
                  <button
                    disabled={hazardEditingLocked}
                    onClick={(event) => {
                      event.stopPropagation()
                      removeHazard(hazard.id)
                    }}
                    style={{
                      padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.2)',
                      background: hazardEditingLocked ? '#f8fafc' : '#fef2f2',
                      color: hazardEditingLocked ? 'var(--text-muted)' : '#b91c1c',
                      fontSize: '11px', fontWeight: 600, cursor: hazardEditingLocked ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            {selectedHazard && (
              <div style={{ marginTop: '12px', borderRadius: '12px', border: `1px solid ${APP_ACCENT}33`, background: `${APP_ACCENT}0f`, padding: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '10px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Edit {hazardLabel(selectedHazard.type, disaster)}
                  </div>
                  {hazardEditingLocked && (
                    <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      Locked
                    </div>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    X
                    <input
                      type="number"
                      min={selectedHazard.radius}
                      max={FLOOR_VIEW_WIDTH - selectedHazard.radius}
                      value={Math.round(selectedHazard.x)}
                      disabled={hazardEditingLocked}
                      onChange={(event) => {
                        const value = Number.parseFloat(event.target.value)
                        if (!Number.isFinite(value)) return
                        updateHazard(selectedHazard.id, (hazard) => ({
                          ...hazard,
                          x: clamp(value, hazard.radius, FLOOR_VIEW_WIDTH - hazard.radius),
                        }))
                      }}
                      style={{ padding: '7px 8px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '12px', color: 'var(--text-primary)', background: hazardEditingLocked ? '#f8fafc' : '#ffffff' }}
                    />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Y
                    <input
                      type="number"
                      min={selectedHazard.radius}
                      max={FLOOR_VIEW_HEIGHT - selectedHazard.radius}
                      value={Math.round(selectedHazard.y)}
                      disabled={hazardEditingLocked}
                      onChange={(event) => {
                        const value = Number.parseFloat(event.target.value)
                        if (!Number.isFinite(value)) return
                        updateHazard(selectedHazard.id, (hazard) => ({
                          ...hazard,
                          y: clamp(value, hazard.radius, FLOOR_VIEW_HEIGHT - hazard.radius),
                        }))
                      }}
                      style={{ padding: '7px 8px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '12px', color: 'var(--text-primary)', background: hazardEditingLocked ? '#f8fafc' : '#ffffff' }}
                    />
                  </label>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Type
                    <select
                      value={selectedHazard.type}
                      disabled={hazardEditingLocked}
                      onChange={(event) => {
                        const nextType = event.target.value as PlacedHazard['type']
                        updateHazard(selectedHazard.id, (hazard) => ({
                          ...hazard,
                          type: nextType,
                          radius: hazard.radius || getDefaultHazardRadius(nextType),
                        }))
                      }}
                      style={{ padding: '7px 8px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '12px', color: 'var(--text-primary)', background: hazardEditingLocked ? '#f8fafc' : '#ffffff' }}
                    >
                      {allowedHazardTypes.map((type) => (
                        <option key={type} value={type}>{hazardLabel(type, disaster)}</option>
                      ))}
                    </select>
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Radius
                    <input
                      type="number"
                      min={10}
                      max={160}
                      value={Math.round(selectedHazard.radius)}
                      disabled={hazardEditingLocked}
                      onChange={(event) => {
                        const value = Number.parseFloat(event.target.value)
                        if (!Number.isFinite(value)) return
                        updateHazard(selectedHazard.id, (hazard) => {
                          const radius = clamp(value, 10, 160)
                          return {
                            ...hazard,
                            radius,
                            x: clamp(hazard.x, radius, FLOOR_VIEW_WIDTH - radius),
                            y: clamp(hazard.y, radius, FLOOR_VIEW_HEIGHT - radius),
                          }
                        })
                      }}
                      style={{ padding: '7px 8px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '12px', color: 'var(--text-primary)', background: hazardEditingLocked ? '#f8fafc' : '#ffffff' }}
                    />
                  </label>
                </div>
              </div>
            )}
          </section>

          <section className="auto-panel-section">
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>Completion summary</div>
            {results ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ borderRadius: '12px', border: '1px solid var(--border)', background: '#f4f7fb', padding: '12px 14px' }}>
                  <div style={{ fontSize: '32px', fontWeight: 700, color: results.trappedCount > 0 ? '#f97316' : '#22c55e', lineHeight: 1, letterSpacing: '-0.02em' }}>{formatSeconds(results.totalTime)}</div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '4px' }}>Evacuation time</div>
                </div>
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
                    onClick={() => router.push(savedRunId ? `/analysis/runs?runId=${encodeURIComponent(savedRunId)}` : '/analysis/runs')}
                    disabled={saveStatus === 'saving'}
                    style={{
                      padding: '10px 16px',
                      borderRadius: '8px',
                      border: 'none',
                      background: saveStatus === 'saving' ? '#94a3b8' : '#2db8b0',
                      color: '#ffffff',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: saveStatus === 'saving' ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {saveStatus === 'saving' ? 'Saving Analysis...' : 'Open Analysis'}
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
