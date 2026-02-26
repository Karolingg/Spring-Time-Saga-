'use client'

import { useEffect } from 'react'
import { useAuth } from '@/src/hooks/useAuth'

const HEATMAP_ZONES = [
  { label: 'Main Entrance', intensity: 85, color: '#ef4444' },
  { label: 'Stairwell A', intensity: 72, color: '#f97316' },
  { label: 'Corridor B2', intensity: 58, color: '#f59e0b' },
  { label: 'Exit 3 (East)', intensity: 44, color: '#eab308' },
  { label: 'Cafeteria Door', intensity: 31, color: '#84cc16' },
  { label: 'Side Exit', intensity: 18, color: '#22c55e' },
]

const CONGESTION_DATA = [
  { building: 'Science Hall', risk: 'HIGH', agents: 45, bottlenecks: 3, color: '#ef4444' },
  { building: 'Library', risk: 'MEDIUM', agents: 30, bottlenecks: 1, color: '#f59e0b' },
  { building: 'Admin Building', risk: 'LOW', agents: 20, bottlenecks: 0, color: '#22c55e' },
  { building: 'Engineering', risk: 'MEDIUM', agents: 25, bottlenecks: 2, color: '#f59e0b' },
]

export default function AnalysisPage() {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth()

  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      window.location.href = '/auth'
    }
  }, [isAuthLoading, isAuthenticated])

  if (isAuthLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Loading...</div>
      </div>
    )
  }

  const sectionCard = {
    background: '#ffffff',
    border: '1px solid var(--border)',
    borderRadius: '14px',
    padding: '28px 32px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    marginBottom: '20px',
  } as React.CSSProperties

  return (
    <div style={{ minHeight: '100vh', padding: '88px 40px 56px', maxWidth: '1280px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '32px' }}>
        <div style={{
          width: '44px', height: '44px', borderRadius: '12px',
          background: 'rgba(45,184,176,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2db8b0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3v18h18"/><path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"/>
          </svg>
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: '26px', fontWeight: '700', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Heatmap Analysis</h1>
          <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>Congestion density and bottleneck identification</p>
        </div>
      </div>

      {/* Two-column: heatmap + building risk */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>

      {/* Congestion Heatmap */}
      <div style={{ ...sectionCard, marginBottom: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2db8b0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
          </svg>
          <span style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.1em', color: 'var(--text-muted)', textTransform: 'uppercase' as const }}>Congestion Zones</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {HEATMAP_ZONES.map((zone, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)', minWidth: '140px' }}>{zone.label}</span>
              <div style={{ flex: 1, height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${zone.intensity}%`,
                  background: zone.color,
                  borderRadius: '4px',
                  transition: 'width 0.6s ease',
                }} />
              </div>
              <span style={{ fontSize: '12px', fontWeight: '600', color: zone.color, minWidth: '36px', textAlign: 'right' }}>
                {zone.intensity}%
              </span>
            </div>
          ))}
        </div>
        {/* Legend */}
        <div style={{ display: 'flex', gap: '16px', marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
          {[
            { label: 'Critical', color: '#ef4444' },
            { label: 'High', color: '#f97316' },
            { label: 'Medium', color: '#f59e0b' },
            { label: 'Low', color: '#22c55e' },
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: item.color }} />
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Building Risk Table */}
      <div style={{ ...sectionCard, marginBottom: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2db8b0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
          </svg>
          <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>Building Risk Assessment</span>
        </div>
        <p style={{ margin: '0 0 16px', fontSize: '12px', color: 'var(--text-secondary)' }}>Based on latest simulation run</p>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Building', 'Risk', 'Agents', 'Bottlenecks'].map(col => (
                <th key={col} style={{
                  padding: '8px 12px',
                  textAlign: 'left',
                  fontSize: '11px',
                  fontWeight: '600',
                  letterSpacing: '0.06em',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase' as const,
                }}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CONGESTION_DATA.map((row, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '12px 12px', fontSize: '13px', color: 'var(--text-primary)', fontWeight: '500' }}>{row.building}</td>
                <td style={{ padding: '12px 12px' }}>
                  <span style={{
                    display: 'inline-block',
                    padding: '3px 10px',
                    borderRadius: '20px',
                    background: `${row.color}18`,
                    color: row.color,
                    fontSize: '11px',
                    fontWeight: '700',
                    letterSpacing: '0.04em',
                  }}>{row.risk}</span>
                </td>
                <td style={{ padding: '12px 12px', fontSize: '13px', color: 'var(--text-primary)' }}>{row.agents}</td>
                <td style={{ padding: '12px 12px', fontSize: '13px', color: row.bottlenecks > 0 ? '#ef4444' : '#22c55e', fontWeight: '600' }}>{row.bottlenecks}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      </div>{/* end two-column grid */}

      {/* Summary Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        {[
          { label: 'Total Zones Analyzed', value: '6', icon: '🗺' },
          { label: 'Critical Bottlenecks', value: '2', icon: '⚠️' },
          { label: 'Avg Evacuation Time', value: '—', icon: '⏱' },
        ].map((stat, i) => (
          <div key={i} style={{
            background: '#ffffff',
            border: '1px solid var(--border)',
            borderRadius: '14px',
            padding: '28px 24px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '28px', marginBottom: '8px' }}>{stat.icon}</div>
            <div style={{ fontSize: '28px', fontWeight: '700', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{stat.value}</div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>{stat.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
