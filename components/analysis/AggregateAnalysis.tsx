'use client'

import { useEffect, useMemo, useState } from 'react'
import { getAggregateZoneStats } from '@/src/services/simulation.service'
import type { RiskLevel } from '@/src/schema/enums'

interface AggregateZoneStat {
  zoneName: string
  avgIntensity: number
  avgAgentCount: number
  totalBottlenecks: number
  dominantRiskLevel: RiskLevel
}

type BandKey = 'critical' | 'high' | 'medium' | 'low'
type BandFilter = 'ALL' | BandKey
type SortKey = 'intensity' | 'bottlenecks' | 'agents' | 'name'

const RISK_COLORS: Record<string, string> = {
  HIGH: '#ef4444',
  MEDIUM: '#f59e0b',
  LOW: '#22c55e',
}

const ACCENT = '#2db8b0'

interface BandDef {
  key: BandKey
  label: string
  color: string
  /** Intensity threshold — a zone falls in this band if `avgIntensity >= min`
   *  and below the next-higher band's threshold. */
  min: number
}

const BANDS: BandDef[] = [
  { key: 'critical', label: 'Critical', color: '#e11d48', min: 75 },
  { key: 'high',     label: 'High',     color: '#ea580c', min: 55 },
  { key: 'medium',   label: 'Medium',   color: '#f59e0b', min: 35 },
  { key: 'low',      label: 'Low',      color: '#22c55e', min: 0  },
]

function bandFor(intensity: number): BandDef {
  for (const band of BANDS) {
    if (intensity >= band.min) return band
  }
  return BANDS[BANDS.length - 1]
}

function getIntensityColor(intensity: number): string {
  return bandFor(intensity).color
}

function getIntensityLabel(intensity: number): string {
  return bandFor(intensity).label
}

const SECTION_CARD: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid var(--border)',
  borderRadius: '14px',
  padding: '28px 32px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  marginBottom: '20px',
}

