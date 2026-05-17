'use client'

import { useEffect, useMemo, useState } from 'react'
import { getBuildingById, type FloorModel, type NavNode } from '@/src/simulation/building-model'
import type { DensityCell, SimulationZone } from '@/src/schema/simulation.types'
import {
  GRID_VIEW_HEIGHT,
  GRID_VIEW_WIDTH,
  createSpatialGridTrace,
  densityCellsFromTrace,
  gridCellRect,
  renderableCellsFromDensityCells,
  updateSpatialGridTrace,
} from '@/src/simulation/spatial-grid'
import { createSimulation, stepSimulation } from '@/src/simulation/engine'
import { getAgentRenderPosition } from '@/src/simulation/autonomous-analytics'
import { placedHazardToZone, type PlacedHazard } from '@/src/simulation/hazard-placement'

const VIEW_WIDTH = GRID_VIEW_WIDTH
const VIEW_HEIGHT = GRID_VIEW_HEIGHT

interface IntensityBand {
  threshold: number
  color: string
  label: string
}

// Muted-warm palette — one notch deeper than pastel for readability,
// but still well short of the harsh full-strength alert colors.
const INTENSITY_BANDS: IntensityBand[] = [
  { threshold: 75, color: '#f43f5e', label: 'Critical' },   // rose-500
  { threshold: 55, color: '#f97316', label: 'High'     },   // orange-500
  { threshold: 35, color: '#f59e0b', label: 'Medium'   },   // amber-500
  { threshold: 0,  color: '#16a34a', label: 'Low'      },   // green-600 (darker)
]

const SCALE_TICKS = [
  { value: 100 },
  { value: 75  },
  { value: 50  },
  { value: 25  },
  { value: 0   },
]

function bandFor(intensity: number): IntensityBand {
  return INTENSITY_BANDS.find((band) => intensity >= band.threshold) ?? INTENSITY_BANDS[INTENSITY_BANDS.length - 1]
}

function findFloorByZoneMatches(floors: FloorModel[], zones: SimulationZone[]): FloorModel {
  if (floors.length === 1) return floors[0]
  const labels = new Set(zones.map((z) => z.zoneName))
  let best = floors[0]
  let bestCount = -1
  for (const floor of floors) {
    const count = floor.nodes.reduce((acc, node) => (labels.has(node.label) ? acc + 1 : acc), 0)
    if (count > bestCount) {
      bestCount = count
      best = floor
    }
  }
  return best
}

interface HotNode {
  node: NavNode
  intensity: number
  peak: number
  band: IntensityBand
}

interface SpatialBottleneckHeatmapProps {
  buildingId: string | null
  zones: SimulationZone[]
  densityCells?: DensityCell[]
  /** Index of the floor the run was actually simulated on. When the user
   *  switches to a different floor we hide the heat overlay because the
   *  recorded data doesn't apply there. */
  simulatedFloorIndex?: number | null
  /** When true, suppresses the internal title row because a parent tab
   *  wrapper renders a unified header. */
  hideHeader?: boolean
  /** Replay inputs — when available, we re-simulate to derive a complete
   *  grid heatmap regardless of what was saved to density_cells. */
  hazards?: PlacedHazard[] | null
  agentsPerRoom?: Record<string, number> | null
  seed?: number | null
  disasterType?: 'fire' | 'earthquake' | null
  agentCount?: number | null
}

const HAZARD_GROWTH_MULTIPLIER = 0.45
const REPLAY_STEP_DT = 0.1
const REPLAY_BATCH_BUDGET_MS = 12

function getHeatColor(intensity: number) {
  if (intensity >= 0.78) return '#e11d48'   // rose-600
  if (intensity >= 0.55) return '#ea580c'   // orange-600
  if (intensity >= 0.32) return '#f59e0b'   // amber-500
  if (intensity >= 0.12) return '#15803d'   // green-700 (deeper for contrast against light rooms)
  return '#16a34a'                            // green-600 (darker than the old #4ade80)
}

