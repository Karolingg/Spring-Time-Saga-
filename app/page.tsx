'use client'

import { useEffect } from 'react'
import { useAuth } from '@/src/hooks/useAuth'

const STAT_CARDS = [
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2db8b0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
    label: 'TOTAL AGENTS',
    value: '120',
    sub: '120 configured',
    color: '#2db8b0',
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2db8b0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    ),
    label: 'EVACUATED',
    value: '0%',
    sub: '0 of 120',
    color: '#2db8b0',
    progress: 0,
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2db8b0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
      </svg>
    ),
    label: 'AVG STEPS',
    value: '0.0',
    sub: 'to evacuate',
    color: '#2db8b0',
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
    ),
    label: 'BOTTLENECKS',
    value: '0',
    sub: 'detected zones',
    color: '#f59e0b',
  },
]

const BUILDINGS = [
  'Science Hall', 'Library', 'Admin Building', 'Engineering',
  'Cafeteria', 'Lecture Hall', 'Research Center',
]

export default function DashboardPage() {
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

  return (
    <div style={{
      minHeight: '100vh',
      padding: '88px 40px 56px',
      maxWidth: '1280px',
      margin: '0 auto',
    }}>

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '32px', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '12px',
            background: 'rgba(45,184,176,0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2db8b0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '26px', fontWeight: '700', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Dashboard</h1>
            <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>Campus evacuation overview &amp; analytics</p>
          </div>
        </div>
        <a href="/simulate?disaster=fire" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 20px',
          background: '#2db8b0',
          color: '#ffffff',
          borderRadius: '8px',
          textDecoration: 'none',
          fontSize: '14px',
          fontWeight: '600',
          flexShrink: 0,
        }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
          </svg>
          Run Simulation
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
          </svg>
        </a>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        {STAT_CARDS.map((card, i) => (
          <div key={i} style={{
            background: '#ffffff',
            border: '1px solid var(--border)',
            borderRadius: '14px',
            padding: '24px 28px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              {card.icon}
              <span style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.08em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                {card.label}
              </span>
            </div>
            <div style={{ fontSize: '32px', fontWeight: '700', color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1 }}>
              {card.value}
            </div>
            {'progress' in card && (
              <div style={{ margin: '10px 0 4px', height: '4px', background: '#f1f5f9', borderRadius: '2px' }}>
                <div style={{ height: '100%', width: `${card.progress}%`, background: card.color, borderRadius: '2px' }} />
              </div>
            )}
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '6px' }}>{card.sub}</div>
          </div>
        ))}
      </div>

      {/* Recent Simulation table */}
      <div style={{
        background: '#ffffff',
        border: '1px solid var(--border)',
        borderRadius: '14px',
        padding: '28px 32px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        marginBottom: '24px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2db8b0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
          </svg>
          <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>Recent Simulation</span>
        </div>
        <p style={{ margin: '0 0 16px', fontSize: '12px', color: 'var(--text-secondary)' }}>Current session run data</p>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['RUN', 'AGENTS', 'EVACUATED', 'STEPS', 'STATUS'].map(col => (
                <th key={col} style={{
                  padding: '8px 12px',
                  textAlign: 'left',
                  fontSize: '11px',
                  fontWeight: '600',
                  letterSpacing: '0.06em',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                }}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ padding: '12px 12px', fontSize: '13px', color: 'var(--text-primary)' }}>Current Run</td>
              <td style={{ padding: '12px 12px', fontSize: '13px', color: 'var(--text-primary)' }}>120</td>
              <td style={{ padding: '12px 12px', fontSize: '13px', color: '#2db8b0', fontWeight: '600' }}>0</td>
              <td style={{ padding: '12px 12px', fontSize: '13px', color: 'var(--text-primary)' }}>0</td>
              <td style={{ padding: '12px 12px' }}>
                <span style={{
                  display: 'inline-block',
                  padding: '3px 10px',
                  borderRadius: '20px',
                  background: '#f1f5f9',
                  color: 'var(--text-secondary)',
                  fontSize: '11px',
                  fontWeight: '600',
                  letterSpacing: '0.04em',
                }}>NOT STARTED</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Quick Actions */}
      <div style={{
        background: '#ffffff',
        border: '1px solid var(--border)',
        borderRadius: '14px',
        padding: '28px 32px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        marginBottom: '24px',
      }}>
        <h2 style={{ margin: '0 0 14px', fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>Quick Actions</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
          {[
            { href: '/simulate?disaster=fire', label: 'Fire Simulation', sub: 'High urgency scenario', color: '#ff6b35', icon: '🔥' },
            { href: '/simulate?disaster=earthquake', label: 'Earthquake Simulation', sub: 'Dynamic obstacles scenario', color: '#f59e0b', icon: '🌎' },
            { href: '/analysis', label: 'Heatmap Analysis', sub: 'Density analysis', color: '#2db8b0', icon: '📊' },
          ].map(item => (
            <a key={item.href} href={item.href} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              padding: '12px 14px',
              background: '#f8fafc',
              borderRadius: '8px',
              textDecoration: 'none',
              transition: 'background 0.15s',
            }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: `${item.color}18`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px',
                flexShrink: 0,
              }}>
                {item.icon}
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>{item.label}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{item.sub}</div>
              </div>
            </a>
          ))}
        </div>
      </div>

      {/* Campus Safety Overview */}
      <div style={{
        background: '#ffffff',
        border: '1px solid var(--border)',
        borderRadius: '14px',
        padding: '28px 32px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2db8b0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
          </svg>
          <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>Campus Safety Overview</span>
        </div>
        <p style={{ margin: '0 0 16px', fontSize: '12px', color: 'var(--text-secondary)' }}>Building-level risk assessment based on simulation data</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
          {BUILDINGS.map(building => (
            <div key={building} style={{
              background: '#f8fafc',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '12px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
                  <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                </svg>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)' }}>{building}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>1 exit</div>
                </div>
              </div>
              <span style={{
                fontSize: '10px',
                fontWeight: '700',
                padding: '3px 8px',
                borderRadius: '20px',
                background: 'rgba(45,184,176,0.1)',
                color: '#2db8b0',
                letterSpacing: '0.04em',
              }}>LOW</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
