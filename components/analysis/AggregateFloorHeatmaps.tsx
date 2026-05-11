'use client'

import { useEffect, useMemo, useState } from 'react'
import { getAggregateFloorHeatmaps, type AggregateFloorHeatmap } from '@/src/services/simulation.service'
import { getBuildingById, type BuildingModel, type FloorModel } from '@/src/simulation/building-model'
import {
  GRID_VIEW_HEIGHT,
  GRID_VIEW_WIDTH,
  gridCellRect,
} from '@/src/simulation/spatial-grid'

const VIEW_WIDTH = GRID_VIEW_WIDTH
const VIEW_HEIGHT = GRID_VIEW_HEIGHT
const ACCENT = '#2db8b0'
const ACCENT_DARK = '#1f9189'

function getHeatColor(intensity: number) {
  if (intensity >= 0.78) return '#e11d48'
  if (intensity >= 0.55) return '#ea580c'
  if (intensity >= 0.32) return '#f59e0b'
  if (intensity >= 0.12) return '#22c55e'
  return '#4ade80'
}

interface ResolvedFloorHeatmap extends AggregateFloorHeatmap {
  building: BuildingModel | null
  floor: FloorModel | null
}

interface BuildingGroup {
  buildingId: string
  building: BuildingModel | null
  floors: ResolvedFloorHeatmap[]
  totalRuns: number
}

