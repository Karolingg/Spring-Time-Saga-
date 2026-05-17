'use client'

import { useEffect, useMemo, useState } from 'react'
import { getAggregateZoneStats } from '@/src/services/simulation.service'
import type { RiskLevel } from '@/src/schema/enums'

/* ── Types & constants ─────────────────────────────────────────────── */

interface AggregateZoneStat {
  zoneName: string
  avgIntensity: number
  avgAgentCount: number
  totalBottlenecks: number
  dominantRiskLevel: RiskLevel
}

type BandKey = 'critical' | 'high' | 'medium' | 'low'

const ACCENT = '#2db8b0'

const RISK_COLORS: Record<string, string> = {
  HIGH: '#ef4444', MEDIUM: '#f59e0b', LOW: '#22c55e',
}

interface BandDef { key: BandKey; label: string; color: string; min: number }

const BANDS: BandDef[] = [
  { key: 'critical', label: 'Critical', color: '#e11d48', min: 75 },
  { key: 'high',     label: 'High',     color: '#ea580c', min: 55 },
  { key: 'medium',   label: 'Medium',   color: '#f59e0b', min: 35 },
  { key: 'low',      label: 'Low',      color: '#22c55e', min: 0  },
]

function bandFor(intensity: number): BandDef {
  for (const band of BANDS) if (intensity >= band.min) return band
  return BANDS[BANDS.length - 1]
}

function friendlyType(zoneName: string): string {
  const n = zoneName.toLowerCase()
  if (n.includes('corridor') || n.includes('hallway')) return 'Corridor'
  if (n.includes('stair'))    return 'Stairwell'
  if (n.includes('exit') || n.includes('out ') || n.startsWith('out')) return 'Exit area'
  if (n.includes('door'))     return 'Doorway'
  if (n.includes('room'))     return 'Room entrance'
  if (n.includes('toilet') || n.includes('restroom')) return 'Restroom area'
  if (n.includes('waypoint')) return 'Passage'
  return 'Zone'
}

function actionSentence(zone: AggregateZoneStat): string {
  const band = bandFor(zone.avgIntensity)
  if (band.key === 'critical')
    return 'This area consistently becomes a chokepoint across multiple drills — agents are unable to pass freely.'
  if (band.key === 'high')
    return 'Recurring high congestion — consider widening this passage or adding exit signage.'
  if (band.key === 'medium')
    return 'Moderate crowding across drills — may slow evacuation under heavier occupancy scenarios.'
  return 'Minimal congestion across drills — agents typically move through this area freely.'
}

const SECTION_CARD: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid var(--border)',
  borderRadius: '14px',
  padding: '28px 32px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  marginBottom: '20px',
}

/* ── Main component ────────────────────────────────────────────────── */

interface AggregateAnalysisProps {
  /** Hide the internal section header (use when wrapping in a FeatureContainer). */
  hideHeader?: boolean
}

