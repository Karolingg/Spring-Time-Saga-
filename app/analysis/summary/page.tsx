'use client'

import { useEffect } from 'react'
import { useAuth } from '@/src/hooks/useAuth'
import { AggregateAnalysis } from '@/components/analysis/AggregateAnalysis'
import { AggregateFloorHeatmaps } from '@/components/analysis/AggregateFloorHeatmaps'

export default function AnalysisSummaryPage() {
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
    <div style={{ minHeight: '100vh', padding: '88px 40px 56px', maxWidth: '1280px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '28px', flexWrap: 'wrap' }}>
        <div style={{
          width: '44px', height: '44px', borderRadius: '12px',
          background: 'rgba(45,184,176,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2db8b0" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3v18h18"/><path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"/>
          </svg>
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: '26px', fontWeight: '700', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Summary Analysis
          </h1>
          <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>
            Aggregate congestion trends and risk levels across all completed runs.
          </p>
        </div>
        <a href="/analysis/runs" style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          padding: '8px 14px', background: '#ffffff', color: '#0f172a',
          borderRadius: '8px', textDecoration: 'none', fontSize: '13px', fontWeight: '600',
          border: '1px solid var(--border)', flexShrink: 0,
        }}>
          View Runs
        </a>
      </div>

      <AggregateFloorHeatmaps />
      <AggregateAnalysis />
    </div>
  )
}
