'use client'

import { useEffect, useState } from 'react'
import { getAggregateZoneStats } from '@/src/services/simulation.service'
import type { RiskLevel } from '@/src/schema/enums'

interface AggregateZoneStat {
  zoneName: string
  avgIntensity: number
  avgAgentCount: number
  totalBottlenecks: number
  dominantRiskLevel: RiskLevel
}

const RISK_COLORS: Record<string, string> = {
  HIGH: '#ef4444',
  MEDIUM: '#f59e0b',
  LOW: '#22c55e',
}

function getIntensityColor(intensity: number): string {
  if (intensity >= 75) return '#ef4444'
  if (intensity >= 55) return '#f97316'
  if (intensity >= 35) return '#f59e0b'
  return '#22c55e'
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

  if (isLoading) {
    return (
      <div style={{ ...SECTION_CARD, textAlign: 'center', padding: '40px' }}>
        <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Loading aggregate data...</div>
      </div>
    )
  }

  const visibleZones = zones.filter((zone) => (
    zone.avgIntensity > 0 || zone.avgAgentCount > 0 || zone.totalBottlenecks > 0
  ))

  if (visibleZones.length === 0) {
    return (
      <div style={{ ...SECTION_CARD, textAlign: 'center', padding: '40px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#2db8b0" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3v18h18" />
            <path d="M7 15l3-3 3 2 4-6" />
            <circle cx="7" cy="15" r="1" fill="#2db8b0" />
            <circle cx="10" cy="12" r="1" fill="#2db8b0" />
            <circle cx="13" cy="14" r="1" fill="#2db8b0" />
            <circle cx="17" cy="8" r="1" fill="#2db8b0" />
          </svg>
        </div>
        <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>
          No completed simulations yet — run some simulations to see aggregate statistics.
        </p>
      </div>
    )
  }

  return (
    <>
      {/* Aggregate Congestion Heatmap */}
      <div style={SECTION_CARD}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2db8b0" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3v18h18"/><path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"/>
          </svg>
          <span style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.1em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Aggregate Congestion — All Runs
          </span>
        </div>
        <p style={{ margin: '0 0 16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
          Average congestion intensity per zone across all completed simulations
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {visibleZones.map((zone, i) => {
            const color = getIntensityColor(zone.avgIntensity)
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)', minWidth: '140px' }}>{zone.zoneName}</span>
                <div style={{ flex: 1, height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: `${zone.avgIntensity}%`,
                    background: color, borderRadius: '4px', transition: 'width 0.6s ease',
                  }} />
                </div>
                <span style={{ fontSize: '12px', fontWeight: '600', color, minWidth: '36px', textAlign: 'right' }}>
                  {zone.avgIntensity.toFixed(0)}%
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Aggregate Risk Table */}
      <div style={SECTION_CARD}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2db8b0" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
          </svg>
          <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>Zone Risk Summary — All Runs</span>
        </div>
        <p style={{ margin: '0 0 16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
          Cumulative risk statistics across all completed simulation runs
        </p>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Zone', 'Dominant Risk', 'Avg Agents', 'Total Bottlenecks', 'Avg Intensity'].map(col => (
                <th key={col} style={{
                  padding: '8px 12px', textAlign: 'left', fontSize: '11px',
                  fontWeight: '600', letterSpacing: '0.06em',
                  color: 'var(--text-muted)', textTransform: 'uppercase' as const,
                }}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleZones.map((zone, i) => {
              const riskColor = RISK_COLORS[zone.dominantRiskLevel] ?? '#22c55e'
              return (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px', fontSize: '13px', color: 'var(--text-primary)', fontWeight: '500' }}>{zone.zoneName}</td>
                  <td style={{ padding: '12px' }}>
                    <span style={{
                      display: 'inline-block', padding: '3px 10px', borderRadius: '20px',
                      background: `${riskColor}18`, color: riskColor,
                      fontSize: '11px', fontWeight: '700', letterSpacing: '0.04em',
                    }}>{zone.dominantRiskLevel}</span>
                  </td>
                  <td style={{ padding: '12px', fontSize: '13px', color: 'var(--text-primary)' }}>{zone.avgAgentCount}</td>
                  <td style={{ padding: '12px', fontSize: '13px', color: zone.totalBottlenecks > 0 ? '#ef4444' : '#22c55e', fontWeight: '600' }}>
                    {zone.totalBottlenecks}
                  </td>
                  <td style={{ padding: '12px', fontSize: '13px', color: getIntensityColor(zone.avgIntensity), fontWeight: '600' }}>
                    {zone.avgIntensity.toFixed(1)}%
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
