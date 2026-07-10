'use client'

import { useMemo, useState } from 'react'
import type { SimulationZone } from '@/src/schema/simulation.types'

/* ── Risk / intensity colour helpers ───────────────────────────────── */

const BANDS = [
  { key: 'critical', label: 'Critical', color: '#ef4444', min: 75 },
  { key: 'high',     label: 'High',     color: '#f97316', min: 55 },
  { key: 'medium',   label: 'Medium',   color: '#f59e0b', min: 35 },
  { key: 'low',      label: 'Low',      color: '#22c55e', min: 0  },
] as const

function bandFor(intensity: number) {
  for (const b of BANDS) if (intensity >= b.min) return b
  return BANDS[BANDS.length - 1]
}

const RISK_COLORS: Record<string, string> = {
  HIGH: '#ef4444', MEDIUM: '#f59e0b', LOW: '#22c55e',
}

/* ── Friendly zone-type mapping ────────────────────────────────────── */

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

function actionSentence(zone: SimulationZone): string {
  const band = bandFor(zone.intensity)
  if (band.key === 'critical')
    return 'This area became a chokepoint during evacuation — agents were unable to pass freely.'
  if (band.key === 'high')
    return 'Sustained congestion detected — consider widening this passage or adding exit signage.'
  if (band.key === 'medium')
    return 'Moderate crowding observed — may slow evacuation under heavier occupancy.'
  return 'Minimal congestion — agents moved through this area freely.'
}

/* ── Component ─────────────────────────────────────────────────────── */

interface Props {
  zones: SimulationZone[]
  /** Hide the internal section header (use when wrapping in a FeatureContainer). */
  hideHeader?: boolean
}

