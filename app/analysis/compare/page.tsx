'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '@/src/hooks/useAuth'
import { getSimulationHistory, getSimulationRun, getDensityCells } from '@/src/services/simulation.service'
import { getBuildingById } from '@/src/simulation/building-model'
import type { SimulationRun, SimulationZone, DensityCell } from '@/src/schema/simulation.types'
import { SpatialBottleneckHeatmap } from '@/components/analysis/SpatialBottleneckHeatmap'
import { FeatureContainer } from '@/components/analysis/FeatureContainer'

const SECTION_CARD: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid var(--border)',
  borderRadius: '14px',
  padding: '24px 28px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  marginBottom: '20px',
}

/**
 * Direction of "good" for a given KPI — used to colour the delta chip
 * green when the change moved the metric in the right direction and red
 * when it regressed.
 */
type Direction = 'lower' | 'higher'

interface MetricDef {
  key: string
  label: string
  unit: string
  better: Direction
  read: (run: SimulationRun) => number | null
  format: (value: number) => string
}

const METRICS: MetricDef[] = [
  {
    key: 'evacuationTime',
    label: 'Evacuation time',
    unit: 's',
    better: 'lower',
    read: (r) => r.results?.evacuationTime ?? null,
    format: (v) => `${v.toFixed(1)}s`,
  },
  {
    key: 'evacuatedCount',
    label: 'Evacuated',
    unit: '',
    better: 'higher',
    read: (r) => r.results?.evacuatedCount ?? null,
    format: (v) => String(Math.round(v)),
  },
  {
    key: 'maxCongestion',
    label: 'Max congestion',
    unit: '%',
    better: 'lower',
    read: (r) => r.results?.maxCongestion ?? null,
    format: (v) => `${Math.round(v)}%`,
  },
  {
    key: 'congestionExposure',
    label: 'Hazard exposure',
    unit: 's',
    better: 'lower',
    read: (r) => r.results?.congestionExposure ?? null,
    format: (v) => `${v.toFixed(1)}s`,
  },
  {
    key: 'globalPeakDensity',
    label: 'Peak density',
    unit: '%',
    better: 'lower',
    read: (r) => r.results?.globalPeakDensity ?? null,
    format: (v) => `${v.toFixed(1)}%`,
  },
  {
    key: 'totalBottlenecks',
    label: 'Total bottlenecks',
    unit: '',
    better: 'lower',
    read: (r) => r.zones.reduce((sum, z) => sum + z.bottleneckCount, 0),
    format: (v) => String(Math.round(v)),
  },
]

interface ZoneDelta {
  zoneName: string
  intensityA: number | null
  intensityB: number | null
  delta: number
  /** Magnitude used to rank zones by how much they changed. */
  absDelta: number
}

function buildZoneDeltas(a: SimulationRun, b: SimulationRun): ZoneDelta[] {
  const byName = new Map<string, { a?: SimulationZone; b?: SimulationZone }>()
  for (const z of a.zones) byName.set(z.zoneName, { a: z, b: byName.get(z.zoneName)?.b })
  for (const z of b.zones) byName.set(z.zoneName, { a: byName.get(z.zoneName)?.a, b: z })

  const rows: ZoneDelta[] = []
  for (const [zoneName, pair] of byName) {
    const intA = pair.a?.intensity ?? null
    const intB = pair.b?.intensity ?? null
    if ((intA ?? 0) === 0 && (intB ?? 0) === 0) continue
    const delta = (intB ?? 0) - (intA ?? 0)
    rows.push({ zoneName, intensityA: intA, intensityB: intB, delta, absDelta: Math.abs(delta) })
  }
  rows.sort((x, y) => y.absDelta - x.absDelta)
  return rows.slice(0, 8)
}

function describeRun(run: SimulationRun | null): string {
  if (!run) return 'No run selected'
  const building = run.buildingId ? getBuildingById(run.buildingId) : null
  const floorLabel = building && run.floorIndex != null ? building.floors[run.floorIndex]?.label : null
  const buildingName = building?.name ?? run.buildingId ?? 'Unknown building'
  const where = floorLabel ? `${buildingName} — ${floorLabel}` : buildingName
  const disaster = run.disasterType === 'fire' ? 'Fire' : 'Earthquake'
  const agents = run.config?.agentCount ?? 0
  return `${disaster} · ${agents} agents · ${where}`
}

