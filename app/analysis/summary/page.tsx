'use client'

import { useEffect } from 'react'
import { useAuth } from '@/src/hooks/useAuth'
import { AggregateAnalysis } from '@/components/analysis/AggregateAnalysis'
import { AggregateFloorHeatmaps } from '@/components/analysis/AggregateFloorHeatmaps'
import { FeatureContainer } from '@/components/analysis/FeatureContainer'

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
        <div style={{ display: 'flex', gap: '8px' }}>
          <a href="/analysis" style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '8px 14px', background: '#ffffff', color: '#0f172a',
            borderRadius: '8px', textDecoration: 'none', fontSize: '13px', fontWeight: '600',
            border: '1px solid var(--border)', flexShrink: 0,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back
          </a>
          <a href="/analysis/runs" style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '8px 14px', background: '#ffffff', color: '#0f172a',
            borderRadius: '8px', textDecoration: 'none', fontSize: '13px', fontWeight: '600',
            border: '1px solid var(--border)', flexShrink: 0,
          }}>
            View Runs
          </a>
        </div>
      </div>

      {/* ── Layer 1: Aggregate Floor Heatmaps ───────────────── */}
      <FeatureContainer
        title="Aggregate Floor Heatmaps"
        subtitle="Combined density patterns across every completed run, per floor"
        accent="#2db8b0"
        badge="Layer 1"
        icon={
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M9 3v18M15 3v18M3 9h18M3 15h18" />
          </svg>
        }
      >
        <AggregateFloorHeatmaps />
      </FeatureContainer>

      {/* ── Layer 2: Aggregate Zone Trends ──────────────────── */}
      <FeatureContainer
        title="Aggregate Zone Trends"
        subtitle="Cross-run zone intensity, peak congestion, and bottleneck patterns"
        accent="#2db8b0"
        badge="Layer 2"
        icon={
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3v18h18" />
            <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" />
          </svg>
        }
      >
        <AggregateAnalysis hideHeader />
      </FeatureContainer>
    </div>
  )
}
