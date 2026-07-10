'use client'

import { useEffect } from 'react'
import { useAuth } from '@/src/hooks/useAuth'

const sectionTitle: React.CSSProperties = {
  margin: '0 0 4px',
  fontSize: '16px',
  fontWeight: '600',
  color: 'var(--text-primary)',
}

const sectionDesc: React.CSSProperties = {
  margin: '0 0 24px',
  fontSize: '13px',
  color: 'var(--text-secondary)',
}

const divider: React.CSSProperties = {
  border: 'none',
  borderTop: '1px solid var(--border)',
  margin: '24px 0',
}

export default function AboutPage() {
  const { isAuthenticated, isLoading } = useAuth()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      window.location.href = '/auth'
    }
  }, [isLoading, isAuthenticated])

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <span style={{ color: 'var(--text-secondary)', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}><span className="spinner" />Loading...</span>
      </div>
    )
  }

  if (!isAuthenticated) return null

  const rows = [
    { label: 'Version', value: '1.0.0-beta' },
    { label: 'Campus', value: 'University of the Philippines Cebu' },
    { label: 'Framework', value: 'Next.js 16 + React 19' },
    { label: 'Database', value: 'Supabase (PostgreSQL)' },
    { label: 'Map Provider', value: 'Mapbox GL JS' },
  ]

  const features = [
    'Interactive campus map with 3D building visualization',
    'Agent-based pathfinding with exit selection and rerouting',
    'Fire and earthquake disaster scenario modeling',
    'Real-time simulation metrics and drill evaluation',
    'Campus readiness scoring and analytics dashboard',
  ]

  return (
    <div style={{ minHeight: '100vh', padding: '88px 40px 56px', maxWidth: '860px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '24px' }}>
        <div style={{
          width: '44px',
          height: '44px',
          borderRadius: '12px',
          background: 'rgba(45,184,176,0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2db8b0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
        </div>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: '22px', fontWeight: '700', color: 'var(--text-primary)' }}>About</h1>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>System information and project details</p>
        </div>
      </div>

      <div style={{
        background: '#fff',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '28px 32px',
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
      }}>
        <h2 style={sectionTitle}>About EVACSIM</h2>
        <p style={sectionDesc}>System information and project details.</p>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          padding: '20px',
          background: 'linear-gradient(135deg, rgba(45,184,176,0.08) 0%, rgba(45,184,176,0.02) 100%)',
          borderRadius: '12px',
          border: '1px solid rgba(45,184,176,0.15)',
          marginBottom: '24px',
        }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', flexShrink: 0, background: '#2db8b0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)' }}>EVACSIM</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>Agent-Based Crowd Evacuation Simulator</div>
          </div>
        </div>

        <div>
          {rows.map((row, index) => (
            <div key={row.label}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', gap: '16px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{row.label}</span>
                <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)', textAlign: 'right' }}>{row.value}</span>
              </div>
              {index < rows.length - 1 && <hr style={{ ...divider, margin: '0' }} />}
            </div>
          ))}
        </div>

        <hr style={divider} />

        <h3 style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>
          Project Description
        </h3>
        <p style={{ margin: '0 0 16px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
          EVACSIM is an agent-based crowd evacuation simulator designed for the University of the Philippines Cebu campus.
          It enables administrators to model disaster scenarios, simulate crowd evacuation behavior across campus buildings,
          and evaluate emergency preparedness through data-driven analysis.
        </p>

        <h3 style={{ margin: '0 0 10px', fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>
          Key Features
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
          {features.map(feature => (
            <div key={feature} style={{ padding: '8px 12px', background: '#f8fafc', borderRadius: '8px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
              {feature}
            </div>
          ))}
        </div>

        <div style={{ padding: '14px 16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', lineHeight: '1.6' }}>
          Built for academic research at UP Cebu.
          <br />
          For questions or feedback, contact your system administrator.
        </div>
      </div>
    </div>
  )
}
