'use client'

import { useEffect, useMemo, useState } from 'react'
import { getRunTrends, type BuildingFloorTrend, type RunTrendPoint } from '@/src/services/simulation.service'
import { getBuildingById } from '@/src/simulation/building-model'

/**
 * Drill-trend view.
 *
 * For each building floor, shows whether evacuation performance is improving
 * or regressing run-over-run. Trends are only meaningful with a few drills
 * behind them, so floors with fewer than `MIN_RUNS_FOR_TREND` runs get a
 * "needs a baseline" gate instead of a noisy single-point arrow.
 */
const MIN_RUNS_FOR_TREND = 3
const ACCENT = '#2db8b0'
const RATE_ACCENT = '#6366f1'

interface ResolvedTrend extends BuildingFloorTrend {
  buildingName: string
  floorLabel: string
}

type Direction = 'lower' | 'higher'

function evacRate(run: RunTrendPoint): number {
  return run.agentCount > 0 ? (run.evacuatedCount / run.agentCount) * 100 : 0
}

export function BuildingTrends() {
  const [trends, setTrends] = useState<BuildingFloorTrend[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setIsLoading(true)
      setError(null)
      try {
        const data = await getRunTrends()
        if (!cancelled) setTrends(data)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load drill trends')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const resolved: ResolvedTrend[] = useMemo(() => {
    return trends.map((t) => {
      const building = getBuildingById(t.buildingId)
      return {
        ...t,
        buildingName: building?.name ?? t.buildingId,
        floorLabel: building?.floors[t.floorIndex]?.label ?? `Floor ${t.floorIndex + 1}`,
      }
    })
  }, [trends])

  const { ready, gated } = useMemo(() => {
    const ready = resolved
      .filter((t) => t.runs.length >= MIN_RUNS_FOR_TREND)
      .sort((a, b) => b.runs.length - a.runs.length)
    const gated = resolved
      .filter((t) => t.runs.length < MIN_RUNS_FOR_TREND)
      .sort((a, b) => b.runs.length - a.runs.length)
    return { ready, gated }
  }, [resolved])

  if (isLoading) {
    return <div style={{ padding: '24px 8px', fontSize: '13px', color: 'var(--text-secondary)' }}>Loading drill trends…</div>
  }

  if (error) {
    return (
      <div style={{ padding: '16px', borderRadius: '10px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.35)', color: '#ef4444', fontSize: '13px' }}>
        {error}
      </div>
    )
  }

  if (resolved.length === 0) {
    return (
      <div style={{
        padding: '32px 24px', textAlign: 'center',
        color: 'var(--text-secondary)', fontSize: '13px',
        background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)',
        borderRadius: '12px', border: '1px dashed #cbd5e1',
      }}>
        No completed drills with floor data yet — run a few simulations and
        per-floor trends will build up here.
      </div>
    )
  }

  return (
    <div>
      <p style={{ margin: '0 0 16px', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
        Arrows compare the most recent drill to the one before it. A floor needs
        at least {MIN_RUNS_FOR_TREND} drills before a trend is considered
        reliable.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {ready.map((trend) => (
          <TrendCard key={`${trend.buildingId}:${trend.floorIndex}`} trend={trend} />
        ))}
      </div>

      {gated.length > 0 && (
        <>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            margin: '22px 0 12px',
          }}>
            <div style={{ height: '1px', flex: 1, background: 'var(--border)' }} />
            <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Needs a baseline
            </span>
            <div style={{ height: '1px', flex: 1, background: 'var(--border)' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {gated.map((trend) => (
              <BaselineGateCard key={`${trend.buildingId}:${trend.floorIndex}`} trend={trend} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/* ── Trend card (≥ MIN_RUNS_FOR_TREND drills) ─────────────────────────── */

function TrendCard({ trend }: { trend: ResolvedTrend }) {
  const runs = trend.runs
  const latest = runs[runs.length - 1]
  const previous = runs[runs.length - 2]

  return (
    <div style={{
      border: '1px solid var(--border)', borderRadius: '12px',
      padding: '16px 18px', background: 'var(--bg-card)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        gap: '12px', marginBottom: '14px', flexWrap: 'wrap',
      }}>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
            {trend.buildingName}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            {trend.floorLabel}
          </div>
        </div>
        <span style={{
          fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)',
          background: 'var(--bg-inset)', borderRadius: '999px', padding: '4px 10px',
        }}>
          {runs.length} drills
        </span>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px',
      }}>
        <MetricDelta
          label="Evacuation time"
          latest={`${latest.evacuationTime.toFixed(1)}s`}
          delta={latest.evacuationTime - previous.evacuationTime}
          better="lower"
          formatDelta={(d) => `${Math.abs(d).toFixed(1)}s`}
        />
        <MetricDelta
          label="Evacuated"
          latest={`${evacRate(latest).toFixed(0)}%`}
          delta={evacRate(latest) - evacRate(previous)}
          better="higher"
          formatDelta={(d) => `${Math.abs(d).toFixed(0)}%`}
        />
        <MetricDelta
          label="Max congestion"
          latest={`${Math.round(latest.maxCongestion)}%`}
          delta={latest.maxCongestion - previous.maxCongestion}
          better="lower"
          formatDelta={(d) => `${Math.abs(Math.round(d))}%`}
        />
      </div>

      <div style={{ marginTop: '14px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)',
          letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '4px',
        }}>
          <span>Trend · oldest → latest</span>
        </div>
        <Sparkline
          values={runs.map((r) => r.evacuationTime)}
          rates={runs.map((r) => evacRate(r))}
        />
      </div>
    </div>
  )
}

interface MetricDeltaProps {
  label: string
  latest: string
  delta: number
  better: Direction
  formatDelta: (d: number) => string
}

function MetricDelta({ label, latest, delta, better, formatDelta }: MetricDeltaProps) {
  const flat = Math.abs(delta) < 0.05
  const improved = !flat && (better === 'lower' ? delta < 0 : delta > 0)
  const color = flat ? '#64748b' : improved ? '#16a34a' : '#dc2626'
  const arrow = flat ? '→' : delta > 0 ? '▲' : '▼'

  return (
    <div style={{
      border: '1px solid var(--border)', borderRadius: '10px',
      padding: '10px 12px', background: 'var(--bg-subtle)',
    }}>
      <div style={{
        fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)',
        letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '6px',
      }}>
        {label}
      </div>
      <div style={{ fontSize: '19px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1 }}>
        {latest}
      </div>
      <div style={{
        marginTop: '6px', display: 'inline-flex', alignItems: 'center', gap: '4px',
        fontSize: '11px', fontWeight: 700, color,
      }}>
        <span>{arrow}</span>
        <span>{flat ? 'No change' : formatDelta(delta)}</span>
      </div>
    </div>
  )
}

/**
 * Dual-metric sparkline. The solid teal line is evacuation time; the dashed
 * indigo line is evacuation rate. The two series sit on different scales
 * (seconds vs. percent) so each is normalized independently — the chart
 * communicates trend *shape*, not absolute values. A legend names them.
 */
function Sparkline({ values, rates }: { values: number[]; rates?: number[] }) {
  const W = 280
  const H = 38
  const PAD = 4
  if (values.length < 2) return null

  const toPoints = (series: number[]) => {
    const min = Math.min(...series)
    const max = Math.max(...series)
    const span = max - min || 1
    return series.map((v, i) => ({
      x: PAD + (i / (series.length - 1)) * (W - PAD * 2),
      y: PAD + (1 - (v - min) / span) * (H - PAD * 2),
    }))
  }
  const toPath = (pts: { x: number; y: number }[]) =>
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')

  const timePoints = toPoints(values)
  const ratePoints = rates && rates.length === values.length ? toPoints(rates) : null

  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: '38px', display: 'block' }}>
        {ratePoints && (
          <path
            d={toPath(ratePoints)}
            fill="none"
            stroke={RATE_ACCENT}
            strokeWidth="1.8"
            strokeDasharray="3 3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        <path d={toPath(timePoints)} fill="none" stroke={ACCENT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {timePoints.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={i === timePoints.length - 1 ? 3.4 : 2}
            fill={i === timePoints.length - 1 ? ACCENT : '#ffffff'}
            stroke={ACCENT}
            strokeWidth="1.5"
          />
        ))}
      </svg>
      {ratePoints && (
        <div style={{ display: 'flex', gap: '16px', marginTop: '6px' }}>
          <LegendItem dashed={false} color={ACCENT} label="Evac time" />
          <LegendItem dashed color={RATE_ACCENT} label="Evac rate" />
        </div>
      )}
    </>
  )
}

/** A single line-swatch + label for the sparkline legend. */
function LegendItem({ dashed, color, label }: { dashed: boolean; color: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <svg width="18" height="6" viewBox="0 0 18 6">
        <line
          x1="0" y1="3" x2="18" y2="3"
          stroke={color} strokeWidth="2" strokeLinecap="round"
          strokeDasharray={dashed ? '3 3' : undefined}
        />
      </svg>
      <span style={{
        fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)',
        letterSpacing: '0.04em', textTransform: 'uppercase',
      }}>
        {label}
      </span>
    </div>
  )
}

/* ── Baseline gate card (< MIN_RUNS_FOR_TREND drills) ──────────────────── */

function BaselineGateCard({ trend }: { trend: ResolvedTrend }) {
  const have = trend.runs.length
  const need = MIN_RUNS_FOR_TREND - have

  return (
    <div style={{
      border: '1px dashed #cbd5e1', borderRadius: '12px',
      padding: '14px 16px', background: 'var(--bg-subtle)',
      display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap',
    }}>
      <div style={{ flex: 1, minWidth: '180px' }}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
          {trend.buildingName} · {trend.floorLabel}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
          {have} of {MIN_RUNS_FOR_TREND} drills — run {need} more
          {need === 1 ? ' drill' : ' drills'} to establish a trend baseline.
        </div>
      </div>
      <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
        {Array.from({ length: MIN_RUNS_FOR_TREND }).map((_, i) => (
          <span
            key={i}
            style={{
              width: '26px', height: '8px', borderRadius: '999px',
              background: i < have ? ACCENT : '#e2e8f0',
            }}
          />
        ))}
      </div>
    </div>
  )
}