export function AggregateAnalysis() {
  const [zones, setZones] = useState<AggregateZoneStat[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<BandFilter>('ALL')
  const [sort, setSort] = useState<SortKey>('intensity')

  useEffect(() => {
    async function load() {
      setIsLoading(true)
      try {
        const data = await getAggregateZoneStats()
        setZones(data)
      } catch (err) {
        console.error('Failed to load aggregate zone stats:', err)
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [])

  const visibleZones = useMemo(
    () => zones.filter((zone) => zone.avgIntensity > 0 || zone.avgAgentCount > 0 || zone.totalBottlenecks > 0),
    [zones],
  )

  const summary = useMemo(() => {
    const counts: Record<BandKey, number> = { critical: 0, high: 0, medium: 0, low: 0 }
    let totalIntensity = 0
    let totalBottlenecks = 0
    let peakAgents = 0
    for (const z of visibleZones) {
      totalIntensity += z.avgIntensity
      totalBottlenecks += z.totalBottlenecks
      peakAgents = Math.max(peakAgents, z.avgAgentCount)
      counts[bandFor(z.avgIntensity).key]++
    }
    return {
      count: visibleZones.length,
      avgIntensity: visibleZones.length > 0 ? totalIntensity / visibleZones.length : 0,
      totalBottlenecks,
      peakAgents,
      countsByBand: counts,
    }
  }, [visibleZones])

  /** Bucket every zone into its intensity-band column, then sort each column
   *  by the active sort key. Each column is a "lane" in the kanban view. */
  const zonesByBand: Record<BandKey, AggregateZoneStat[]> = useMemo(() => {
    const buckets: Record<BandKey, AggregateZoneStat[]> = { critical: [], high: [], medium: [], low: [] }
    for (const z of visibleZones) {
      buckets[bandFor(z.avgIntensity).key].push(z)
    }
    const cmp = (a: AggregateZoneStat, b: AggregateZoneStat) => {
      switch (sort) {
        case 'bottlenecks': return b.totalBottlenecks - a.totalBottlenecks
        case 'agents': return b.avgAgentCount - a.avgAgentCount
        case 'name': return a.zoneName.localeCompare(b.zoneName)
        case 'intensity':
        default: return b.avgIntensity - a.avgIntensity
      }
    }
    for (const key of Object.keys(buckets) as BandKey[]) {
      buckets[key].sort(cmp)
    }
    return buckets
  }, [visibleZones, sort])

  const visibleBands: BandDef[] = useMemo(() => {
    if (filter === 'ALL') return BANDS
    return BANDS.filter((b) => b.key === filter)
  }, [filter])

  const totalVisibleZoneCount = useMemo(() => {
    return visibleBands.reduce((sum, band) => sum + zonesByBand[band.key].length, 0)
  }, [visibleBands, zonesByBand])

  if (isLoading) {
    return (
      <div style={{ ...SECTION_CARD, textAlign: 'center', padding: '40px' }}>
        <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Loading aggregate data…</div>
      </div>
    )
  }

  if (visibleZones.length === 0) {
    return (
      <div style={{ ...SECTION_CARD, textAlign: 'center', padding: '40px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3v18h18" />
            <path d="M7 15l3-3 3 2 4-6" />
          </svg>
        </div>
        <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>
          No completed simulations yet — run some simulations to see aggregate statistics.
        </p>
      </div>
    )
  }

  return (
    <div style={SECTION_CARD}>
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
              <path d="M3 3v18h18"/>
              <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"/>
            </svg>
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
              Aggregate Zone Analysis
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
              Congestion intensity, risk levels, and bottleneck counts across all completed runs.
            </p>
          </div>
        </div>
      </div>

      {/* ── KPI strip ───────────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: '10px',
        marginBottom: '20px',
      }}>
        <KpiCard
          label="Zones Analyzed"
          value={String(summary.count)}
          accent={ACCENT}
          icon={(
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2V6z" />
              <path d="M9 4v14M15 6v14" />
            </svg>
          )}
        />
        <KpiCard
          label="Avg Intensity"
          value={`${summary.avgIntensity.toFixed(0)}%`}
          accent={getIntensityColor(summary.avgIntensity)}
          icon={(
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22c4-3 8-7 8-12a8 8 0 0 0-16 0c0 5 4 9 8 12z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          )}
        />
        <KpiCard
          label="Total Bottlenecks"
          value={String(summary.totalBottlenecks)}
          accent="#f97316"
          emphasized={summary.totalBottlenecks > 0}
          icon={(
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3l9 16H3L12 3z" />
              <path d="M12 9v4" />
              <circle cx="12" cy="16.5" r="0.7" fill="currentColor" />
            </svg>
          )}
        />
        <KpiCard
          label="Critical Zones"
          value={String(summary.countsByBand.critical)}
          accent="#e11d48"
          emphasized={summary.countsByBand.critical > 0}
          icon={(
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v4" />
              <circle cx="12" cy="16" r="0.7" fill="currentColor" />
            </svg>
          )}
        />
      </div>

      {/* ── Intensity distribution bar ────────────────────── */}
      {summary.count > 0 && (
        <div style={{
          marginBottom: '20px',
          padding: '14px 16px',
          background: 'linear-gradient(180deg, #fafcff 0%, #f2f6fb 100%)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', gap: '12px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, color: '#475569', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Intensity distribution
            </span>
            <div style={{ display: 'inline-flex', gap: '14px', flexWrap: 'wrap' }}>
              {BANDS.map((band) => (
                <RiskLegend
                  key={band.key}
                  label={band.label}
                  count={summary.countsByBand[band.key]}
                  color={band.color}
                />
              ))}
            </div>
          </div>
          <IntensityDistBar counts={summary.countsByBand} />
        </div>
      )}

      {/* ── Filter chips + sort dropdown ──────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        marginBottom: '14px', flexWrap: 'wrap',
      }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <FilterChip label="All" count={visibleZones.length} active={filter === 'ALL'} onClick={() => setFilter('ALL')} color={ACCENT} />
          {BANDS.map((band) => (
            <FilterChip
              key={band.key}
              label={band.label}
              count={summary.countsByBand[band.key]}
              active={filter === band.key}
              onClick={() => setFilter(band.key)}
              color={band.color}
            />
          ))}
        </div>
        <div style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <label htmlFor="zone-sort" style={{ fontSize: '11px', fontWeight: 700, color: '#475569', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Sort by
          </label>
          <select
            id="zone-sort"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            style={{
              padding: '6px 10px', borderRadius: '8px',
              border: '1px solid var(--border)', background: '#ffffff',
              fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)',
              cursor: 'pointer',
            }}
          >
            <option value="intensity">Avg intensity</option>
            <option value="bottlenecks">Bottlenecks</option>
            <option value="agents">Avg agents</option>
            <option value="name">Zone name</option>
          </select>
        </div>
      </div>

      {/* ── Zone grid — one column per intensity band ─────── */}
      {/* Kanban-style layout: each column is a color band and holds the
         zones that fall into that band. Empty bands collapse. */}
      <style>{`
        .agg-band-grid {
          display: grid;
          gap: 14px;
          align-items: start;
          grid-template-columns: minmax(0, 1fr);
        }
        .agg-band-grid[data-cols="2"] { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .agg-band-grid[data-cols="3"] { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        .agg-band-grid[data-cols="4"] { grid-template-columns: repeat(4, minmax(0, 1fr)); }
        @media (max-width: 1180px) {
          .agg-band-grid[data-cols="4"] { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .agg-band-grid[data-cols="3"] { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 720px) {
          .agg-band-grid { grid-template-columns: minmax(0, 1fr) !important; }
        }
      `}</style>
      {totalVisibleZoneCount === 0 ? (
        <div style={{
          padding: '24px', textAlign: 'center',
          color: 'var(--text-secondary)', fontSize: '13px',
          background: '#f8fafc', borderRadius: '12px',
          border: '1px dashed #cbd5e1',
        }}>
          No zones match this filter.
        </div>
      ) : (
        <div className="agg-band-grid" data-cols={visibleBands.length}>
          {visibleBands.map((band) => (
            <BandColumn
              key={band.key}
              band={band}
              zones={zonesByBand[band.key]}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface BandColumnProps {
  band: BandDef
  zones: AggregateZoneStat[]
}

function BandColumn({ band, zones }: BandColumnProps) {
  return (
    <div style={{
      background: `linear-gradient(180deg, ${band.color}08 0%, ${band.color}03 60%, transparent 100%)`,
      border: `1px solid ${band.color}33`,
      borderRadius: '14px',
      padding: '12px',
      display: 'flex', flexDirection: 'column', gap: '10px',
      minWidth: 0,
    }}>
      {/* Column header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '4px 6px 6px',
        borderBottom: `1px dashed ${band.color}44`,
      }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <span style={{
            width: '10px', height: '10px', borderRadius: '50%',
            background: band.color,
            boxShadow: `0 0 8px ${band.color}66`,
          }} />
          <span style={{
            fontSize: '11px', fontWeight: 800,
            color: band.color,
            letterSpacing: '0.08em', textTransform: 'uppercase',
          }}>
            {band.label}
          </span>
          <span style={{
            fontSize: '10px', fontWeight: 700, color: '#94a3b8',
            letterSpacing: '0.04em',
          }}>
            ≥ {band.min}%
          </span>
        </div>
        <span style={{
          padding: '2px 9px', borderRadius: '999px',
          background: `${band.color}14`,
          border: `1px solid ${band.color}44`,
          color: band.color,
          fontSize: '11px', fontWeight: 800,
          fontFeatureSettings: '"tnum"',
        }}>
          {zones.length}
        </span>
      </div>

      {/* Column body */}
      {zones.length === 0 ? (
        <div style={{
          padding: '18px 12px', textAlign: 'center',
          color: 'var(--text-muted)', fontSize: '12px',
          background: '#ffffff',
          borderRadius: '10px',
          border: '1px dashed var(--border)',
        }}>
          No zones in this band.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {zones.map((zone, i) => (
            <ZoneCard key={`${zone.zoneName}-${i}`} zone={zone} rank={i + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

interface KpiCardProps {
  label: string
  value: string
  accent: string
  icon: React.ReactNode
  emphasized?: boolean
}

function KpiCard({ label, value, accent, icon, emphasized }: KpiCardProps) {
  return (
    <div style={{
      padding: '14px 16px',
      background: emphasized ? `${accent}10` : '#ffffff',
      border: `1px solid ${emphasized ? `${accent}55` : 'var(--border)'}`,
      borderRadius: '12px',
      boxShadow: emphasized ? `0 0 0 3px ${accent}12` : '0 1px 2px rgba(15,23,42,0.04)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        fontSize: '10px', fontWeight: 700, color: accent,
        letterSpacing: '0.08em', textTransform: 'uppercase',
        marginBottom: '6px',
      }}>
        <span style={{ display: 'inline-flex', color: accent }}>{icon}</span>
        {label}
      </div>
      <div style={{
        fontSize: '24px', fontWeight: 800, color: '#0f172a',
        letterSpacing: '-0.02em', lineHeight: 1, fontFeatureSettings: '"tnum"',
      }}>
        {value}
      </div>
    </div>
  )
}

function RiskLegend({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-secondary)' }}>
      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: color }} />
      <strong style={{ color: '#0f172a', fontWeight: 700, fontFeatureSettings: '"tnum"' }}>{count}</strong>
      <span style={{ fontWeight: 600 }}>{label}</span>
    </span>
  )
}

function IntensityDistBar({ counts }: { counts: Record<BandKey, number> }) {
  const total = BANDS.reduce((sum, b) => sum + counts[b.key], 0)
  if (total === 0) return null
  return (
    <div style={{
      display: 'flex', height: '10px', borderRadius: '999px',
      overflow: 'hidden', border: '1px solid var(--border)',
      background: '#f1f5f9',
    }}>
      {BANDS.map((band) => {
        const n = counts[band.key]
        if (n === 0) return null
        return (
          <div
            key={band.key}
            title={`${n} ${band.label.toLowerCase()}`}
            style={{
              width: `${(n / total) * 100}%`,
              background: `linear-gradient(90deg, ${band.color} 0%, ${band.color}cc 100%)`,
              transition: 'width 0.4s ease',
            }}
          />
        )
      })}
    </div>
  )
}

interface FilterChipProps {
  label: string
  count: number
  active: boolean
  onClick: () => void
  color: string
}

function FilterChip({ label, count, active, onClick, color }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        padding: '6px 12px', borderRadius: '999px',
        background: active ? `${color}14` : '#ffffff',
        border: `1px solid ${active ? `${color}66` : 'var(--border)'}`,
        color: active ? color : '#475569',
        fontSize: '11px', fontWeight: 700,
        letterSpacing: '0.04em',
        cursor: 'pointer',
        transition: 'all 0.15s',
        boxShadow: active ? `0 1px 3px ${color}33` : 'none',
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
      {label}
      <span style={{
        padding: '1px 7px', borderRadius: '999px',
        background: active ? `${color}22` : '#f1f5f9',
        color: active ? color : '#64748b',
        fontSize: '10px', fontWeight: 800,
        fontFeatureSettings: '"tnum"',
      }}>
        {count}
      </span>
    </button>
  )
}

function ZoneCard({ zone, rank }: { zone: AggregateZoneStat; rank: number }) {
  const intensityColor = getIntensityColor(zone.avgIntensity)
  const intensityLabel = getIntensityLabel(zone.avgIntensity)
  const riskColor = RISK_COLORS[zone.dominantRiskLevel] ?? '#22c55e'
  return (
    <div style={{
      position: 'relative',
      padding: '14px 16px 14px 18px',
      background: '#ffffff',
      border: `1px solid ${intensityColor}33`,
      borderRadius: '12px',
      boxShadow: '0 2px 8px rgba(15,23,42,0.04), inset 0 0 0 1px rgba(255,255,255,0.4)',
      overflow: 'hidden',
      transition: 'transform 0.15s, box-shadow 0.15s',
      // Stretch every card to fill its grid row so the layout is uniform
      // regardless of zone-name length or value width.
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      minWidth: 0,
    }}>
      {/* Accent bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, bottom: 0, width: '4px',
        background: `linear-gradient(180deg, ${intensityColor} 0%, ${intensityColor}aa 100%)`,
      }} />

      {/* Title row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '10px' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{
            display: 'flex', alignItems: 'baseline', gap: '6px',
            fontSize: '10px', fontWeight: 800, color: intensityColor,
            letterSpacing: '0.08em', textTransform: 'uppercase',
            marginBottom: '2px',
          }}>
            <span>#{rank}</span>
            <span style={{ color: '#cbd5e1' }}>·</span>
            <span>{intensityLabel}</span>
          </div>
          <div
            title={zone.zoneName}
            style={{
              fontSize: '13px', fontWeight: 700, color: '#0f172a',
              lineHeight: 1.3,
              whiteSpace: 'nowrap',
              overflow: 'hidden', textOverflow: 'ellipsis',
            }}
          >
            {zone.zoneName}
          </div>
        </div>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: '5px',
          padding: '3px 9px', borderRadius: '999px',
          background: `${riskColor}14`,
          border: `1px solid ${riskColor}44`,
          color: riskColor,
          fontSize: '10px', fontWeight: 800,
          letterSpacing: '0.06em',
          flexShrink: 0,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: riskColor }} />
          {zone.dominantRiskLevel}
        </span>
      </div>

      {/* Intensity bar */}
      <div style={{ marginBottom: '10px' }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
          fontSize: '10px', fontWeight: 700,
          color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase',
          marginBottom: '4px',
        }}>
          <span>Avg intensity</span>
          <span style={{ color: intensityColor, fontSize: '13px', fontFeatureSettings: '"tnum"' }}>
            {zone.avgIntensity.toFixed(0)}%
          </span>
        </div>
        <div style={{
          height: '8px', background: '#f1f5f9',
          borderRadius: '999px', overflow: 'hidden',
          border: '1px solid var(--border)',
        }}>
          <div style={{
            height: '100%',
            width: `${Math.min(100, zone.avgIntensity)}%`,
            background: `linear-gradient(90deg, ${intensityColor}cc 0%, ${intensityColor} 100%)`,
            transition: 'width 0.4s ease',
            borderRadius: '999px',
          }} />
        </div>
      </div>

      {/* Mini stat row — pinned to the bottom of the card so every card has
         the same vertical structure even when the title is shorter. */}
      <div style={{
        marginTop: 'auto',
        display: 'flex', gap: '10px', flexWrap: 'wrap',
        paddingTop: '10px',
        borderTop: '1px dashed var(--border)',
      }}>
        <MiniStat
          label="Avg agents"
          value={zone.avgAgentCount}
          icon={(
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="7" r="3" />
              <path d="M3 21v-1a6 6 0 0 1 12 0v1" />
              <circle cx="17" cy="9" r="2.5" />
              <path d="M16 21v-1a4 4 0 0 1 4-4" />
            </svg>
          )}
          color="#1d4ed8"
        />
        <MiniStat
          label="Bottlenecks"
          value={zone.totalBottlenecks}
          icon={(
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3l9 16H3L12 3z" />
              <path d="M12 9v4" />
              <circle cx="12" cy="16.5" r="0.7" fill="currentColor" />
            </svg>
          )}
          color={zone.totalBottlenecks > 0 ? '#ef4444' : '#22c55e'}
        />
      </div>
    </div>
  )
}

function MiniStat({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}>
      <span style={{ color, display: 'inline-flex' }}>{icon}</span>
      <span style={{ fontWeight: 800, color: '#0f172a', fontFeatureSettings: '"tnum"' }}>{value}</span>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
    </div>
  )
}