function formatHistoryLabel(run: SimulationRun): string {
  const date = new Date(run.createdAt).toLocaleString()
  const id = run.id.slice(0, 8)
  return `${run.disasterType} · ${run.config?.agentCount ?? 0} agents · ${date} (${id})`
}

export default function CompareRunsPage() {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth()
  const searchParams = useSearchParams()

  const [history, setHistory] = useState<SimulationRun[]>([])
  const [runA, setRunA] = useState<SimulationRun | null>(null)
  const [runB, setRunB] = useState<SimulationRun | null>(null)
  const [densityCellsA, setDensityCellsA] = useState<DensityCell[]>([])
  const [densityCellsB, setDensityCellsB] = useState<DensityCell[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      window.location.href = '/auth'
    }
  }, [isAuthLoading, isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated) return
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const runs = await getSimulationHistory(50)
        if (cancelled) return
        setHistory(runs)

        const paramA = searchParams.get('a')
        const paramB = searchParams.get('b')

        // Prefer URL params, fall back to the two most recent completed runs.
        const initialA = paramA
          ? await getSimulationRun(paramA).catch(() => null)
          : runs[0] ?? null
        const initialB = paramB
          ? await getSimulationRun(paramB).catch(() => null)
          : runs[1] ?? null

        if (!cancelled) {
          setRunA(initialA)
          setRunB(initialB)
        }
      } catch (err) {
        if (!cancelled) setError((err as Error).message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [isAuthenticated, searchParams])

  /* Load density cells for each run (for the heatmap overlays) */
  useEffect(() => {
    if (!runA) { setDensityCellsA([]); return }
    let cancelled = false
    getDensityCells(runA.id).then(cells => { if (!cancelled) setDensityCellsA(cells) })
    return () => { cancelled = true }
  }, [runA?.id])

  useEffect(() => {
    if (!runB) { setDensityCellsB([]); return }
    let cancelled = false
    getDensityCells(runB.id).then(cells => { if (!cancelled) setDensityCellsB(cells) })
    return () => { cancelled = true }
  }, [runB?.id])

  async function selectRun(slot: 'A' | 'B', runId: string) {
    if (!runId) {
      if (slot === 'A') setRunA(null)
      else setRunB(null)
      return
    }
    try {
      const full = await getSimulationRun(runId)
      if (slot === 'A') setRunA(full)
      else setRunB(full)
    } catch (err) {
      console.error('Failed to load run for comparison:', err)
    }
  }

  function swapRuns() {
    setRunA(runB)
    setRunB(runA)
  }

  const zoneDeltas = useMemo(() => (
    runA && runB ? buildZoneDeltas(runA, runB) : []
  ), [runA, runB])

  if (isAuthLoading || loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Loading comparison…</div>
      </div>
    )
  }

  const canCompare = runA && runB && runA.id !== runB.id
  const sameRun = runA && runB && runA.id === runB.id

  return (
    <div style={{ minHeight: '100vh', padding: '88px 40px 56px', maxWidth: '1280px', margin: '0 auto' }}>
      <Header />

      {error && (
        <div style={{ ...SECTION_CARD, borderColor: '#fecaca', background: '#fef2f2', color: '#991b1b', fontSize: '14px' }}>
          {error}
        </div>
      )}

      {history.length < 2 ? (
        <EmptyState />
      ) : (
        <>
          <div style={SECTION_CARD}>
            <RunPickers
              history={history}
              runA={runA}
              runB={runB}
              onSelect={selectRun}
              onSwap={swapRuns}
            />
          </div>

          {sameRun && (
            <div style={{ ...SECTION_CARD, borderColor: '#fde68a', background: '#fffbeb', color: '#92400e', fontSize: '13px' }}>
              Both slots reference the same run. Pick a different run for slot B to see a comparison.
            </div>
          )}

          {canCompare && (
            <>
              {/* ── Layer 1: Key Metrics ─────────────────────────── */}
              <FeatureContainer
                title="Key Metrics"
                subtitle="Side-by-side evacuation statistics with directional delta indicators"
                accent="#2db8b0"
                badge="Layer 1"
                icon={
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 3v18h18" />
                    <path d="M7 14l4-4 4 4 5-5" />
                  </svg>
                }
              >
                <KpiGrid runA={runA!} runB={runB!} />
              </FeatureContainer>

              {/* ── Layer 2: Floor Heatmaps ──────────────────────── */}
              <FeatureContainer
                title="Floor Heatmaps"
                subtitle="Side-by-side crowd density comparison between the two runs"
                accent="#2db8b0"
                badge="Layer 2"
                icon={
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <path d="M9 3v18M15 3v18M3 9h18M3 15h18" />
                  </svg>
                }
              >
                <CompareHeatmaps
                  runA={runA!}
                  runB={runB!}
                  densityCellsA={densityCellsA}
                  densityCellsB={densityCellsB}
                />
              </FeatureContainer>

              {/* ── Layer 3: Biggest Zone Shifts ─────────────────── */}
              <FeatureContainer
                title="Biggest Zone Shifts"
                subtitle="Top zones ranked by absolute change in intensity between A and B"
                accent="#2db8b0"
                badge="Layer 3"
                icon={
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h6" /><path d="M3 12h6" /><path d="M3 18h6" />
                    <path d="M15 6h6" /><path d="M15 12h6" /><path d="M15 18h6" />
                  </svg>
                }
              >
                <ZoneDeltaTable rows={zoneDeltas} />
              </FeatureContainer>
            </>
          )}
        </>
      )}
    </div>
  )
}

