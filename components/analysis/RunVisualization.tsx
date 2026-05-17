'use client'

import { useMemo, useState } from 'react'
import { RunReplay } from '@/components/analysis/RunReplay'
import { SpatialBottleneckHeatmap } from '@/components/analysis/SpatialBottleneckHeatmap'
import { getBuildingById } from '@/src/simulation/building-model'
import type { PlacedHazard } from '@/src/simulation/hazard-placement'
import type { DensityCell, SimulationZone } from '@/src/schema/simulation.types'

type ViewMode = 'replay' | 'heatmap'

interface RunVisualizationProps {
  buildingId: string | null
  simulatedFloorIndex: number | null
  densityCells: DensityCell[]
  zones: SimulationZone[]
  agentCount?: number | null
  disasterType?: 'fire' | 'earthquake' | null
  /** Exact inputs needed to faithfully reproduce the original run. */
  hazards?: PlacedHazard[] | null
  agentsPerRoom?: Record<string, number> | null
  seed?: number | null
  /** Optional initial tab — defaults to replay. */
  initialView?: ViewMode
}

const ACCENT = '#2db8b0'
const ACCENT_DARK = '#1f9189'

export function RunVisualization({
  buildingId,
  simulatedFloorIndex,
  densityCells,
  zones,
  agentCount,
  disasterType,
  hazards,
  agentsPerRoom,
  seed,
  initialView = 'replay',
}: RunVisualizationProps) {
  const [view, setView] = useState<ViewMode>(initialView)

  const building = useMemo(
    () => (buildingId ? getBuildingById(buildingId) ?? null : null),
    [buildingId],
  )
  const floor = useMemo(() => {
    if (!building) return null
    if (simulatedFloorIndex == null) return building.floors[0] ?? null
    return building.floors[simulatedFloorIndex] ?? building.floors[0] ?? null
  }, [building, simulatedFloorIndex])

  const buildingLabel = building?.name ?? 'Building'
  const floorLabel = floor?.label ?? '—'

  return (
    <div>
      {/* ── Unified header: title + segmented tabs ───────────────── */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        gap: '16px', marginBottom: '18px', flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '42px', height: '42px', borderRadius: '12px',
            background: `linear-gradient(135deg, ${ACCENT}1f 0%, ${ACCENT}08 100%)`,
            border: `1px solid ${ACCENT}33`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            {view === 'replay' ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22c4-3 8-7 8-12a8 8 0 0 0-16 0c0 5 4 9 8 12z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            )}
          </div>
          <div>
            <h3 style={{
              margin: 0, fontSize: '17px', fontWeight: 700,
              color: 'var(--text-primary)', letterSpacing: '-0.01em',
            }}>
              {view === 'replay' ? 'Run Replay' : 'Crowd Heatmap'}
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
              {buildingLabel} · {floorLabel}
              {simulatedFloorIndex != null && (
                <span style={{
                  marginLeft: '8px', padding: '2px 8px',
                  borderRadius: '999px', background: '#f1f5f9',
                  fontSize: '10px', fontWeight: 700,
                  color: '#475569', letterSpacing: '0.04em',
                }}>
                  SIMULATED FLOOR
                </span>
              )}
            </p>
          </div>
        </div>

        {/* ── Segmented tabs ─────────────────────────────────────── */}
        <div
          role="tablist"
          aria-label="Run visualization view"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px',
            padding: '4px', borderRadius: '12px',
            background: '#f1f5f9',
            border: '1px solid var(--border)',
            boxShadow: 'inset 0 1px 2px rgba(15,23,42,0.04)',
          }}
        >
          <TabButton
            label="Replay"
            active={view === 'replay'}
            onClick={() => setView('replay')}
            icon={(
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="6 4 20 12 6 20 6 4" />
              </svg>
            )}
          />
          <TabButton
            label="Heatmap"
            active={view === 'heatmap'}
            onClick={() => setView('heatmap')}
            icon={(
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22c4-3 8-7 8-12a8 8 0 0 0-16 0c0 5 4 9 8 12z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            )}
          />
        </div>
      </div>

      {/* ── Active view ──────────────────────────────────────────── */}
      <div role="tabpanel">
        {view === 'replay' ? (
          <RunReplay
            buildingId={buildingId}
            simulatedFloorIndex={simulatedFloorIndex}
            zones={zones}
            agentCount={agentCount}
            disasterType={disasterType}
            hazards={hazards}
            agentsPerRoom={agentsPerRoom}
            seed={seed}
            hideHeader
          />
        ) : (
          <SpatialBottleneckHeatmap
            buildingId={buildingId}
            zones={zones}
            densityCells={densityCells}
            simulatedFloorIndex={simulatedFloorIndex}
            hazards={hazards}
            agentsPerRoom={agentsPerRoom}
            seed={seed}
            disasterType={disasterType}
            agentCount={agentCount}
            hideHeader
          />
        )}
      </div>
    </div>
  )
}

interface TabButtonProps {
  label: string
  active: boolean
  onClick: () => void
  icon: React.ReactNode
}

function TabButton({ label, active, onClick, icon }: TabButtonProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '7px',
        padding: '8px 14px',
        borderRadius: '9px',
        border: 'none',
        background: active ? '#ffffff' : 'transparent',
        color: active ? ACCENT_DARK : '#64748b',
        fontSize: '12px', fontWeight: 700,
        letterSpacing: '0.01em',
        cursor: 'pointer',
        boxShadow: active ? '0 1px 3px rgba(15,23,42,0.10), 0 0 0 1px rgba(45,184,176,0.18)' : 'none',
        transition: 'all 0.15s',
      }}
    >
      {icon}
      {label}
    </button>
  )
}