export function AggregateAnalysis({ hideHeader = false }: AggregateAnalysisProps = {}) {
  const [zones, setZones] = useState<AggregateZoneStat[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [expandedZone, setExpandedZone] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)

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
    () => zones.filter(z => z.avgIntensity > 0 || z.avgAgentCount > 0 || z.totalBottlenecks > 0),
    [zones],
  )

  const sorted = useMemo(
    () => [...visibleZones].sort((a, b) => b.avgIntensity - a.avgIntensity),
    [visibleZones],
  )

  const summary = useMemo(() => {
    const counts: Record<BandKey, number> = { critical: 0, high: 0, medium: 0, low: 0 }
    let totalIntensity = 0, totalBn = 0, peakAgents = 0
    for (const z of visibleZones) {
      totalIntensity += z.avgIntensity
      totalBn += z.totalBottlenecks
      peakAgents = Math.max(peakAgents, z.avgAgentCount)
      counts[bandFor(z.avgIntensity).key]++
    }
    return {
      count: visibleZones.length,
      avgIntensity: visibleZones.length > 0 ? totalIntensity / visibleZones.length : 0,
      totalBn, peakAgents, counts,
    }
  }, [visibleZones])

  /* Auto-generated summary paragraph */
  const summaryText = useMemo(() => {
    if (sorted.length === 0) return ''
    const crit = sorted.filter(z => z.avgIntensity >= 75)
    const high = sorted.filter(z => z.avgIntensity >= 55 && z.avgIntensity < 75)
    const low  = sorted.filter(z => z.avgIntensity < 35 && z.avgAgentCount > 0)
    const parts: string[] = []

    if (crit.length > 0) {
      const names = crit.slice(0, 2).map(z => z.zoneName).join(' and ')
      parts.push(`${crit.length} zone${crit.length > 1 ? 's' : ''} consistently reach critical congestion across drills. ${names} ${crit.length > 1 ? 'are' : 'is'} the most severe.`)
    } else if (high.length > 0) {
      parts.push(`${high.length} zone${high.length > 1 ? 's' : ''} show high congestion patterns, though no persistent critical chokepoints were found.`)
    } else {
      parts.push('No critical or high-congestion zones were detected across completed drills.')
    }

    if (summary.totalBn > 0) {
      parts.push(`${summary.totalBn} total bottleneck events recorded.`)
    }

    if (low.length > 0) {
      parts.push(`${low.length} zone${low.length > 1 ? 's remain' : ' remains'} underutilized — redirecting occupants there could relieve pressure on congested areas.`)
    }

    return parts.join(' ')
  }, [sorted, summary])

  if (isLoading) {
    return (
      <div style={{ ...SECTION_CARD, textAlign: 'center', padding: '40px' }}>
        <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Loading aggregate data...</div>
      </div>
    )
  }

  if (visibleZones.length === 0) {
    return (
      <div style={{ ...SECTION_CARD, textAlign: 'center', padding: '40px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3v18h18" /><path d="M7 15l3-3 3 2 4-6" />
          </svg>
        </div>
        <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>
          No completed simulations yet — run some simulations to see aggregate statistics.
        </p>
      </div>
    )
  }

  const displayList = showAll ? sorted : sorted.slice(0, 5)

  return (
    <div style={hideHeader ? {} : SECTION_CARD}>
      {/* ── Header ──────────────────────────────────────────── */}
      {!hideHeader && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '10px',
            background: `linear-gradient(135deg, ${ACCENT}1f 0%, ${ACCENT}08 100%)`,
            border: `1px solid ${ACCENT}33`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3v18h18"/><path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"/>
            </svg>
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
              Aggregate Zone Analysis
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
              Congestion patterns across all completed drills
            </p>
          </div>
        </div>
      )}

      {/* ── KPI strip ───────────────────────────────────────── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: '10px', marginBottom: '20px',
      }}>
        <KpiPill label="Zones Analyzed" value={String(summary.count)} color={ACCENT} />
        <KpiPill label="Avg Intensity" value={`${summary.avgIntensity.toFixed(0)}%`} color={bandFor(summary.avgIntensity).color} />
        <KpiPill label="Total Bottlenecks" value={String(summary.totalBn)} color={summary.totalBn > 0 ? '#f97316' : '#22c55e'} />
        <KpiPill label="Critical Zones" value={String(summary.counts.critical)} color={summary.counts.critical > 0 ? '#e11d48' : '#22c55e'} />
      </div>

      {/* ── Intensity distribution bar ────────────────────── */}
      <div style={{
        marginBottom: '20px', padding: '12px 16px',
        background: '#f8fafc', border: '1px solid var(--border)', borderRadius: '12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', gap: '12px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '10px', fontWeight: 700, color: '#475569', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Intensity distribution
          </span>
          <div style={{ display: 'inline-flex', gap: '14px', flexWrap: 'wrap' }}>
            {BANDS.map(band => (
              <span key={band.key} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: band.color }} />
                <strong style={{ color: '#0f172a', fontWeight: 700 }}>{summary.counts[band.key]}</strong> {band.label}
              </span>
            ))}
          </div>
        </div>
        {(() => {
          const total = BANDS.reduce((s, b) => s + summary.counts[b.key], 0)
          if (total === 0) return null
          return (
            <div style={{ display: 'flex', height: '10px', borderRadius: '999px', overflow: 'hidden', border: '1px solid var(--border)', background: '#f1f5f9' }}>
              {BANDS.map(band => {
                const n = summary.counts[band.key]
                if (n === 0) return null
                return <div key={band.key} style={{ width: `${(n / total) * 100}%`, background: band.color, transition: 'width 0.4s ease' }} />
              })}
            </div>
          )
        })()}
      </div>

      {/* ── Top problem areas table ─────────────────────────── */}
      <div style={{
        border: '1px solid var(--border)', borderRadius: '12px',
        overflow: 'hidden', marginBottom: '16px',
      }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '2fr 1fr 90px 90px',
          padding: '10px 16px', background: '#f8fafc',
          borderBottom: '1px solid var(--border)',
          fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em',
          color: '#64748b', textTransform: 'uppercase',
        }}>
          <span>Zone</span>
          <span>Risk</span>
          <span style={{ textAlign: 'right' }}>Avg Intensity</span>
          <span style={{ textAlign: 'right' }}>Bottlenecks</span>
        </div>

        {displayList.map((zone, i) => {
          const band = bandFor(zone.avgIntensity)
          const riskColor = RISK_COLORS[zone.dominantRiskLevel] ?? '#22c55e'
          const zoneKey = zone.zoneName + i
          const isExpanded = expandedZone === zoneKey

          return (
            <div key={zoneKey}>
              <div
                onClick={() => setExpandedZone(isExpanded ? null : zoneKey)}
                style={{
                  display: 'grid', gridTemplateColumns: '2fr 1fr 90px 90px',
                  padding: '12px 16px', borderBottom: '1px solid #f1f5f9',
                  cursor: 'pointer',
                  background: isExpanded ? `${band.color}08` : '#ffffff',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background = '#fafbfd' }}
                onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.background = isExpanded ? `${band.color}08` : '#ffffff' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '4px', height: '24px', borderRadius: '2px', background: band.color }} />
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>{zone.zoneName}</div>
                    <div style={{ fontSize: '10px', color: '#94a3b8' }}>{friendlyType(zone.zoneName)}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{
                    padding: '2px 10px', borderRadius: '999px',
                    background: `${riskColor}14`, color: riskColor,
                    fontSize: '10px', fontWeight: 700,
                  }}>{zone.dominantRiskLevel}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                  <div style={{ width: '36px', height: '6px', borderRadius: '3px', background: '#f1f5f9', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(100, zone.avgIntensity)}%`, background: band.color, borderRadius: '3px' }} />
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: band.color, minWidth: '32px', textAlign: 'right' }}>
                    {zone.avgIntensity.toFixed(0)}%
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: zone.totalBottlenecks > 0 ? '#ef4444' : '#22c55e' }}>
                    {zone.totalBottlenecks}
                  </span>
                </div>
              </div>

              {isExpanded && (
                <div style={{
                  padding: '14px 20px 14px 40px',
                  background: `${band.color}06`,
                  borderBottom: `1px solid ${band.color}22`,
                }}>
                  <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginBottom: '10px' }}>
                    <DetailItem label="Zone type" value={friendlyType(zone.zoneName)} />
                    <DetailItem label="Avg agents" value={`${zone.avgAgentCount} people`} />
                    <DetailItem label="Total bottlenecks" value={String(zone.totalBottlenecks)} />
                    <DetailItem label="Risk level" value={zone.dominantRiskLevel} color={riskColor} />
                  </div>
                  <p style={{
                    margin: 0, fontSize: '12px', color: '#475569', lineHeight: 1.5, fontStyle: 'italic',
                    padding: '8px 12px', background: '#ffffff', borderRadius: '8px', border: '1px solid var(--border)',
                  }}>
                    {actionSentence(zone)}
                  </p>
                </div>
              )}
            </div>
          )
        })}

        {sorted.length > 5 && (
          <div
            onClick={() => setShowAll(!showAll)}
            style={{
              padding: '10px 16px', textAlign: 'center',
              fontSize: '12px', fontWeight: 600, color: '#2db8b0',
              cursor: 'pointer', background: '#fafbfd',
              borderTop: '1px solid var(--border)',
            }}
          >
            {showAll ? 'Show top 5 only' : `Show all ${sorted.length} zones`}
          </div>
        )}
      </div>

      {/* ── Plain-language summary ──────────────────────────── */}
      {summaryText && (
        <div style={{
          padding: '14px 18px',
          background: 'linear-gradient(135deg, rgba(45,184,176,0.05) 0%, rgba(45,184,176,0.02) 100%)',
          border: '1px solid rgba(45,184,176,0.15)', borderRadius: '12px',
          fontSize: '13px', lineHeight: 1.6, color: '#334155',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em',
            color: '#2db8b0', textTransform: 'uppercase', marginBottom: '6px',
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z" />
            </svg>
            Summary
          </div>
          {summaryText}
        </div>
      )}
    </div>
  )
}

/* ── Sub-components ────────────────────────────────────────────────── */

function KpiPill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      padding: '12px 14px', background: '#ffffff',
      border: '1px solid var(--border)', borderRadius: '10px',
    }}>
      <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>
        {label}
      </div>
      <div style={{ fontSize: '22px', fontWeight: 800, color, letterSpacing: '-0.02em', lineHeight: 1, fontFeatureSettings: '"tnum"' }}>
        {value}
      </div>
    </div>
  )
}

function DetailItem({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: '10px', fontWeight: 600, color: '#94a3b8', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '2px' }}>{label}</div>
      <div style={{ fontSize: '13px', fontWeight: 600, color: color ?? '#0f172a' }}>{value}</div>
    </div>
  )
}