function Header() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '24px', flexWrap: 'wrap' }}>
      <div style={{
        width: '44px', height: '44px', borderRadius: '12px',
        background: 'rgba(45,184,176,0.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2db8b0" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 6h6" /><path d="M3 12h6" /><path d="M3 18h6" />
          <path d="M15 6h6" /><path d="M15 12h6" /><path d="M15 18h6" />
        </svg>
      </div>
      <div style={{ flex: 1 }}>
        <h1 style={{ margin: 0, fontSize: '26px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
          Compare Drills
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
          Pick two completed runs to see how key metrics moved between them.
        </p>
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <a href="/analysis" style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          padding: '8px 14px', background: '#ffffff', color: '#0f172a',
          borderRadius: '8px', textDecoration: 'none', fontSize: '13px', fontWeight: 600,
          border: '1px solid var(--border)', flexShrink: 0,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back
        </a>
        <a href="/analysis/runs" style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          padding: '8px 14px', background: '#ffffff', color: '#0f172a',
          borderRadius: '8px', textDecoration: 'none', fontSize: '13px', fontWeight: 600,
          border: '1px solid var(--border)', flexShrink: 0,
        }}>
          View Runs
        </a>
      </div>
    </div>
  )
}

interface RunPickersProps {
  history: SimulationRun[]
  runA: SimulationRun | null
  runB: SimulationRun | null
  onSelect: (slot: 'A' | 'B', runId: string) => void
  onSwap: () => void
}

function RunPickers({ history, runA, runB, onSelect, onSwap }: RunPickersProps) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '16px', alignItems: 'end' }}>
      <RunSlot
        slotLabel="A · Baseline"
        slotColor="#64748b"
        history={history}
        currentId={runA?.id ?? ''}
        currentRun={runA}
        onChange={(id) => onSelect('A', id)}
      />

      <button
        type="button"
        onClick={onSwap}
        disabled={!runA || !runB}
        title="Swap A and B"
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: '38px', height: '38px',
          background: runA && runB ? '#ffffff' : '#f1f5f9',
          color: runA && runB ? '#0f172a' : '#94a3b8',
          border: '1px solid var(--border)', borderRadius: '8px',
          cursor: runA && runB ? 'pointer' : 'not-allowed',
          marginBottom: '4px',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="17 1 21 5 17 9" />
          <path d="M3 11V9a4 4 0 0 1 4-4h14" />
          <polyline points="7 23 3 19 7 15" />
          <path d="M21 13v2a4 4 0 0 1-4 4H3" />
        </svg>
      </button>

      <RunSlot
        slotLabel="B · Comparison"
        slotColor="#2db8b0"
        history={history}
        currentId={runB?.id ?? ''}
        currentRun={runB}
        onChange={(id) => onSelect('B', id)}
      />
    </div>
  )
}

interface RunSlotProps {
  slotLabel: string
  slotColor: string
  history: SimulationRun[]
  currentId: string
  currentRun: SimulationRun | null
  onChange: (id: string) => void
}

