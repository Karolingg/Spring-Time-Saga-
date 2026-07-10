'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/src/hooks/useAuth'
import { getSimulationHistory } from '@/src/services/simulation.service'

interface FeatureButtonProps {
  href: string
  category: string
  title: string
  description: string
  cta: string
}

/* Uniform brand accent for all three feature buttons. */
const ACCENT = '#2db8b0'

interface HubStats {
  runCount: number
  lastDrill: string
  bestEvacTime: number | null
}

/** Compact relative-time label, e.g. "2h ago". */
function relativeTime(dateStr: string): string {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

export default function AnalysisPage() {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth()
  const [hubStats, setHubStats] = useState<HubStats | null>(null)

  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      window.location.href = '/auth'
    }
  }, [isAuthLoading, isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated) return
    let cancelled = false
    getSimulationHistory(100)
      .then((runs) => {
        if (cancelled || runs.length === 0) return
        const times = runs
          .map((r) => r.results?.evacuationTime)
          .filter((t): t is number => typeof t === 'number')
        setHubStats({
          runCount: runs.length,
          lastDrill: relativeTime(runs[0].createdAt),
          bestEvacTime: times.length > 0 ? Math.min(...times) : null,
        })
      })
      .catch(() => { /* strip stays hidden — non-critical */ })
    return () => { cancelled = true }
  }, [isAuthenticated])

  if (isAuthLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div style={{ color: 'var(--text-secondary)', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}><span className="spinner" />Loading...</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  return (
    <div data-page-shell style={{ minHeight: '100vh', padding: '88px 40px 56px', maxWidth: '900px', margin: '0 auto' }}>
      {/* ── Page header ──────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
        <div style={{
          width: '44px', height: '44px', borderRadius: '12px',
          background: 'rgba(45,184,176,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

      {/* ── Live stats strip — renders only once run data exists ───── */}
      {hubStats && (
        <div style={{
          display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '12px',
          marginTop: '20px', padding: '12px 18px',
          background: '#ffffff', border: '1px solid var(--border)', borderRadius: '12px',
          boxShadow: '0 4px 18px rgba(15, 23, 42, 0.05), 0 1px 3px rgba(15, 23, 42, 0.04)',
          fontSize: '13px', color: 'var(--text-secondary)',
        }}>
          <span>
            <strong style={{ color: ACCENT, fontWeight: 700 }}>{hubStats.runCount}</strong>
            {' '}{hubStats.runCount === 1 ? 'run' : 'runs'} completed
          </span>
          <StripDot />
          <span>
            Last drill <strong style={{ color: ACCENT, fontWeight: 700 }}>{hubStats.lastDrill}</strong>
          </span>
          {hubStats.bestEvacTime != null && (
            <>
              <StripDot />
              <span>
                Best evac time{' '}
                <strong style={{ color: ACCENT, fontWeight: 700 }}>{hubStats.bestEvacTime.toFixed(1)}s</strong>
              </span>
            </>
          )}
        </div>
      )}

      {/* ── Stacked feature buttons ─────────────────────────── */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        marginTop: '28px',
      }}>
        <FeatureButton
          href="/analysis/runs"
          category="Individual Runs"
          title="Run analysis"
          description="Inspect heatmaps, bottlenecks, and outcomes for a single simulation run."
          cta="Open run analysis"
        />

        <FeatureButton
          href="/analysis/summary"
          category="Summary"
          title="Aggregate insights"
          description="Review overall congestion trends and risk levels across all runs."
          cta="Open summary view"
        />

        <FeatureButton
          href="/analysis/compare"
          category="Comparison"
          title="Side-by-side drills"
          description="Pick two completed runs and see which KPIs improved or regressed between them."
          cta="Open comparison view"
        />
      </div>
    </div>
  )
}

/** Small separator dot for the live-stats strip. */
function StripDot() {
  return (
    <span style={{
      width: '4px', height: '4px', borderRadius: '50%',
      background: 'var(--border-strong)', flexShrink: 0,
    }} />
  )
}

function FeatureButton({
  href,
  category,
  title,
  description,
  cta,
}: FeatureButtonProps) {
  return (
    <a
      href={href}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        padding: '22px 26px',
        background: '#ffffff',
        border: '1px solid var(--border)',
        borderRadius: '14px',
        textDecoration: 'none',
        boxShadow: '0 4px 18px rgba(15, 23, 42, 0.05), 0 1px 3px rgba(15, 23, 42, 0.04)',
        transition: 'transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease',
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)'
        e.currentTarget.style.borderColor = ACCENT
        e.currentTarget.style.boxShadow = `0 10px 28px rgba(45, 184, 176, 0.16), 0 2px 6px rgba(15, 23, 42, 0.06)`
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.borderColor = 'var(--border)'
        e.currentTarget.style.boxShadow = '0 4px 18px rgba(15, 23, 42, 0.05), 0 1px 3px rgba(15, 23, 42, 0.04)'
      }}
    >
      <div style={{
        fontSize: '11px',
        fontWeight: 700,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color: ACCENT,
      }}>
        {category}
      </div>
      <div style={{
        fontSize: '20px',
        fontWeight: 700,
        color: '#0f172a',
        letterSpacing: '-0.01em',
      }}>
        {title}
      </div>
      <div style={{
        fontSize: '13px',
        color: '#64748b',
        lineHeight: 1.6,
      }}>
        {description}
      </div>
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        marginTop: '4px',
        fontSize: '13px',
        fontWeight: 600,
        color: ACCENT,
      }}>
        {cta}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="5" y1="12" x2="19" y2="12" />
          <polyline points="12 5 19 12 12 19" />
        </svg>
      </div>
    </a>
  )
}