export function SpatialBottleneckHeatmap({
  buildingId,
  zones,
  densityCells = [],
  simulatedFloorIndex = null,
  hideHeader = false,
  hazards = null,
  agentsPerRoom = null,
  seed = null,
  disasterType = null,
  agentCount = null,
}: SpatialBottleneckHeatmapProps) {
  const building = useMemo(
    () => (buildingId ? getBuildingById(buildingId) ?? null : null),
    [buildingId],
  )

  const simulatedFloor = useMemo(() => {
    if (!building || simulatedFloorIndex == null) return null
    return building.floors[simulatedFloorIndex] ?? null
  }, [building, simulatedFloorIndex])

  const initialFloor = useMemo(
    () => simulatedFloor ?? (building ? findFloorByZoneMatches(building.floors, zones) : null),
    [simulatedFloor, building, zones],
  )
  const [activeFloorId, setActiveFloorId] = useState<string | null>(initialFloor?.id ?? null)
  // When a run records its simulated floor, lock the heatmap to that floor —
  // the data isn't meaningful for any other floor of the same building.
  const lockedToSimulatedFloor = simulatedFloor != null
  const [syncedSimulatedFloorId, setSyncedSimulatedFloorId] = useState<string | null>(simulatedFloor?.id ?? null)
  if (lockedToSimulatedFloor && syncedSimulatedFloorId !== simulatedFloor.id) {
    setSyncedSimulatedFloorId(simulatedFloor.id)
    setActiveFloorId(simulatedFloor.id)
  }
  /** Re-simulate using the saved replay inputs (seed + hazards +
   *  per-room allocation) and capture a full grid trace. This guarantees
   *  the grid heatmap renders even when density_cells weren't saved with
   *  the run, and stays consistent with the Replay tab. */
  const [replayDensityCells, setReplayDensityCells] = useState<DensityCell[]>([])
  const [isReplayComputing, setIsReplayComputing] = useState(false)

  const replayFloor = simulatedFloor
  const replayAllocations = useMemo(() => {
    if (agentsPerRoom && Object.keys(agentsPerRoom).length > 0) return agentsPerRoom
    if (!replayFloor || !agentCount || agentCount <= 0) return null
    const rooms = replayFloor.nodes.filter((n) => n.type === 'room')
    const totalCap = rooms.reduce((sum, r) => sum + r.capacity, 0)
    if (totalCap === 0) return null
    const result: Record<string, number> = {}
    let assigned = 0
    const drafts = rooms.map((r) => {
      const share = (agentCount * r.capacity) / totalCap
      const floored = Math.floor(share)
      assigned += floored
      result[r.id] = floored
      return { id: r.id, frac: share - floored, capacity: r.capacity }
    })
    drafts.sort((a, b) => b.frac - a.frac)
    let i = 0
    while (assigned < agentCount && i < drafts.length) {
      if (result[drafts[i].id] < drafts[i].capacity) {
        result[drafts[i].id]++
        assigned++
      }
      i++
    }
    return result
  }, [agentsPerRoom, replayFloor, agentCount])

  useEffect(() => {
    if (!replayFloor || !replayAllocations) {
      setReplayDensityCells([])
      return
    }
    const totalAgents = Object.values(replayAllocations).reduce((s, v) => s + v, 0)
    if (totalAgents <= 0) {
      setReplayDensityCells([])
      return
    }

    let cancelled = false
    setIsReplayComputing(true)

    let state = createSimulation(replayFloor, {
      disasterType: (disasterType ?? 'fire') as 'fire' | 'earthquake',
      agentsPerRoom: replayAllocations,
      hazardGrowthMultiplier: HAZARD_GROWTH_MULTIPLIER,
      hazardOverrides: hazards != null
        ? hazards.map((h) => placedHazardToZone(h, `heatmap-${buildingId}-${simulatedFloorIndex ?? 0}`))
        : undefined,
      seed: seed ?? undefined,
    })
    state.running = true
    let trace = createSpatialGridTrace()
    const maxStepsHardCap = 4000

    const runBatch = () => {
      if (cancelled) return
      const batchStart = performance.now()
      let stepsThisBatch = 0
      while (!state.finished && performance.now() - batchStart < REPLAY_BATCH_BUDGET_MS && stepsThisBatch < maxStepsHardCap) {
        state.hazardGrowthMultiplier = HAZARD_GROWTH_MULTIPLIER
        state = stepSimulation(state, replayFloor, REPLAY_STEP_DT)
        const positions = state.agents
          .filter((a) => a.state !== 'evacuated' && a.state !== 'trapped')
          .map((a) => getAgentRenderPosition(a, replayFloor))
        const hzs = state.hazards.map((h) => ({ x: h.zone.x, y: h.zone.y, currentRadius: h.currentRadius, active: h.active }))
        trace = updateSpatialGridTrace(trace, positions, hzs, REPLAY_STEP_DT)
        stepsThisBatch++
      }
      if (state.finished || stepsThisBatch >= maxStepsHardCap) {
        const finalCells = densityCellsFromTrace(trace).map((cell, i) => ({
          ...cell,
          id: `replay-${i}`,
          runId: `replay-${buildingId}-${simulatedFloorIndex ?? 0}`,
        })) as DensityCell[]
        if (!cancelled) {
          setReplayDensityCells(finalCells)
          setIsReplayComputing(false)
        }
        return
      }
      // Yield to the browser between batches so we don't freeze the UI.
      setTimeout(runBatch, 0)
    }

    runBatch()
    return () => { cancelled = true }
  }, [replayFloor, replayAllocations, hazards, seed, disasterType, buildingId, simulatedFloorIndex])

  /** Prefer the freshly computed grid (always reflects the seeded run);
   *  fall back to whatever density cells were saved alongside the run. */
  const effectiveDensityCells = replayDensityCells.length > 0 ? replayDensityCells : densityCells
  const densityHeatCells = useMemo(
    () => renderableCellsFromDensityCells(effectiveDensityCells),
    [effectiveDensityCells],
  )

  if (!building || !initialFloor) {
    return (
      <div style={{
        padding: '32px 20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px',
        background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)',
        borderRadius: '12px', border: '1px dashed #cbd5e1',
      }}>
        Spatial heatmap requires a building with an autonomous floor model
        <div style={{ marginTop: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
          (Currently supported: Admin, Science, Library, ASX)
        </div>
      </div>
    )
  }

  const activeFloor = building.floors.find((f) => f.id === activeFloorId) ?? initialFloor
  // When the run recorded which floor it simulated, the heatmap data is only
  // meaningful on that floor. On other floors we keep the floor plan visible
  // for context but suppress the overlay + hotspot list and show a notice.
  const matchesSimulatedFloor = simulatedFloor ? activeFloor.id === simulatedFloor.id : true
  const showHeat = matchesSimulatedFloor
  const hasDensityData = showHeat && densityHeatCells.length > 0
  const intensityByLabel = new Map(zones.map((z) => [z.zoneName, z.intensity]))
  const peakAgentsByLabel = new Map(zones.map((z) => [z.zoneName, z.agentCount]))

  const heatNodes: HotNode[] = showHeat
    ? activeFloor.nodes
        .map((node) => {
          const intensity = intensityByLabel.get(node.label) ?? 0
          const peak = peakAgentsByLabel.get(node.label) ?? 0
          return { node, intensity, peak, band: bandFor(intensity) }
        })
        .filter((entry) => entry.intensity > 0 || entry.peak > 0)
        .sort((a, b) => b.intensity - a.intensity)
    : []

  const hasData = hasDensityData || heatNodes.length > 0
  const criticalCount = hasDensityData
    ? densityHeatCells.filter((cell) => cell.intensity >= 0.75).length
    : heatNodes.filter((h) => h.intensity >= 75).length
  const highCount = hasDensityData
    ? densityHeatCells.filter((cell) => cell.intensity >= 0.55 && cell.intensity < 0.75).length
    : heatNodes.filter((h) => h.intensity >= 55 && h.intensity < 75).length
  const peakAgents = hasDensityData
    ? densityHeatCells.reduce((max, cell) => Math.max(max, cell.peakDensity), 0)
    : heatNodes.reduce((max, h) => Math.max(max, h.peak), 0)

  // Use the floor plan SVG as a CSS mask so heat is clipped to the building
  // footprint. Wherever the SVG draws content (rooms/walls/labels), heat is
  // visible. The empty canvas around the building masks the heat out.
  const maskImage = activeFloor.floorplanSrc ? `url("${activeFloor.floorplanSrc}")` : 'none'
  const maskStyle: React.CSSProperties = activeFloor.floorplanSrc
    ? {
        maskImage,
        maskMode: 'alpha',
        maskSize: 'contain',
        maskPosition: 'center',
        maskRepeat: 'no-repeat',
        WebkitMaskImage: maskImage,
        WebkitMaskSize: 'contain',
        WebkitMaskPosition: 'center',
        WebkitMaskRepeat: 'no-repeat',
      }
    : {}

  return (
    <div>
      {/* ── Title row ────────────────────────────────────────────────── */}
      {!hideHeader && (
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '10px',
              background: 'linear-gradient(135deg, #2db8b015 0%, #2db8b005 100%)',
              border: '1px solid #2db8b033',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2db8b0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22c4-3 8-7 8-12a8 8 0 0 0-16 0c0 5 4 9 8 12z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                Crowd Heatmap
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                {building.name} · {activeFloor.label}
              </p>
            </div>
          </div>

          {lockedToSimulatedFloor ? (
            <div
              title="Heatmap is scoped to the floor that was actually simulated"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                padding: '7px 12px',
                background: '#f1f5f9', borderRadius: '999px', border: '1px solid var(--border)',
                fontSize: '11px', fontWeight: 700, color: '#475569',
                letterSpacing: '0.04em',
              }}
            >
              <span style={{
                width: '6px', height: '6px', borderRadius: '50%',
                background: '#2db8b0',
              }} />
              Simulated: {activeFloor.label}
            </div>
          ) : building.floors.length > 1 && (
            <div style={{
              display: 'flex', gap: '2px', padding: '3px',
              background: '#f1f5f9', borderRadius: '10px', border: '1px solid var(--border)',
            }}>
              {building.floors.map((floor) => {
                const selected = floor.id === activeFloor.id
                return (
                  <button
                    key={floor.id}
                    onClick={() => setActiveFloorId(floor.id)}
                    style={{
                      padding: '7px 14px', fontSize: '11px', fontWeight: 700,
                      borderRadius: '7px', border: 'none',
                      background: selected ? '#ffffff' : 'transparent',
                      color: selected ? '#0f172a' : '#64748b',
                      cursor: 'pointer',
                      boxShadow: selected ? '0 1px 3px rgba(15,23,42,0.10)' : 'none',
                      transition: 'all 0.15s', letterSpacing: '0.01em',
                    }}
                  >
                    {floor.label}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Stats strip ──────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '16px' }}>
        <StatPill label={hasDensityData ? 'Active Cells' : 'Hotspots'} value={hasDensityData ? densityHeatCells.length : heatNodes.length} accent="#2db8b0" />
        <StatPill label="Critical" value={criticalCount} accent="#f43f5e" emphasized={criticalCount > 0} />
        <StatPill label="High Risk" value={highCount} accent="#f97316" />
        <StatPill label="Peak Agents" value={peakAgents} accent="#3b82f6" suffix={peakAgents > 0 ? ' max' : ''} />
      </div>

      {/* ── Map + scale legend ───────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '14px', alignItems: 'stretch' }}>

        {/* Map canvas */}
        <div style={{
          position: 'relative',
          flex: 1,
          aspectRatio: `${VIEW_WIDTH}/${VIEW_HEIGHT}`,
          borderRadius: '14px',
          border: '1px solid #cbd5e1',
          overflow: 'hidden',
          background: 'linear-gradient(180deg, #fafcff 0%, #eef3f8 100%)',
          boxShadow: '0 10px 32px rgba(15,23,42,0.12), inset 0 0 0 1px rgba(255,255,255,0.5)',
        }}>
          {/* Floor plan image */}
          {activeFloor.floorplanSrc && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={activeFloor.floorplanSrc}
              alt={`${building.name} ${activeFloor.label} floor plan`}
              style={{
                position: 'absolute', inset: 0,
                width: '100%', height: '100%',
                objectFit: 'contain', objectPosition: 'center',
                opacity: 0.95,
                // Keep the original room colours but lighten them: high
                // brightness + reduced contrast pushes everything toward
                // a pastel palette so the heatmap pops while rooms stay
                // identifiable.
                filter: 'saturate(0.75) contrast(0.85) brightness(1.18)',
              }}
            />
          )}

          {/* Heatmap layer — wide soft glow, clipped to building footprint */}
          <div style={{
            position: 'absolute', inset: 0,
            pointerEvents: 'none',
            ...maskStyle,
          }}>
            <svg
              viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
              preserveAspectRatio="xMidYMid meet"
              style={{ width: '100%', height: '100%', mixBlendMode: 'multiply' }}
            >
              <defs>
                {/* Outer halo — muted-warm tint, slightly deeper than pure
                   pastel for readability. Fades cleanly to nothing.
                   Green fade now uses #16a34a (green-600) so the halo
                   contrasts with the lighter pastel floor plan. */}
                <radialGradient id="halo-blob" cx="50%" cy="50%">
                  <stop offset="0%"   stopColor="rgba(244,63,94,0.50)"  />
                  <stop offset="35%"  stopColor="rgba(249,115,22,0.40)" />
                  <stop offset="65%"  stopColor="rgba(245,158,11,0.30)" />
                  <stop offset="100%" stopColor="rgba(22,163,74,0)"     />
                </radialGradient>

                {/* Inner core — warm rose peak. Deep enough to read as a
                   real hotspot, but not crimson or alarming. */}
                <radialGradient id="core-blob" cx="50%" cy="50%">
                  <stop offset="0%"   stopColor="rgba(244,63,94,0.78)"  />
                  <stop offset="30%"  stopColor="rgba(249,115,22,0.65)" />
                  <stop offset="55%"  stopColor="rgba(245,158,11,0.45)" />
                  <stop offset="80%"  stopColor="rgba(22,163,74,0.26)"  />
                  <stop offset="100%" stopColor="rgba(22,163,74,0)"     />
                </radialGradient>

                {/* Heavy blur for the outer halo — fuses neighbouring blobs */}
                <filter id="halo-blur" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="22" />
                </filter>

                {/* Lighter blur for the inner core — keeps the warm center
                   readable but still soft */}
                <filter id="core-blur" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="11" />
                </filter>
              </defs>

              {hasDensityData ? (
                <g filter="url(#core-blur)">
                  {densityHeatCells.map((cell) => {
                    const rect = gridCellRect(cell)
                    return (
                      <rect
                        key={`density-cell-${cell.cellX}-${cell.cellY}`}
                        x={rect.x}
                        y={rect.y}
                        width={rect.width}
                        height={rect.height}
                        rx="4"
                        fill={getHeatColor(cell.intensity)}
                        opacity={0.42 + cell.intensity * 0.45}
                      />
                    )
                  })}
                </g>
              ) : (
                <>
                  {/* Outer halo layer */}
                  <g filter="url(#halo-blur)">
                    {heatNodes.map(({ node, intensity }) => {
                  const radius = 90 + (intensity / 100) * 170
                  return (
                    <circle
                      key={`halo-${node.id}`}
                      cx={node.x}
                      cy={node.y}
                      r={radius}
                      fill="url(#halo-blob)"
                      opacity={0.45 + (intensity / 100) * 0.5}
                    />
                  )
                    })}
                  </g>

                  {/* Inner core layer */}
                  <g filter="url(#core-blur)">
                    {heatNodes.map(({ node, intensity }) => {
                  const radius = 40 + (intensity / 100) * 90
                  return (
                    <circle
                      key={`core-${node.id}`}
                      cx={node.x}
                      cy={node.y}
                      r={radius}
                      fill="url(#core-blob)"
                      opacity={0.6 + (intensity / 100) * 0.4}
                    />
                  )
                    })}
                  </g>
                </>
              )}
            </svg>
          </div>

          {!hasData && !isReplayComputing && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(248,250,252,0.85)',
            }}>
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px', padding: '24px', maxWidth: '320px' }}>
                {!matchesSimulatedFloor
                  ? 'Heatmap available only for the simulated floor.'
                  : 'Run a simulation on this floor to see a heatmap.'}
              </div>
            </div>
          )}

          {isReplayComputing && !hasData && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(248,250,252,0.7)',
            }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '10px',
                padding: '10px 16px', borderRadius: '999px',
                background: '#ffffff', border: '1px solid var(--border)',
                boxShadow: '0 4px 12px rgba(15,23,42,0.06)',
                color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600,
              }}>
                <span style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: '#2db8b0',
                  animation: 'sbm-pulse 1.1s ease-in-out infinite',
                }} />
                Computing heatmap…
                <style>{`@keyframes sbm-pulse { 0%,100% { opacity: 0.4 } 50% { opacity: 1 } }`}</style>
              </div>
            </div>
          )}
        </div>

        {/* Vertical color-scale legend */}
        <div style={{
          width: '78px',
          display: 'flex', flexDirection: 'column',
          padding: '10px 8px',
          background: '#ffffff',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          boxShadow: '0 2px 6px rgba(15,23,42,0.05)',
        }}>
          <div style={{
            fontSize: '9px', fontWeight: 700, color: '#475569',
            letterSpacing: '0.08em', textTransform: 'uppercase',
            textAlign: 'center', marginBottom: '10px', lineHeight: 1.3,
          }}>
            Crowd<br/>intensity
          </div>
          <div style={{ display: 'flex', flex: 1, gap: '8px' }}>
            <div style={{
              width: '16px',
              borderRadius: '6px',
              background: 'linear-gradient(180deg, #e11d48 0%, #ea580c 35%, #f59e0b 60%, #15803d 88%, #16a34a 100%)',
              boxShadow: 'inset 0 0 0 1px rgba(15,23,42,0.10)',
            }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '2px 0' }}>
              {SCALE_TICKS.map((tick) => (
                <div key={tick.value} style={{
                  fontSize: '10px', fontWeight: 700,
                  color: tick.value === 0 ? '#64748b' : '#0f172a',
                  lineHeight: 1, letterSpacing: '-0.01em',
                }}>
                  {tick.value}%
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Top hotspots strip ───────────────────────────────────────── */}
      {heatNodes.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <div style={{ height: '2px', flex: 1, background: 'linear-gradient(90deg, #2db8b0 0%, transparent 100%)', borderRadius: '2px' }} />
            <span style={{ fontSize: '10px', fontWeight: 700, color: '#475569', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              Top Hotspots
            </span>
            <div style={{ height: '2px', flex: 1, background: 'linear-gradient(270deg, #2db8b0 0%, transparent 100%)', borderRadius: '2px' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '10px' }}>
            {heatNodes.slice(0, 4).map(({ node, intensity, peak, band }, i) => (
              <div key={node.id} style={{
                position: 'relative',
                padding: '14px 16px 14px 18px',
                background: '#ffffff',
                border: `1px solid ${band.color}33`,
                borderRadius: '12px',
                boxShadow: `0 2px 8px rgba(15,23,42,0.06), inset 0 0 0 1px rgba(255,255,255,0.4)`,
                overflow: 'hidden',
                transition: 'transform 0.15s, box-shadow 0.15s',
              }}>
                {/* Accent bar */}
                <div style={{
                  position: 'absolute', top: 0, left: 0, bottom: 0, width: '4px',
                  background: `linear-gradient(180deg, ${band.color} 0%, ${band.color}99 100%)`,
                }} />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{
                    fontSize: '9.5px', fontWeight: 700, color: band.color,
                    letterSpacing: '0.08em', textTransform: 'uppercase',
                  }}>
                    #{i + 1} · {band.label}
                  </span>
                  <span style={{ fontSize: '15px', fontWeight: 800, color: band.color, letterSpacing: '-0.02em' }}>
                    {Math.round(intensity)}%
                  </span>
                </div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '6px', lineHeight: 1.25 }}>
                  {node.label}
                </div>
                <div style={{ display: 'flex', gap: '10px', fontSize: '11px', color: '#64748b' }}>
                  <span><strong style={{ color: '#0f172a' }}>{peak}</strong> peak</span>
                  <span style={{ color: '#cbd5e1' }}>·</span>
                  <span>cap. {node.capacity}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}

interface StatPillProps {
  label: string
  value: number
  accent: string
  suffix?: string
  emphasized?: boolean
}

function StatPill({ label, value, accent, suffix, emphasized }: StatPillProps) {
  return (
    <div style={{
      padding: '12px 14px',
      background: emphasized ? `${accent}10` : '#ffffff',
      border: `1px solid ${emphasized ? `${accent}55` : 'var(--border)'}`,
      borderRadius: '10px',
      boxShadow: emphasized ? `0 0 0 3px ${accent}12` : '0 1px 2px rgba(15,23,42,0.04)',
      transition: 'all 0.2s',
    }}>
      <div style={{ fontSize: '9.5px', fontWeight: 700, color: accent, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '4px' }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
        <span style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', lineHeight: 1 }}>
          {value}
        </span>
        {suffix && (
          <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>{suffix}</span>
        )}
      </div>
    </div>
  )
}
