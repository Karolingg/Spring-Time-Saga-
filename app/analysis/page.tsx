'use client'

import { useEffect } from 'react'
import { useAuth } from '@/src/hooks/useAuth'

const CARD_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
  padding: '24px 26px',
  borderRadius: '16px',
  border: '1px solid var(--border)',
  background: '#ffffff',
  boxShadow: '0 6px 24px rgba(15, 23, 42, 0.08)',
  textDecoration: 'none',
}

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

  if (!isAuthenticated) {
    return null
  }

  return (
    <div style={{ minHeight: '100vh', padding: '88px 40px 56px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
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
          <h1 style={{ margin: 0, fontSize: '26px', fontWeight: '700', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Analysis
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
            Pick a view to explore individual runs or the overall summary.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '18px', marginTop: '18px' }}>
        <a href="/analysis/runs" style={CARD_STYLE}>
          <div style={{ fontSize: '12px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#2db8b0' }}>
            Individual runs
          </div>
          <div style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a' }}>Run analysis</div>
          <div style={{ fontSize: '13px', color: '#64748b', lineHeight: 1.6 }}>
            Inspect heatmaps, bottlenecks, and outcomes for a single simulation run.
          </div>
          <div style={{ marginTop: '6px', fontSize: '13px', fontWeight: '600', color: '#2db8b0' }}>
            Open run analysis
          </div>
        </a>

        <a href="/analysis/summary" style={CARD_STYLE}>
          <div style={{ fontSize: '12px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#2db8b0' }}>
            Summary
          </div>
          <div style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a' }}>Aggregate insights</div>
          <div style={{ fontSize: '13px', color: '#64748b', lineHeight: 1.6 }}>
            Review overall congestion trends and risk levels across all runs.
          </div>
          <div style={{ marginTop: '6px', fontSize: '13px', fontWeight: '600', color: '#2db8b0' }}>
            Open summary view
          </div>
        </a>

        <a href="/analysis/compare" style={CARD_STYLE}>
          <div style={{ fontSize: '12px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#2db8b0' }}>
            Comparison
          </div>
          <div style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a' }}>Side-by-side drills</div>
          <div style={{ fontSize: '13px', color: '#64748b', lineHeight: 1.6 }}>
            Pick two completed runs and see which KPIs improved or regressed between them.
          </div>
          <div style={{ marginTop: '6px', fontSize: '13px', fontWeight: '600', color: '#2db8b0' }}>
            Open comparison view
          </div>
        </a>
      </div>
    </div>
  )
}
