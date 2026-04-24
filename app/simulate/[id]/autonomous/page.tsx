'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/src/hooks/useAuth'
import {
  buildBottleneckSummaries,
  buildZoneSummaries,
  computeAccurateCongestion,
  createAutonomousTrace,
  distributeAgentsByCapacity,
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
import { createSimulationRun, saveSimulationResults } from '@/src/services/simulation.service'
import { getHazardStorageKey, loadHazardPlan, placedHazardToZone, saveHazardPlan, type PlacedHazard } from '@/src/simulation/hazard-placement'

type DisasterType = 'fire' | 'earthquake'

const SIMULATION_SECONDS_PER_MS = 0.35 / 120
const MAX_FRAME_DELTA_MS = 48
const HAZARD_GROWTH_MULTIPLIER = 0.45
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

const MOVEMENT_OPTIONS = [
  { label: '0.85x', value: 0.85 },
  { label: '1.00x', value: 1.0 },
  { label: '1.20x', value: 1.2 },
] as const

const PLAYBACK_OPTIONS = [
  { label: '1x', value: 1 },
  { label: '1.5x', value: 1.5 },
  { label: '2x', value: 2 },
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
  const [movementMultiplier, setMovementMultiplier] = useState(1)
  const [playbackMultiplier, setPlaybackMultiplier] = useState(1)
  const [simState, setSimState] = useState<SimulationState | null>(null)
  const [trace, setTrace] = useState<AutonomousTrace | null>(null)
  const [results, setResults] = useState<SimulationResults | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveMessage, setSaveMessage] = useState('')
  const [savedRunId, setSavedRunId] = useState<string | null>(null)
  const [placedHazards, setPlacedHazards] = useState<PlacedHazard[]>([])
  const [selectedHazardId, setSelectedHazardId] = useState<string | null>(null)
  const dropRef = useRef<HTMLDivElement | null>(null)

  const simStateRef = useRef<SimulationState | null>(null)
  const traceRef = useRef<AutonomousTrace | null>(null)
  const launchedAgentCountRef = useRef(0)
  const animationFrameRef = useRef<number | null>(null)
  const lastFrameTimeRef = useRef<number | null>(null)
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
    setPlacedHazards(plan?.hazards ?? [])
    setSelectedHazardId(null)
  }, [hazardStorageKey])

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
  }, [])

  useEffect(() => {
    simStateRef.current = simState
  }, [simState])

  useEffect(() => {
    traceRef.current = activeTrace
  }, [activeTrace])

  const persistCompletedRun = useCallback(async (
    completedState: SimulationState,
    completedTrace: AutonomousTrace,
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
        speedMs: Math.round(140 * movementMultiplier),
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

      setSavedRunId(runId)
      setSaveStatus('saved')
      setSaveMessage('Run saved. You can open the analysis page to inspect congestion zones.')
    } catch (error) {
      console.error('Failed to save autonomous run:', error)
      setSaveStatus('error')
      setSaveMessage('Simulation completed, but saving to analysis failed.')
    }
  }, [disaster, movementMultiplier, regionId])

  useEffect(() => {
    if (!floor || !isPlaying) return

    const stepFrame = (timestamp: number) => {
      const currentState = simStateRef.current
      const currentTrace = traceRef.current

      if (!currentState || !currentTrace) {
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
      const dt = elapsedMs * SIMULATION_SECONDS_PER_MS * playbackMultiplier
      currentState.hazardGrowthMultiplier = HAZARD_GROWTH_MULTIPLIER * playbackMultiplier
      const nextState = stepSimulation(currentState, floor, dt)
      const nextCongestion = computeAccurateCongestion(nextState)
      const nextTrace = updateAutonomousTrace(currentTrace, nextCongestion, dt)

      simStateRef.current = nextState
      traceRef.current = nextTrace
      setSimState(nextState)
      setTrace(nextTrace)

      if (nextState.finished) {
        setIsPlaying(false)
        const completedResults = evaluateSimulation(nextState, floor)
        setResults(completedResults)
        void persistCompletedRun(
          nextState,
          nextTrace,
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
  }, [floor, isPlaying, persistCompletedRun, playbackMultiplier])

  const roomAllocations = useMemo(() => (
    floor ? distributeAgentsByCapacity(floor, totalAgents) : {}
  ), [floor, totalAgents])

  const liveCongestion = useMemo(() => getCounts(simState, floor), [simState, floor])
  const topHotspots = useMemo(() => (
    floor && activeTrace ? getTopNodeHotspots(floor, activeTrace, 4) : []
  ), [activeTrace, floor])
  const topBottlenecks = useMemo(() => (
    floor && activeTrace ? buildBottleneckSummaries(floor, activeTrace) : []
  ), [activeTrace, floor])
  const exitUsage = useMemo(() => describeExitUsage(results), [results])
  const peakCongestion = useMemo(() => (activeTrace ? getPeakCongestion(activeTrace) : 0), [activeTrace])
  const peakDensity = useMemo(() => (
    floor && activeTrace ? getGlobalPeakDensityPercent(floor, activeTrace) : 0
  ), [activeTrace, floor])

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
      speedMultiplier: movementMultiplier,
      hazardOverrides: hazardZones,
    })

    nextState.running = true
    launchedAgentCountRef.current = totalAgents

    const nextTrace = createAutonomousTrace(floor)
    const initialCongestion = computeAccurateCongestion(nextState)
    const primedTrace = updateAutonomousTrace(nextTrace, initialCongestion, 0)

    simStateRef.current = nextState
    traceRef.current = primedTrace
    setSimState(nextState)
    setTrace(primedTrace)
    setResults(null)
    setSavedRunId(null)
    setSaveStatus('idle')
    setSaveMessage('')
    setIsPlaying(true)
  }, [disaster, floor, movementMultiplier, roomAllocations, totalAgents, hazardZones])

  const resetSimulation = useCallback(() => {
    setIsPlaying(false)
    setSimState(null)
    setTrace(null)
    traceRef.current = baseTrace
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
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '88px 24px 56px', background: '#f8fafc' }}>
        <div style={{ width: '100%', maxWidth: '620px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '28px 30px', boxShadow: '0 10px 35px rgba(15, 23, 42, 0.08)' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#2db8b0', marginBottom: '12px' }}>
            Autonomous Simulation
          </div>
          <h1 style={{ margin: '0 0 10px', fontSize: '26px', fontWeight: 800, color: '#0f172a' }}>
            Floor data not available
          </h1>
          <p style={{ margin: '0 0 20px', fontSize: '14px', color: '#475569', lineHeight: 1.7 }}>
            {!building
              ? `No simulation data is registered for building "${regionId}".`
              : `Floor ${floorIndex + 1} is not available for this building yet.`}
          </p>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              onClick={() => router.push(`/simulate/${encodeURIComponent(regionId)}/disaster`)}
              style={{ padding: '11px 16px', borderRadius: '10px', border: 'none', background: '#2db8b0', color: '#ffffff', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
            >
              Back to Disaster Setup
            </button>
            <button
              onClick={() => router.push(`/simulate/${encodeURIComponent(regionId)}/run?disaster=${disaster}&floor=${floorIndex}`)}
              style={{ padding: '11px 16px', borderRadius: '10px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#0f172a', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
            >
              Open Manual Run
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', padding: '88px 24px 56px', background: '#f8fafc' }}>
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
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          box-shadow: 0 10px 30px rgba(15, 23, 42, 0.06);
        }

        .auto-panel-section {
          padding: 18px 20px;
          border-bottom: 1px solid #eef2f7;
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
          padding: 8px 12px;
          border-radius: 10px;
          border: 1px solid #cbd5e1;
          background: #ffffff;
          color: #0f172a;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }

        .auto-choice--active {
          color: #ffffff;
          border-color: transparent;
        }

        .auto-stat-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        .auto-stat {
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          padding: 12px 14px;
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
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          padding: 10px 12px;
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
            color: '#64748b',
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
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 12px', borderRadius: '999px', background: `${meta.accent}12`, border: `1px solid ${meta.accent}30`, marginBottom: '12px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: meta.accent }} />
              <span style={{ fontSize: '12px', fontWeight: 700, color: meta.accent }}>{building?.name ?? regionId} / {floor.label} / Autonomous</span>
            </div>
            <h1 style={{ margin: '0 0 8px', fontSize: '30px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>{meta.label}</h1>
            <p style={{ margin: 0, fontSize: '14px', color: '#475569', lineHeight: 1.7, maxWidth: '840px' }}>
              {meta.subtitle} Agents stay on the navigation graph only. They spawn from room nodes, move along legal corridor edges, and never cut through walls.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <button
              onClick={launchSimulation}
              disabled={isPlaying}
              style={{
                padding: '12px 18px',
                borderRadius: '12px',
                border: 'none',
                background: isPlaying ? '#cbd5e1' : meta.accent,
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: 800,
                cursor: isPlaying ? 'not-allowed' : 'pointer',
              }}
            >
              {simState ? 'Restart Autonomous Run' : 'Start Autonomous Run'}
            </button>
            <button
              onClick={() => setIsPlaying((current) => !current)}
              disabled={!simState || simState.finished}
              style={{
                padding: '12px 18px',
                borderRadius: '12px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#0f172a',
                fontSize: '13px',
                fontWeight: 800,
                cursor: !simState || simState.finished ? 'not-allowed' : 'pointer',
                opacity: !simState || simState.finished ? 0.5 : 1,
              }}
            >
              {isPlaying ? 'Pause' : 'Resume'}
            </button>
            <button
              onClick={resetSimulation}
              style={{
                padding: '12px 18px',
                borderRadius: '12px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#0f172a',
                fontSize: '13px',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      <div className="auto-layout">
        <aside className="auto-panel">
          <section className="auto-panel-section">
            <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: meta.accent, marginBottom: '12px' }}>
              Setup
            </div>

            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>Occupancy preset</div>
              <div className="auto-chip-row">
                {OCCUPANCY_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => setPreset(preset.ratio)}
                    className={`auto-choice ${totalAgents === Math.max(1, Math.round(maxAgents * preset.ratio)) ? 'auto-choice--active' : ''}`}
                    style={{ background: totalAgents === Math.max(1, Math.round(maxAgents * preset.ratio)) ? meta.accent : '#ffffff' }}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '8px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>Total agents</div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: meta.accent }}>{totalAgents} / {maxAgents}</div>
              </div>
              <input
                type="range"
                min={1}
                max={Math.max(1, maxAgents)}
                value={totalAgents}
                onChange={(event) => setAgentCountOverride(clamp(Number.parseInt(event.target.value || '1', 10), 1, Math.max(1, maxAgents)))}
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>Movement speed</div>
              <div className="auto-chip-row">
                {MOVEMENT_OPTIONS.map((option) => (
                  <button
                    key={option.label}
                    onClick={() => setMovementMultiplier(option.value)}
                    className={`auto-choice ${movementMultiplier === option.value ? 'auto-choice--active' : ''}`}
                    style={{ background: movementMultiplier === option.value ? meta.accent : '#ffffff' }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>Playback speed</div>
              <div className="auto-chip-row">
                {PLAYBACK_OPTIONS.map((option) => (
                  <button
                    key={option.label}
                    onClick={() => setPlaybackMultiplier(option.value)}
                    className={`auto-choice ${playbackMultiplier === option.value ? 'auto-choice--active' : ''}`}
                    style={{ background: playbackMultiplier === option.value ? meta.accent : '#ffffff' }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="auto-panel-section">
            <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: meta.accent, marginBottom: '12px' }}>
              Hazard placement
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px' }}>
              Drag hazards onto the map. You can place multiple fire, smoke, or debris zones.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
              {allowedHazardTypes.map((type) => (
                <button
                  key={type}
                  draggable
                  onDragStart={handleDragStart(type)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
                    padding: '10px 12px', borderRadius: '10px', border: '1px solid #e2e8f0',
                    background: '#ffffff', color: '#0f172a', fontSize: '12px', fontWeight: 700, cursor: 'grab',
                  }}
                >
                  {hazardLabel(type, disaster)}
                  <span style={{ fontSize: '11px', color: '#64748b' }}>Drag to map</span>
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>Active hazards</div>
              <button
                onClick={clearHazards}
                disabled={placedHazards.length === 0}
                style={{
                  padding: '6px 8px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.25)',
                  background: placedHazards.length === 0 ? '#f8fafc' : '#fff1f2',
                  color: placedHazards.length === 0 ? '#94a3b8' : '#b91c1c',
                  fontSize: '11px', fontWeight: 700, cursor: placedHazards.length === 0 ? 'not-allowed' : 'pointer',
                }}
              >
                Clear
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '220px', overflowY: 'auto' }}>
              {placedHazards.length === 0 && (
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>No hazards placed yet.</div>
              )}
              {placedHazards.map((hazard, index) => (
                <div
                  key={hazard.id}
                  onClick={() => setSelectedHazardId(hazard.id)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px',
                    padding: '8px 10px', borderRadius: '10px',
                    border: selectedHazardId === hazard.id ? `1px solid ${meta.accent}66` : '1px solid #e2e8f0',
                    background: selectedHazardId === hazard.id ? `${meta.accent}12` : '#ffffff',
                    cursor: 'pointer',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>{index + 1}. {hazardLabel(hazard.type, disaster)}</div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>x {Math.round(hazard.x)}, y {Math.round(hazard.y)}</div>
                  </div>
                  <button
                    onClick={(event) => {
                      event.stopPropagation()
                      removeHazard(hazard.id)
                    }}
                    style={{
                      padding: '4px 8px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.25)',
                      background: '#fff1f2', color: '#b91c1c', fontSize: '11px', fontWeight: 700, cursor: 'pointer',
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className="auto-panel-section">
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '12px' }}>Room spawn plan</div>
            <div className="auto-room-grid">
              {floor.nodes.filter((node) => node.type === 'room').map((roomNode) => (
                <div key={roomNode.id} className="auto-room-card">
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>{roomNode.label}</div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: meta.accent }}>{roomAllocations[roomNode.id] || 0}</div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>capacity {roomNode.capacity}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="auto-panel-section">
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '12px' }}>Run state</div>
            <div className="auto-stat-grid">
              <div className="auto-stat">
                <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Elapsed</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>{formatSeconds(simState?.elapsedTime || 0)}</div>
              </div>
              <div className="auto-stat">
                <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Status</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: isPlaying ? meta.accent : simState?.finished ? '#22c55e' : '#0f172a' }}>
                  {simState?.finished ? 'Done' : isPlaying ? 'Running' : simState ? 'Paused' : 'Ready'}
                </div>
              </div>
            </div>
            {saveStatus !== 'idle' && (
              <div style={{ marginTop: '12px', padding: '10px 12px', borderRadius: '10px', background: saveStatus === 'error' ? '#fef2f2' : '#f0fdf4', border: `1px solid ${saveStatus === 'error' ? '#fecaca' : '#bbf7d0'}`, fontSize: '12px', color: saveStatus === 'error' ? '#b91c1c' : '#166534' }}>
                {saveMessage}
                {savedRunId ? ` (run ${savedRunId.slice(0, 8)})` : ''}
              </div>
            )}
          </section>
        </aside>

        <main className="auto-panel auto-map-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>{building?.name ?? regionId} {floor.label}</div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>Autonomous crowd overlay on the real floorplan</div>
            </div>
            <div className="auto-chip-row">
              <div style={{ padding: '8px 10px', borderRadius: '10px', background: '#eff6ff', border: '1px solid #bfdbfe', fontSize: '12px', fontWeight: 700, color: '#1d4ed8' }}>
                Active {getActiveAgentCount(simState)}
              </div>
              <div style={{ padding: '8px 10px', borderRadius: '10px', background: '#f0fdf4', border: '1px solid #bbf7d0', fontSize: '12px', fontWeight: 700, color: '#15803d' }}>
                Evacuated {getEvacuatedAgentCount(simState)}
              </div>
              <div style={{ padding: '8px 10px', borderRadius: '10px', background: '#fff7ed', border: '1px solid #fed7aa', fontSize: '12px', fontWeight: 700, color: '#c2410c' }}>
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
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={floor.floorplanSrc} alt={`${building?.name ?? regionId} ${floor.label} floor plan`} />
            <svg viewBox="0 0 1200 675" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
              {SHOW_DEBUG_GRAPH && floor.edges.map((edge) => {
                const fromNode = getNode(floor, edge.from)
                const toNode = getNode(floor, edge.to)
                if (!fromNode || !toNode) return null

                const intensity = activeTrace ? getEdgeIntensity(edge, activeTrace) : 0
                const blocked = simState?.blockedEdges.has(edgeKey(edge.from, edge.to)) ?? false
                const stroke = blocked ? '#ef4444' : getHeatColor(intensity)
                const opacity = blocked ? 0.95 : 0.25 + intensity * 0.6

                return (
                  <line
                    key={`${edge.from}-${edge.to}`}
                    x1={fromNode.x}
                    y1={fromNode.y}
                    x2={toNode.x}
                    y2={toNode.y}
                    stroke={stroke}
                    strokeWidth={blocked ? 7 : 4 + intensity * 5}
                    strokeLinecap="round"
                    opacity={opacity}
                  />
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

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', marginTop: '12px', fontSize: '12px', color: '#64748b' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#2db8b0', display: 'inline-block' }} />
              Active agents
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
              Trapped agents / blocked hazards
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ffffff', border: '2px solid #ff6b35', display: 'inline-block' }} />
              Exits
            </div>
          </div>
        </main>

        <aside className="auto-panel">
          <section className="auto-panel-section">
            <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: meta.accent, marginBottom: '12px' }}>
              Live Metrics
            </div>
            <div className="auto-stat-grid">
              <div className="auto-stat">
                <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Peak congestion</div>
                <div style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a' }}>{peakCongestion}</div>
              </div>
              <div className="auto-stat">
                <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Peak density</div>
                <div style={{ fontSize: '22px', fontWeight: 800, color: peakDensity > 70 ? '#ef4444' : peakDensity > 45 ? '#f97316' : '#22c55e' }}>{peakDensity}%</div>
              </div>
              <div className="auto-stat">
                <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Evacuated</div>
                <div style={{ fontSize: '22px', fontWeight: 800, color: '#15803d' }}>{getEvacuatedAgentCount(simState)}</div>
              </div>
              <div className="auto-stat">
                <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Trapped</div>
                <div style={{ fontSize: '22px', fontWeight: 800, color: getTrappedAgentCount(simState) > 0 ? '#ef4444' : '#0f172a' }}>{getTrappedAgentCount(simState)}</div>
              </div>
            </div>
          </section>

          <section className="auto-panel-section">
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '12px' }}>Top hotspots</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {topHotspots.map(({ node, peak, average }) => (
                <div key={node.id} style={{ borderRadius: '12px', border: '1px solid #e2e8f0', background: '#f8fafc', padding: '10px 12px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>{node.label}</div>
                  <div style={{ fontSize: '11px', color: '#475569' }}>Peak load {peak}, average load {average.toFixed(1)}</div>
                </div>
              ))}
              {topHotspots.length === 0 && (
                <div style={{ fontSize: '12px', color: '#64748b' }}>Start a run to reveal crowd hotspots.</div>
              )}
            </div>
          </section>

          <section className="auto-panel-section">
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '12px' }}>Edge bottlenecks</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {topBottlenecks.slice(0, 4).map((bottleneck) => (
                <div key={bottleneck.zoneName} style={{ borderRadius: '12px', border: '1px solid #e2e8f0', background: '#ffffff', padding: '10px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '4px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>{bottleneck.zoneName}</div>
                    <div style={{ fontSize: '10px', fontWeight: 800, color: bottleneck.severity === 'HIGH' ? '#ef4444' : bottleneck.severity === 'MEDIUM' ? '#f97316' : '#22c55e' }}>
                      {bottleneck.severity}
                    </div>
                  </div>
                  <div style={{ fontSize: '11px', color: '#475569' }}>{bottleneck.description}</div>
                </div>
              ))}
              {topBottlenecks.length === 0 && (
                <div style={{ fontSize: '12px', color: '#64748b' }}>Bottleneck ranking will populate during the simulation.</div>
              )}
            </div>
          </section>

          <section className="auto-panel-section">
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '12px' }}>Completion summary</div>
            {results ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ borderRadius: '12px', border: '1px solid #e2e8f0', background: '#f8fafc', padding: '12px 14px' }}>
                  <div style={{ fontSize: '32px', fontWeight: 800, color: results.trappedCount > 0 ? '#f97316' : '#22c55e', lineHeight: 1 }}>{formatSeconds(results.totalTime)}</div>
                  <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '4px' }}>Evacuation time</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div className="auto-stat">
                    <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Reroutes</div>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>{results.totalReroutes}</div>
                  </div>
                  <div className="auto-stat">
                    <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Avg exposure</div>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>{results.avgHazardExposure.toFixed(1)}s</div>
                  </div>
                </div>
                {exitUsage.length > 0 && (
                  <div style={{ borderRadius: '12px', border: '1px solid #e2e8f0', background: '#ffffff', padding: '12px 14px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#64748b', marginBottom: '8px' }}>
                      Exit usage
                    </div>
                    {exitUsage.map(([exitId, count]) => (
                      <div key={exitId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', fontSize: '12px', color: '#0f172a', marginBottom: '4px' }}>
                        <span>{exitId}</span>
                        <strong>{count}</strong>
                      </div>
                    ))}
                  </div>
                )}
                {results.feedback.length > 0 && (
                  <div style={{ borderRadius: '12px', border: '1px solid #e2e8f0', background: '#ffffff', padding: '12px 14px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#64748b', marginBottom: '8px' }}>
                      Evaluator
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                      {results.feedback.map((line) => (
                        <div key={line} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                          <span style={{ width: '6px', height: '6px', marginTop: '6px', borderRadius: '50%', background: meta.accent, flexShrink: 0 }} />
                          <span style={{ fontSize: '12px', color: '#475569', lineHeight: 1.5 }}>{line}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => router.push('/analysis')}
                    style={{ padding: '11px 14px', borderRadius: '10px', border: 'none', background: '#2db8b0', color: '#ffffff', fontSize: '12px', fontWeight: 800, cursor: 'pointer' }}
                  >
                    Open Analysis
                  </button>
                  <button
                    onClick={() => router.push(`/simulate/${encodeURIComponent(regionId)}/run?disaster=${disaster}&floor=${floorIndex}`)}
                    style={{ padding: '11px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#0f172a', fontSize: '12px', fontWeight: 800, cursor: 'pointer' }}
                  >
                    Open Manual Drill
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: '12px', color: '#64748b', lineHeight: 1.7 }}>
                Run the autonomous simulation to generate evacuation time, reroutes, congestion peaks, and saved heatmap analysis data.
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  )
}
