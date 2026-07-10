'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getBuildingById, type FloorModel, type NavNode } from '@/src/simulation/building-model'
import {
  createSpatialGridTrace,
  getRenderableGridCells,
  gridCellRect,
  updateSpatialGridTrace,
  type SpatialGridTrace,
} from '@/src/simulation/spatial-grid'
import { createSimulation, stepSimulation, type SimulationState } from '@/src/simulation/engine'
import { getAgentRenderPosition } from '@/src/simulation/autonomous-analytics'
import { placedHazardToZone, type PlacedHazard } from '@/src/simulation/hazard-placement'
import type { SimulationZone } from '@/src/schema/simulation.types'

interface RunReplayProps {
  buildingId: string | null
  simulatedFloorIndex: number | null
  zones: SimulationZone[]
  agentCount?: number | null
  disasterType?: 'fire' | 'earthquake' | null
  hazards?: PlacedHazard[] | null
  agentsPerRoom?: Record<string, number> | null
  seed?: number | null
  hideHeader?: boolean
}

const VIEW_WIDTH = 1200
const VIEW_HEIGHT = 675
const PLAYBACK_SPEEDS = [0.5, 1, 2, 4] as const
const SIMULATION_SECONDS_PER_MS = 0.35 / 120
const MAX_FRAME_DELTA_MS = 48
const HAZARD_GROWTH_MULTIPLIER = 0.45
const ACCENT = '#2db8b0'
const ACCENT_DARK = '#1f9189'

function getHeatColor(intensity: number) {
  if (intensity >= 0.78) return '#e11d48'
  if (intensity >= 0.55) return '#ea580c'
  if (intensity >= 0.32) return '#f59e0b'
  if (intensity >= 0.12) return '#15803d'
  return '#16a34a'
}

const HEATMAP_LEGEND: { label: string; color: string; rangeLabel: string }[] = [
  { label: 'Critical', color: '#e11d48', rangeLabel: '≥ 78%' },
  { label: 'High',     color: '#ea580c', rangeLabel: '55–78%' },
  { label: 'Medium',   color: '#f59e0b', rangeLabel: '32–55%' },
  { label: 'Low',      color: '#15803d', rangeLabel: '12–32%' },
  { label: 'Minimal',  color: '#16a34a', rangeLabel: '< 12%' },
]

function allocateAgentsToRooms(rooms: NavNode[], totalAgents: number): Record<string, number> {
  const totalCap = rooms.reduce((sum, r) => sum + r.capacity, 0)
  if (rooms.length === 0 || totalCap === 0 || totalAgents <= 0) return {}

  const exact = rooms.map((r) => ({
    id: r.id,
    capacity: r.capacity,
    share: (totalAgents * r.capacity) / totalCap,
  }))
  const initial = exact.map((e) => ({ ...e, floorVal: Math.floor(e.share), frac: e.share - Math.floor(e.share) }))
  let assigned = initial.reduce((s, e) => s + e.floorVal, 0)
  const sortedByFrac = [...initial].sort((a, b) => b.frac - a.frac)
  let i = 0
  while (assigned < totalAgents && i < sortedByFrac.length) {
    sortedByFrac[i].floorVal++
    assigned++
    i++
  }
  const result: Record<string, number> = {}
  for (const e of initial) {
    result[e.id] = Math.max(0, Math.min(e.capacity, e.floorVal))
  }
  return result
}