export function ZoneAnalysisPanel({ zones, hideHeader = false }: Props) {
  const [expandedZone, setExpandedZone] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)

  const sorted = useMemo(
    () => [...zones].sort((a, b) => b.intensity - a.intensity),
    [zones],
  )

  const stats = useMemo(() => {
    let critHigh = 0, totalBn = 0, peakIntensity = 0, peakAgents = 0
    for (const z of zones) {
      if (z.intensity >= 55) critHigh++
      totalBn += z.bottleneckCount
      peakIntensity = Math.max(peakIntensity, z.intensity)
      peakAgents = Math.max(peakAgents, z.agentCount)
    }
    return { total: zones.length, critHigh, totalBn, peakIntensity, peakAgents }
  }, [zones])

  /* Auto-generated summary paragraph */
  const summaryText = useMemo(() => {
    if (zones.length === 0) return ''
    const critZones = sorted.filter(z => z.intensity >= 75)
    const highZones = sorted.filter(z => z.intensity >= 55 && z.intensity < 75)
    const lowUsed   = sorted.filter(z => z.intensity < 35 && z.agentCount > 0)
    const parts: string[] = []

    if (critZones.length > 0) {
      const names = critZones.slice(0, 2).map(z => z.zoneName).join(' and ')
      parts.push(`${critZones.length} critical zone${critZones.length > 1 ? 's' : ''} detected. ${names} experienced complete congestion — agents were unable to move freely.`)
    } else if (highZones.length > 0) {
      parts.push(`${highZones.length} high-congestion zone${highZones.length > 1 ? 's' : ''} found, though no critical chokepoints were recorded.`)
    } else {
      parts.push('No critical or high-congestion zones were detected in this drill.')
    }

    if (stats.totalBn > 0) {
      parts.push(`${stats.totalBn} bottleneck event${stats.totalBn > 1 ? 's' : ''} were recorded across the floor.`)
    }

    if (lowUsed.length > 0) {
      const underused = lowUsed[0].zoneName
      parts.push(`Consider redistributing exit signage toward ${underused}, which remained underutilized at ${lowUsed[0].intensity.toFixed(0)}%.`)
    }

    return parts.join(' ')
  }, [zones, sorted, stats])

  const displayList = showAll ? sorted : sorted.slice(0, 5)

  return (
    <div>
      {/* ── Section header ──────────────────────────────────── */}
      {!hideHeader && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '10px',
            background: 'rgba(45,184,176,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2db8b0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
            </svg>
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Zone Analysis
            </h3>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>
              Congestion intensity and risk assessment per zone
            </p>
          </div>
        </div>
      )}

      {/* ── Overview stats row ──────────────────────────────── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px',
        marginBottom: '20px',
      }}>
        <StatPill label="Total Zones" value={String(stats.total)} color="#2db8b0" />
        <StatPill label="Critical / High" value={String(stats.critHigh)} color={stats.critHigh > 0 ? '#ef4444' : '#22c55e'} />
        <StatPill label="Peak Congestion" value={`${stats.peakIntensity.toFixed(0)}%`} color={bandFor(stats.peakIntensity).color} />
        <StatPill label="Bottlenecks" value={String(stats.totalBn)} color={stats.totalBn > 0 ? '#f97316' : '#22c55e'} />
      </div>

      {/* ── Top problem areas ───────────────────────────────── */}
      <div style={{
        border: '1px solid var(--border)', borderRadius: '12px',
        overflow: 'hidden', marginBottom: '16px',
      }}>
        {/* Table header */}
        <div style={{
          display: 'grid', gridTemplateColumns: '2fr 1fr 80px 80px',
          padding: '10px 16px', background: 'var(--bg-subtle)',
          borderBottom: '1px solid var(--border)',
          fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em',
          color: 'var(--text-secondary)', textTransform: 'uppercase',
        }}>
          <span>Zone</span>
          <span>Risk</span>
          <span style={{ textAlign: 'right' }}>Intensity</span>
          <span style={{ textAlign: 'right' }}>Bottlenecks</span>
        </div>

        {/* Rows */}
        {displayList.map((zone, i) => {
          const band = bandFor(zone.intensity)
          const riskColor = RISK_COLORS[zone.riskLevel] ?? '#22c55e'
          const isExpanded = expandedZone === zone.zoneName + i
          const zoneKey = zone.zoneName + i

          return (
            <div key={zoneKey}>
              {/* Row */}
              <div
                onClick={() => setExpandedZone(isExpanded ? null : zoneKey)}
                style={{
                  display: 'grid', gridTemplateColumns: '2fr 1fr 80px 80px',
                  padding: '12px 16px',
                  borderBottom: '1px solid #f1f5f9',
                  cursor: 'pointer',
                  background: isExpanded ? `${band.color}08` : '#ffffff',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background = '#fafbfd' }}
                onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.background = '#ffffff' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '4px', height: '24px', borderRadius: '2px',
                    background: band.color,
                  }} />
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {zone.zoneName}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                      {friendlyType(zone.zoneName)}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{
                    display: 'inline-block', padding: '2px 10px', borderRadius: '999px',
                    background: `${riskColor}14`, color: riskColor,
                    fontSize: '10px', fontWeight: 700, letterSpacing: '0.04em',
                  }}>
                    {zone.riskLevel}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                  <div style={{
                    width: '36px', height: '6px', borderRadius: '3px',
                    background: 'var(--bg-inset)', overflow: 'hidden',
                  }}>
                    <div style={{
                      height: '100%', width: `${Math.min(100, zone.intensity)}%`,
                      background: band.color, borderRadius: '3px',
                    }} />
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: band.color, minWidth: '32px', textAlign: 'right' }}>
                    {zone.intensity.toFixed(0)}%
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                  <span style={{
                    fontSize: '12px', fontWeight: 600,
                    color: zone.bottleneckCount > 0 ? '#ef4444' : '#22c55e',
                  }}>
                    {zone.bottleneckCount}
                  </span>
                </div>
              </div>

              {/* Expanded detail panel */}
              {isExpanded && (
                <div style={{
                  padding: '14px 20px 14px 40px',
                  background: `${band.color}06`,
                  borderBottom: `1px solid ${band.color}22`,
                  animation: 'zoneDetailSlide 0.2s ease-out',
                }}>
                  <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginBottom: '10px' }}>
                    <DetailItem label="Zone type" value={friendlyType(zone.zoneName)} />
                    <DetailItem label="Peak agents" value={`${zone.agentCount} people`} />
                    <DetailItem label="Bottleneck events" value={String(zone.bottleneckCount)} />
                    <DetailItem label="Risk level" value={zone.riskLevel} color={riskColor} />
                  </div>
                  <p style={{
                    margin: 0, fontSize: '12px', color: '#475569',
                    lineHeight: 1.5, fontStyle: 'italic',
                    padding: '8px 12px',
                    background: 'var(--bg-card)',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                  }}>
                    {actionSentence(zone)}
                  </p>
                </div>
              )}
            </div>
          )
        })}

        {/* Show all toggle */}
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
          border: '1px solid rgba(45,184,176,0.15)',
          borderRadius: '12px',
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

      {/* Animation keyframes */}
      <style>{`
        @keyframes zoneDetailSlide {
          from { opacity: 0; max-height: 0; }
          to   { opacity: 1; max-height: 200px; }
        }
      `}</style>
    </div>
  )
}

/* ── Sub-components ────────────────────────────────────────────────── */

function StatPill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      padding: '12px 14px',
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: '10px',
    }}>
      <div style={{
        fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em',
        color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px',
      }}>
        {label}
      </div>
      <div style={{
        fontSize: '20px', fontWeight: 800, color,
        letterSpacing: '-0.02em', lineHeight: 1,
        fontFeatureSettings: '"tnum"',
      }}>
        {value}
      </div>
    </div>
  )
}

function DetailItem({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '2px' }}>
        {label}
      </div>
      <div style={{ fontSize: '13px', fontWeight: 600, color: color ?? '#0f172a' }}>
        {value}
      </div>
    </div>
  )
}