export function AggregateFloorHeatmaps() {
  const [heatmaps, setHeatmaps] = useState<AggregateFloorHeatmap[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setIsLoading(true)
      setError(null)
      try {
        const data = await getAggregateFloorHeatmaps()
        if (!cancelled) setHeatmaps(data)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load aggregated heatmaps')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  /** Resolve building/floor models once per dataset. */
  const resolved: ResolvedFloorHeatmap[] = useMemo(() => {
    return heatmaps.map((entry) => {
      const building = entry.buildingId ? getBuildingById(entry.buildingId) ?? null : null
      const floor = building?.floors[entry.floorIndex] ?? null
      return { ...entry, building, floor }
    })
  }, [heatmaps])

  /** Group by building, then sort buildings by total run count desc, then by name. */
  const buildingGroups: BuildingGroup[] = useMemo(() => {
    const map = new Map<string, BuildingGroup>()
    for (const entry of resolved) {
      let group = map.get(entry.buildingId)
      if (!group) {
        group = {
          buildingId: entry.buildingId,
          building: entry.building,
          floors: [],
          totalRuns: 0,
        }
        map.set(entry.buildingId, group)
      }
      group.floors.push(entry)
      group.totalRuns += entry.runCount
    }
    for (const group of map.values()) {
      group.floors.sort((a, b) => a.floorIndex - b.floorIndex)
    }
    return Array.from(map.values()).sort((a, b) => {
      if (b.totalRuns !== a.totalRuns) return b.totalRuns - a.totalRuns
      const aname = a.building?.name ?? a.buildingId
      const bname = b.building?.name ?? b.buildingId
      return aname.localeCompare(bname)
    })
  }, [resolved])

  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null)
  const [selectedFloorIndex, setSelectedFloorIndex] = useState<number | null>(null)

  /** Keep the selection valid: default to the first available building/floor
   *  whenever the dataset changes, and snap back if the current selection
   *  no longer exists in the data. Render-time correction pattern. */
  const [syncToken, setSyncToken] = useState(0)
  const datasetToken = buildingGroups.length === 0
    ? 0
    : buildingGroups.reduce((acc, g) => acc + g.floors.length * 31 + g.buildingId.length, 0)
  if (syncToken !== datasetToken) {
    setSyncToken(datasetToken)
    if (buildingGroups.length === 0) {
      if (selectedBuildingId !== null) setSelectedBuildingId(null)
      if (selectedFloorIndex !== null) setSelectedFloorIndex(null)
    } else {
      const current = buildingGroups.find((g) => g.buildingId === selectedBuildingId)
      if (!current) {
        setSelectedBuildingId(buildingGroups[0].buildingId)
        setSelectedFloorIndex(buildingGroups[0].floors[0]?.floorIndex ?? null)
      } else {
        const hasFloor = current.floors.some((f) => f.floorIndex === selectedFloorIndex)
        if (!hasFloor) setSelectedFloorIndex(current.floors[0]?.floorIndex ?? null)
      }
    }
  }

  const selectedGroup = buildingGroups.find((g) => g.buildingId === selectedBuildingId) ?? null
  const selectedHeatmap = selectedGroup?.floors.find((f) => f.floorIndex === selectedFloorIndex) ?? null

  return (
    <div style={{
      background: '#ffffff',
      border: '1px solid var(--border)',
      borderRadius: '14px',
      padding: '28px 32px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      marginBottom: '20px',
    }}>
      {/* ── Header ──────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '10px',
            background: `linear-gradient(135deg, ${ACCENT}1f 0%, ${ACCENT}08 100%)`,
            border: `1px solid ${ACCENT}33`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1.5" />
              <rect x="14" y="3" width="7" height="7" rx="1.5" />
              <rect x="3" y="14" width="7" height="7" rx="1.5" />
              <rect x="14" y="14" width="7" height="7" rx="1.5" />
            </svg>
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
              Aggregated Floor Heatmaps
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
              Average crowd density per floor across all completed runs.
            </p>
          </div>
        </div>
      </div>

      {isLoading && (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
          Loading aggregated heatmaps…
        </div>
      )}

      {error && !isLoading && (
        <div style={{ padding: '20px', borderRadius: '10px', background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: '13px' }}>
          {error}
        </div>
      )}

      {!isLoading && !error && buildingGroups.length === 0 && (
        <div style={{
          padding: '40px 24px', textAlign: 'center',
          color: 'var(--text-secondary)', fontSize: '13px',
          background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)',
          borderRadius: '12px', border: '1px dashed #cbd5e1',
        }}>
          No completed runs with recorded floor data yet. Run a few simulations and they&apos;ll aggregate here.
        </div>
      )}

      {!isLoading && !error && buildingGroups.length > 0 && (
        <>
          {/* ── Step 1: Building picker ───────────────────── */}
          <StepHeader step={1} title="Pick a building" />
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: '10px',
            marginBottom: '24px',
          }}>
            {buildingGroups.map((group) => {
              const isSelected = group.buildingId === selectedBuildingId
              return (
                <button
                  key={group.buildingId}
                  type="button"
                  onClick={() => {
                    setSelectedBuildingId(group.buildingId)
                    setSelectedFloorIndex(group.floors[0]?.floorIndex ?? null)
                  }}
                  style={{
                    textAlign: 'left',
                    padding: '14px 16px',
                    background: isSelected ? `${ACCENT}10` : '#ffffff',
                    border: `1.5px solid ${isSelected ? `${ACCENT}66` : 'var(--border)'}`,
                    borderRadius: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    boxShadow: isSelected ? `0 4px 14px ${ACCENT}22` : '0 1px 2px rgba(15,23,42,0.04)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                  }}
                >
                  <span style={{
                    width: '34px', height: '34px', borderRadius: '9px',
                    background: isSelected ? `linear-gradient(135deg, ${ACCENT} 0%, ${ACCENT_DARK} 100%)` : '#f1f5f9',
                    color: isSelected ? '#ffffff' : '#64748b',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 21h18" />
                      <path d="M6 21V8l6-4 6 4v13" />
                      <path d="M10 21v-6h4v6" />
                    </svg>
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{
                      fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {group.building?.name ?? group.buildingId}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      {group.floors.length} {group.floors.length === 1 ? 'floor' : 'floors'} · {group.totalRuns} {group.totalRuns === 1 ? 'run' : 'runs'}
                    </div>
                  </div>
                  {isSelected && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={ACCENT_DARK} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              )
            })}
          </div>

          {/* ── Step 2: Floor picker (only floors with data) ───── */}
          {selectedGroup && (
            <>
              <StepHeader step={2} title={`Pick a floor of ${selectedGroup.building?.name ?? selectedGroup.buildingId}`} />
              <div style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                marginBottom: '24px', flexWrap: 'wrap',
              }}>
                {selectedGroup.floors.map((floorEntry) => {
                  const isSelected = floorEntry.floorIndex === selectedFloorIndex
                  return (
                    <button
                      key={floorEntry.floorIndex}
                      type="button"
                      onClick={() => setSelectedFloorIndex(floorEntry.floorIndex)}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: '8px',
                        padding: '8px 14px', borderRadius: '10px',
                        background: isSelected ? '#ffffff' : '#f1f5f9',
                        border: `1px solid ${isSelected ? `${ACCENT}55` : 'var(--border)'}`,
                        color: isSelected ? ACCENT_DARK : '#475569',
                        fontSize: '12px', fontWeight: 700,
                        cursor: 'pointer',
                        boxShadow: isSelected ? `0 1px 3px ${ACCENT}33, 0 0 0 1px ${ACCENT}33` : 'none',
                        transition: 'all 0.15s',
                      }}
                    >
                      {floorEntry.floor?.label ?? `Floor ${floorEntry.floorIndex + 1}`}
                      <span style={{
                        padding: '2px 7px', borderRadius: '999px',
                        background: isSelected ? `${ACCENT}18` : '#ffffff',
                        border: `1px solid ${isSelected ? `${ACCENT}44` : 'var(--border)'}`,
                        color: isSelected ? ACCENT_DARK : '#64748b',
                        fontSize: '10px', fontWeight: 700,
                        letterSpacing: '0.04em',
                        fontFeatureSettings: '"tnum"',
                      }}>
                        {floorEntry.runCount} {floorEntry.runCount === 1 ? 'run' : 'runs'}
                      </span>
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {/* ── Step 3: Heatmap for the selection ───────────── */}
          {selectedHeatmap && <FloorHeatmapView entry={selectedHeatmap} />}
        </>
      )}
    </div>
  )
}

function StepHeader({ step, title }: { step: number; title: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '10px',
      marginBottom: '12px',
    }}>
      <span style={{
        width: '22px', height: '22px', borderRadius: '7px',
        background: `${ACCENT}18`,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        color: ACCENT_DARK, fontSize: '11px', fontWeight: 700,
      }}>
        {step}
      </span>
      <h4 style={{
        margin: 0, fontSize: '13px', fontWeight: 600,
        color: 'var(--text-primary)', letterSpacing: '-0.01em',
      }}>
        {title}
      </h4>
    </div>
  )
}

function FloorHeatmapView({ entry }: { entry: ResolvedFloorHeatmap }) {
  const buildingLabel = entry.building?.name ?? entry.buildingId
  const floorLabel = entry.floor?.label ?? `Floor ${entry.floorIndex + 1}`

  const maxPeak = entry.cells.reduce((m, c) => Math.max(m, c.peakDensity), 0)
  const renderableCells = entry.cells
    .map((c) => ({
      ...c,
      intensity: maxPeak > 0 ? c.peakDensity / maxPeak : 0,
    }))
    .filter((c) => c.intensity >= 0.08)

  const criticalCells = renderableCells.filter((c) => c.intensity >= 0.78).length
  const highCells = renderableCells.filter((c) => c.intensity >= 0.55 && c.intensity < 0.78).length

  return (
    <div style={{
      background: 'linear-gradient(180deg, #fafcff 0%, #f2f6fb 100%)',
      border: '1px solid var(--border)',
      borderRadius: '14px',
      overflow: 'hidden',
      boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
    }}>
      {/* Title bar */}
      <div style={{
        padding: '12px 16px',
        background: '#ffffff',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
        flexWrap: 'wrap',
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {buildingLabel}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            {floorLabel} · averaged across {entry.runCount} {entry.runCount === 1 ? 'run' : 'runs'}
          </div>
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <StatChip label="Active cells" value={renderableCells.length} accent={ACCENT} />
          <StatChip label="Critical" value={criticalCells} accent="#e11d48" emphasized={criticalCells > 0} />
          <StatChip label="High" value={highCells} accent="#ea580c" />
        </div>
      </div>

      {/* Map */}
      <div style={{
        position: 'relative',
        aspectRatio: `${VIEW_WIDTH}/${VIEW_HEIGHT}`,
        background: '#ffffff',
        overflow: 'hidden',
      }}>
        {entry.floor?.floorplanSrc && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={entry.floor.floorplanSrc}
            alt={`${buildingLabel} ${floorLabel} floor plan`}
            style={{
              position: 'absolute', inset: 0,
              width: '100%', height: '100%',
              objectFit: 'contain', objectPosition: 'center',
              opacity: 0.92,
              filter: 'saturate(0.4) contrast(1.05) brightness(1.04)',
            }}
          />
        )}

        <svg
          viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
        >
          <defs>
            <filter id={`agg-blur-${entry.buildingId}-${entry.floorIndex}`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="14" />
            </filter>
          </defs>

          <g filter={`url(#agg-blur-${entry.buildingId}-${entry.floorIndex})`}>
            {renderableCells.map((cell) => {
              const rect = gridCellRect(cell)
              return (
                <rect
                  key={`${cell.cellX}-${cell.cellY}`}
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

          {entry.floor?.nodes.filter((n) => n.type === 'exit').map((node) => (
            <g key={node.id}>
              <circle cx={node.x} cy={node.y} r="11" fill="#ffffff" stroke={ACCENT} strokeWidth="2.5" />
              <text x={node.x} y={node.y + 3} textAnchor="middle" fontSize="9" fontWeight="800" fill={ACCENT_DARK}>
                {node.label.replace('Exit ', '')}
              </text>
            </g>
          ))}
        </svg>

        {renderableCells.length === 0 && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(248,250,252,0.85)',
            color: 'var(--text-secondary)', fontSize: '13px',
          }}>
            No density recorded across the contributing runs.
          </div>
        )}
      </div>
    </div>
  )
}

interface StatChipProps {
  label: string
  value: number
  accent: string
  emphasized?: boolean
}

function StatChip({ label, value, accent, emphasized }: StatChipProps) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'baseline', gap: '6px',
      padding: '4px 10px', borderRadius: '999px',
      background: emphasized ? `${accent}12` : '#f8fafc',
      border: `1px solid ${emphasized ? `${accent}44` : 'var(--border)'}`,
      fontSize: '11px',
    }}>
      <span style={{
        fontSize: '9.5px', fontWeight: 700,
        color: accent, letterSpacing: '0.08em', textTransform: 'uppercase',
      }}>
        {label}
      </span>
      <span style={{ fontWeight: 800, color: '#0f172a', fontFeatureSettings: '"tnum"' }}>
        {value}
      </span>
    </div>
  )
}