export function RunReplay({
  buildingId,
  simulatedFloorIndex,
  zones: _zones,
  agentCount,
  disasterType,
  hazards,
  agentsPerRoom,
  seed,
  hideHeader = false,
}: RunReplayProps) {
  void _zones
  const building = useMemo(
    () => (buildingId ? getBuildingById(buildingId) ?? null : null),
    [buildingId],
  )

  const floor: FloorModel | null = useMemo(() => {
    if (!building) return null
    if (simulatedFloorIndex == null) return building.floors[0] ?? null
    return building.floors[simulatedFloorIndex] ?? building.floors[0] ?? null
  }, [building, simulatedFloorIndex])

  const disaster = (disasterType ?? 'fire') as 'fire' | 'earthquake'

  const buildFreshState = useCallback((): SimulationState | null => {
    if (!floor) return null
    const rooms = floor.nodes.filter((n) => n.type === 'room')

    const allocations = (agentsPerRoom && Object.keys(agentsPerRoom).length > 0)
      ? agentsPerRoom
      : allocateAgentsToRooms(rooms, agentCount ?? 0)

    const hazardOverrides = hazards != null
      ? hazards.map((h) => placedHazardToZone(h, `replay-${buildingId}-${simulatedFloorIndex ?? 0}`))
      : undefined

    const state = createSimulation(floor, {
      disasterType: disaster,
      agentsPerRoom: allocations,
      hazardGrowthMultiplier: HAZARD_GROWTH_MULTIPLIER,
      hazardOverrides,
      seed: seed ?? undefined,
    })
    state.running = true
    return state
  }, [floor, agentCount, agentsPerRoom, hazards, disaster, seed, buildingId, simulatedFloorIndex])

  const [simState, setSimState] = useState<SimulationState | null>(() => buildFreshState())
  const [gridTrace, setGridTrace] = useState<SpatialGridTrace>(() => createSpatialGridTrace())
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState<(typeof PLAYBACK_SPEEDS)[number]>(1)
  const [showHeatmap, setShowHeatmap] = useState(true)
  const [showAgents, setShowAgents] = useState(true)

  const simStateRef = useRef<SimulationState | null>(simState)
  const gridTraceRef = useRef<SpatialGridTrace>(gridTrace)
  const animationFrameRef = useRef<number | null>(null)
  const lastFrameTimeRef = useRef<number | null>(null)
  useEffect(() => {
    simStateRef.current = simState
  }, [simState])
  useEffect(() => {
    gridTraceRef.current = gridTrace
  }, [gridTrace])

  const [runSync, setRunSync] = useState({ buildingId, simulatedFloorIndex, agentCount, disaster, seed, hazards, agentsPerRoom })
  if (
    runSync.buildingId !== buildingId
    || runSync.simulatedFloorIndex !== simulatedFloorIndex
    || runSync.agentCount !== agentCount
    || runSync.disaster !== disaster
    || runSync.seed !== seed
    || runSync.hazards !== hazards
    || runSync.agentsPerRoom !== agentsPerRoom
  ) {
    setRunSync({ buildingId, simulatedFloorIndex, agentCount, disaster, seed, hazards, agentsPerRoom })
    setSimState(buildFreshState())
    setGridTrace(createSpatialGridTrace())
    setIsPlaying(false)
  }

  useEffect(() => {
    if (!isPlaying || !floor) return

    const step = (timestamp: number) => {
      const current = simStateRef.current
      const currentTrace = gridTraceRef.current
      if (!current) {
        animationFrameRef.current = window.requestAnimationFrame(step)
        return
      }
      if (lastFrameTimeRef.current == null) {
        lastFrameTimeRef.current = timestamp
        animationFrameRef.current = window.requestAnimationFrame(step)
        return
      }
      const elapsedMs = Math.min(timestamp - lastFrameTimeRef.current, MAX_FRAME_DELTA_MS)
      lastFrameTimeRef.current = timestamp
      const dt = elapsedMs * SIMULATION_SECONDS_PER_MS * speed
      current.hazardGrowthMultiplier = HAZARD_GROWTH_MULTIPLIER
      const next = stepSimulation(current, floor, dt)
      simStateRef.current = next

      const agentPositions = next.agents
        .filter((agent) => agent.state !== 'evacuated' && agent.state !== 'trapped')
        .map((agent) => getAgentRenderPosition(agent, floor))
      const hazardPositions = next.hazards.map((hazard) => ({
        x: hazard.zone.x,
        y: hazard.zone.y,
        currentRadius: hazard.currentRadius,
        active: hazard.active,
      }))
      const nextTrace = updateSpatialGridTrace(currentTrace, agentPositions, hazardPositions, dt)
      gridTraceRef.current = nextTrace

      setSimState(next)
      setGridTrace(nextTrace)

      if (next.finished) {
        setIsPlaying(false)
        return
      }
      animationFrameRef.current = window.requestAnimationFrame(step)
    }

    animationFrameRef.current = window.requestAnimationFrame(step)
    return () => {
      if (animationFrameRef.current != null) {
        window.cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
      lastFrameTimeRef.current = null
    }
  }, [isPlaying, floor, speed])

  const hasReplayData = !!floor && (
    ((agentCount ?? 0) > 0)
    || (agentsPerRoom != null && Object.values(agentsPerRoom).some((v) => v > 0))
  )

  if (!building || !floor) {
    return (
      <div style={{
        padding: '32px 20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px',
        background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)',
        borderRadius: '12px', border: '1px dashed #cbd5e1',
      }}>
        Replay requires a building with an autonomous floor model.
      </div>
    )
  }

  const activeAgents = simState?.agents.filter((a) => a.state !== 'evacuated' && a.state !== 'trapped').length ?? 0
  const evacuatedAgents = simState?.agents.filter((a) => a.state === 'evacuated').length ?? 0
  const trappedAgents = simState?.agents.filter((a) => a.state === 'trapped').length ?? 0
  const totalAgents = simState?.agents.length ?? 0
  const elapsedSec = simState?.elapsedTime ?? 0
  const progress = totalAgents > 0 ? (evacuatedAgents + trappedAgents) / totalAgents : 0

  const handlePlayPause = () => {
    if (!hasReplayData) return
    if (simState?.finished) {
      setSimState(buildFreshState())
      setGridTrace(createSpatialGridTrace())
    }
    setIsPlaying((v) => !v)
  }

  const handleRestart = () => {
    if (!hasReplayData) return
    setSimState(buildFreshState())
    setGridTrace(createSpatialGridTrace())
    setIsPlaying(false)
  }

  return (
    <div>
      {!hideHeader && (
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '10px',
              background: 'linear-gradient(135deg, #2db8b015 0%, #2db8b005 100%)',
              border: '1px solid #2db8b033',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                Run Replay
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                {building.name} · {floor.label}
              </p>
            </div>
          </div>
        </div>
      )}

      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        marginBottom: '12px', flexWrap: 'wrap',
      }}>
        <LayerToggle
          label="Agents"
          active={showAgents}
          disabled={!hasReplayData}
          onClick={() => setShowAgents((v) => !v)}
          swatch={(
            <span style={{ display: 'inline-flex', gap: '2px' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: ACCENT }} />
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: ACCENT, opacity: 0.6 }} />
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: ACCENT, opacity: 0.3 }} />
            </span>
          )}
        />
        <LayerToggle
          label="Heatmap"
          active={showHeatmap}
          disabled={!hasReplayData}
          onClick={() => setShowHeatmap((v) => !v)}
          swatch={(
            <span style={{
              width: 24, height: 6, borderRadius: 3,
              background: 'linear-gradient(90deg, #4ade80 0%, #f59e0b 50%, #ea580c 80%, #e11d48 100%)',
            }} />
          )}
        />

        <div style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <Pill label="Active" value={activeAgents} bg="#e8f0fb" border="#c8d8ec" color="#1e40af" />
          <Pill label="Evacuated" value={evacuatedAgents} bg="#e8f5ec" border="#c5dfce" color="#166534" />
          <Pill label="Trapped" value={trappedAgents} bg={trappedAgents > 0 ? '#fef2f2' : '#f8fafc'} border={trappedAgents > 0 ? '#fecaca' : 'var(--border)'} color={trappedAgents > 0 ? '#b91c1c' : '#94a3b8'} />
        </div>
      </div>

      <div style={{
        position: 'relative',
        aspectRatio: `${VIEW_WIDTH}/${VIEW_HEIGHT}`,
        borderRadius: '14px',
        border: '1px solid #cbd5e1',
        overflow: 'hidden',
        background: 'linear-gradient(180deg, #fafcff 0%, #eef3f8 100%)',
        boxShadow: '0 10px 32px rgba(15,23,42,0.12), inset 0 0 0 1px rgba(255,255,255,0.5)',
      }}>
        {floor.floorplanSrc && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={floor.floorplanSrc}
            alt={`${building.name} ${floor.label} floor plan`}
            style={{
              position: 'absolute', inset: 0,
              width: '100%', height: '100%',
              objectFit: 'contain', objectPosition: 'center',
              opacity: 0.95,
              filter: 'saturate(0.75) contrast(0.85) brightness(1.18)',
            }}
          />
        )}

        <svg
          viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
        >
          <defs>
            <filter id="replay-soft-blur" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="14" />
            </filter>
          </defs>

          {showHeatmap && (
            <g filter="url(#replay-soft-blur)">
              {getRenderableGridCells(gridTrace).map((cell) => {
                const rect = gridCellRect(cell)
                const intensity = Math.max(cell.intensity, cell.hazardIntensity * 0.75)
                if (intensity < 0.08) return null
                return (
                  <rect
                    key={`heat-${cell.cellX}-${cell.cellY}`}
                    x={rect.x}
                    y={rect.y}
                    width={rect.width}
                    height={rect.height}
                    rx="4"
                    fill={getHeatColor(intensity)}
                    opacity={0.42 + intensity * 0.45}
                  />
                )
              })}
            </g>
          )}

          {simState?.hazards.filter((h) => h.active).map((hazard) => (
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
            </g>
          ))}

          {showAgents && simState?.agents.filter((a) => a.state !== 'evacuated').map((agent) => {
            const pos = getAgentRenderPosition(agent, floor)
            const fill = agent.state === 'trapped' ? '#ef4444' : ACCENT
            return (
              <circle
                key={agent.id}
                cx={pos.x}
                cy={pos.y}
                r="4.2"
                fill={fill}
                stroke="#ffffff"
                strokeWidth="1.4"
                opacity={agent.state === 'trapped' ? 1 : 0.92}
              />
            )
          })}

          {floor.nodes.filter((n) => n.type === 'exit').map((node) => (
            <g key={node.id}>
              <circle cx={node.x} cy={node.y} r="11" fill="#ffffff" stroke={ACCENT} strokeWidth="2.5" />
              <text x={node.x} y={node.y + 3} textAnchor="middle" fontSize="9" fontWeight="800" fill={ACCENT_DARK}>
                {node.label.replace('Exit ', '')}
              </text>
            </g>
          ))}

        </svg>

        {!hasReplayData && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(248,250,252,0.85)',
          }}>
            <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px', padding: '24px', maxWidth: '320px' }}>
              Run an autonomous simulation on this floor to record a replay.
            </div>
          </div>
        )}
      </div>

      {/* ── Heatmap legend ────────────────────────────────── */}
      {showHeatmap && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '16px',
          marginTop: '12px',
          padding: '10px 14px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          flexWrap: 'wrap',
        }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            fontSize: '10px', fontWeight: 700,
            color: '#475569', letterSpacing: '0.1em', textTransform: 'uppercase',
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22c4-3 8-7 8-12a8 8 0 0 0-16 0c0 5 4 9 8 12z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            Crowd density
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
            {HEATMAP_LEGEND.map((entry) => (
              <div key={entry.label} style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                <span style={{
                  width: '14px', height: '14px', borderRadius: '4px',
                  background: entry.color,
                  boxShadow: `0 0 6px ${entry.color}66, inset 0 0 0 1px rgba(15,23,42,0.05)`,
                }} />
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {entry.label}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {entry.rangeLabel}
                </span>
              </div>
            ))}
          </div>

          <span style={{
            marginLeft: 'auto',
            fontSize: '11px', fontWeight: 600,
            color: 'var(--text-muted)',
            fontStyle: 'italic',
          }}>
            % of peak density in this run
          </span>
        </div>
      )}

      {/* ── Transport controls ────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '14px', marginTop: '14px',
        padding: '12px 14px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        flexWrap: 'wrap',
      }}>
        <button
          type="button"
          onClick={handlePlayPause}
          disabled={!hasReplayData}
          aria-label={isPlaying ? 'Pause replay' : 'Play replay'}
          style={{
            width: '38px', height: '38px', borderRadius: '10px',
            background: hasReplayData ? ACCENT : '#cbd5e1',
            color: '#ffffff', border: 'none',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            cursor: hasReplayData ? 'pointer' : 'not-allowed',
            transition: 'background 0.15s',
            boxShadow: hasReplayData ? '0 4px 12px rgba(45,184,176,0.32)' : 'none',
          }}
        >
          {isPlaying ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="6 4 20 12 6 20 6 4" />
            </svg>
          )}
        </button>

        <button
          type="button"
          onClick={handleRestart}
          disabled={!hasReplayData}
          title="Restart"
          style={{
            width: '38px', height: '38px', borderRadius: '10px',
            background: 'var(--bg-card)', color: 'var(--text-secondary)',
            border: '1px solid var(--border)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            cursor: hasReplayData ? 'pointer' : 'not-allowed',
            opacity: hasReplayData ? 1 : 0.55,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1 4 1 10 7 10" />
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
          </svg>
        </button>

        {/* Progress bar — fills as more agents evacuate / become trapped. */}
        <div style={{ flex: 1, minWidth: '160px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            flex: 1, height: '8px', borderRadius: '999px',
            background: 'var(--bg-inset)', overflow: 'hidden',
            border: '1px solid var(--border)',
          }}>
            <div style={{
              height: '100%',
              width: `${Math.min(100, Math.max(0, progress * 100))}%`,
              background: `linear-gradient(90deg, ${ACCENT} 0%, ${ACCENT_DARK} 100%)`,
              transition: 'width 0.15s ease',
            }} />
          </div>
          <span style={{
            minWidth: '54px', textAlign: 'right',
            fontSize: '11px', fontWeight: 700, color: '#475569',
            fontFeatureSettings: '"tnum"',
          }}>
            {elapsedSec.toFixed(1)}s
          </span>
        </div>

        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          {PLAYBACK_SPEEDS.map((value) => {
            const selected = value === speed
            return (
              <button
                key={value}
                type="button"
                onClick={() => setSpeed(value)}
                disabled={!hasReplayData}
                style={{
                  padding: '6px 9px', fontSize: '11px', fontWeight: 700,
                  borderRadius: '6px', border: 'none',
                  background: selected ? '#0f172a' : '#f1f5f9',
                  color: selected ? '#ffffff' : '#475569',
                  cursor: hasReplayData ? 'pointer' : 'not-allowed',
                  opacity: hasReplayData ? 1 : 0.55,
                }}
              >
                {value}x
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

interface LayerToggleProps {
  label: string
  active: boolean
  disabled: boolean
  onClick: () => void
  swatch: React.ReactNode
}

function LayerToggle({ label, active, disabled, onClick, swatch }: LayerToggleProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '8px',
        padding: '6px 12px', borderRadius: '999px',
        background: active ? `${ACCENT}14` : '#ffffff',
        border: `1px solid ${active ? `${ACCENT}55` : 'var(--border)'}`,
        color: active ? ACCENT_DARK : 'var(--text-muted)',
        fontSize: '12px', fontWeight: 700,
        letterSpacing: '0.02em',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        transition: 'all 0.15s',
      }}
    >
      {swatch}
      {label}
      <span style={{
        marginLeft: '4px',
        fontSize: '9.5px', fontWeight: 700,
        color: active ? ACCENT_DARK : '#94a3b8',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
      }}>
        {active ? 'On' : 'Off'}
      </span>
    </button>
  )
}

interface PillProps {
  label: string
  value: number
  bg: string
  border: string
  color: string
}

function Pill({ label, value, bg, border, color }: PillProps) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '6px',
      padding: '4px 10px', borderRadius: '999px',
      background: bg, border: `1px solid ${border}`,
      color, fontSize: '11px', fontWeight: 700,
      letterSpacing: '0.04em',
    }}>
      <span style={{ fontSize: '9.5px', letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.85 }}>{label}</span>
      <span style={{ fontFeatureSettings: '"tnum"' }}>{value}</span>
    </span>
  )
}