function RunSlot({ slotLabel, slotColor, history, currentId, currentRun, onChange }: RunSlotProps) {
  return (
    <div>
      <div style={{
        display: 'inline-block', padding: '2px 8px', borderRadius: '5px',
        fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em',
        background: `${slotColor}1A`, color: slotColor, marginBottom: '8px',
      }}>
        {slotLabel}
      </div>
      <select
        value={currentId}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%', padding: '10px 12px', borderRadius: '8px',
          border: '1px solid var(--border)', fontSize: '13px',
          color: 'var(--text-primary)', background: '#ffffff',
        }}
      >
        <option value="">— select a run —</option>
        {history.map((r) => (
          <option key={r.id} value={r.id}>{formatHistoryLabel(r)}</option>
        ))}
      </select>
      <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-secondary)', minHeight: '18px' }}>
        {describeRun(currentRun)}
      </div>
    </div>
  )
}

function KpiGrid({ runA, runB }: { runA: SimulationRun; runB: SimulationRun }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
      {METRICS.map((metric) => (
        <KpiDeltaCard key={metric.key} metric={metric} runA={runA} runB={runB} />
      ))}
    </div>
  )
}

function KpiDeltaCard({ metric, runA, runB }: { metric: MetricDef; runA: SimulationRun; runB: SimulationRun }) {
  const valueA = metric.read(runA)
  const valueB = metric.read(runB)
  const hasBoth = valueA != null && valueB != null
  const delta = hasBoth ? (valueB as number) - (valueA as number) : null
  const improved = delta != null && delta !== 0 && (
    metric.better === 'lower' ? delta < 0 : delta > 0
  )
  const regressed = delta != null && delta !== 0 && !improved
  const deltaColor = delta == null || delta === 0 ? '#64748b' : improved ? '#22c55e' : '#ef4444'
  const deltaPrefix = delta == null ? '' : delta > 0 ? '+' : ''

  return (
    <div style={{
      border: '1px solid var(--border)', borderRadius: '12px', padding: '14px 16px',
      background: '#f8fafc',
    }}>
      <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', color: '#64748b', textTransform: 'uppercase', marginBottom: '10px' }}>
        {metric.label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '4px' }}>
        <span style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', letterSpacing: '-0.02em' }}>
          {valueB != null ? metric.format(valueB) : '—'}
        </span>
        <span style={{ fontSize: '12px', color: '#94a3b8' }}>
          was {valueA != null ? metric.format(valueA) : '—'}
        </span>
      </div>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: '4px',
        fontSize: '12px', fontWeight: 600, color: deltaColor,
        padding: '2px 8px', borderRadius: '5px',
        background: delta == null || delta === 0 ? '#e2e8f0' : improved ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
      }}>
        {delta == null
          ? 'No data'
          : delta === 0
            ? 'Unchanged'
            : `${deltaPrefix}${metric.format(delta).replace(/^-/, '')} ${improved ? '↓ better' : regressed ? '↑ worse' : ''}`}
      </div>
    </div>
  )
}

function ZoneDeltaTable({ rows }: { rows: ZoneDelta[] }) {
  if (rows.length === 0) {
    return (
      <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
        Neither run recorded zone intensity, so there is nothing to compare here.
      </p>
    )
  }

  return (
    <>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead>
          <tr>
            <Th>Zone</Th>
            <Th align="right">A intensity</Th>
            <Th align="right">B intensity</Th>
            <Th align="right">Change</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const improved = row.delta < 0
            const color = row.delta === 0 ? '#64748b' : improved ? '#22c55e' : '#ef4444'
            return (
              <tr key={row.zoneName}>
                <Td>{row.zoneName}</Td>
                <Td align="right">{row.intensityA != null ? `${row.intensityA.toFixed(0)}%` : '—'}</Td>
                <Td align="right">{row.intensityB != null ? `${row.intensityB.toFixed(0)}%` : '—'}</Td>
                <Td align="right">
                  <span style={{
                    display: 'inline-block', padding: '2px 8px', borderRadius: '5px',
                    background: row.delta === 0 ? '#e2e8f0' : improved ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                    color, fontWeight: 600,
                  }}>
                    {row.delta > 0 ? '+' : ''}{row.delta.toFixed(0)}%
                  </span>
                </Td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </>
  )
}

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th style={{
      padding: '8px 10px', textAlign: align, borderBottom: '1px solid var(--border)',
      fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
      color: '#64748b', background: '#f8fafc',
    }}>
      {children}
    </th>
  )
}

function Td({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <td style={{
      padding: '10px', textAlign: align, borderBottom: '1px solid #e2e8f0',
      color: '#0f172a', verticalAlign: 'middle',
    }}>
      {children}
    </td>
  )
}

/* ── Side-by-side heatmap comparison ──────────────────────────────── */

function CompareHeatmaps({
  runA,
  runB,
  densityCellsA,
  densityCellsB,
}: {
  runA: SimulationRun
  runB: SimulationRun
  densityCellsA: DensityCell[]
  densityCellsB: DensityCell[]
}) {
  const buildingA = runA.buildingId ? getBuildingById(runA.buildingId) : null
  const buildingB = runB.buildingId ? getBuildingById(runB.buildingId) : null
  const hasFloorA = buildingA && runA.floorIndex != null
  const hasFloorB = buildingB && runB.floorIndex != null

  if (!hasFloorA && !hasFloorB) {
    return (
      <div style={{
        padding: '32px 20px', textAlign: 'center', fontSize: '13px',
        color: 'var(--text-secondary)',
        background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)',
        borderRadius: '12px', border: '1px dashed #cbd5e1',
      }}>
        Neither run has a floor-plan model — heatmaps need a building with an autonomous floor model.
      </div>
    )
  }

  return (
    <div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '20px',
      }}>
        {/* Slot A */}
        <div>
          <div style={{
            display: 'inline-block', padding: '3px 10px', borderRadius: '6px',
            fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em',
            background: 'rgba(100,116,139,0.1)', color: '#64748b',
            marginBottom: '10px',
          }}>
            A · Baseline
          </div>
          <SpatialBottleneckHeatmap
            buildingId={runA.buildingId}
            zones={runA.zones}
            densityCells={densityCellsA}
            simulatedFloorIndex={runA.floorIndex}
            hideHeader
            hazards={runA.hazards}
            agentsPerRoom={runA.agentsPerRoom}
            seed={runA.seed}
            disasterType={runA.disasterType}
            agentCount={runA.config?.agentCount ?? null}
          />
          <div style={{
            marginTop: '8px', padding: '8px 12px',
            background: '#f8fafc', borderRadius: '8px',
            border: '1px solid var(--border)',
            fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4,
          }}>
            {describeRun(runA)}
          </div>
        </div>

        {/* Slot B */}
        <div>
          <div style={{
            display: 'inline-block', padding: '3px 10px', borderRadius: '6px',
            fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em',
            background: 'rgba(45,184,176,0.1)', color: '#2db8b0',
            marginBottom: '10px',
          }}>
            B · Comparison
          </div>
          <SpatialBottleneckHeatmap
            buildingId={runB.buildingId}
            zones={runB.zones}
            densityCells={densityCellsB}
            simulatedFloorIndex={runB.floorIndex}
            hideHeader
            hazards={runB.hazards}
            agentsPerRoom={runB.agentsPerRoom}
            seed={runB.seed}
            disasterType={runB.disasterType}
            agentCount={runB.config?.agentCount ?? null}
          />
          <div style={{
            marginTop: '8px', padding: '8px 12px',
            background: '#f8fafc', borderRadius: '8px',
            border: '1px solid var(--border)',
            fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4,
          }}>
            {describeRun(runB)}
          </div>
        </div>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div style={{ ...SECTION_CARD, textAlign: 'center', padding: '60px 32px' }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
        <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="#2db8b0" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 6h6" /><path d="M3 12h6" /><path d="M3 18h6" />
          <path d="M15 6h6" /><path d="M15 12h6" /><path d="M15 18h6" />
        </svg>
      </div>
      <h2 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>
        Need at least two completed runs
      </h2>
      <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>
        Run the same preset again after changing hazards or occupancy and the second run will appear here for side-by-side review.
      </p>
      <a href="/map" style={{
        display: 'inline-block', marginTop: '16px', padding: '10px 20px',
        background: '#2db8b0', color: '#ffffff', borderRadius: '8px',
        textDecoration: 'none', fontSize: '14px', fontWeight: 600,
      }}>
        Run Simulation
      </a>
    </div>
  )
}
