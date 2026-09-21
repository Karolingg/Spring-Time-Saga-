'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useRequireAuth } from '@/src/hooks/useRequireAuth'
import { getSimulationHistory } from '@/src/services/simulation.service'
import { PageHeader } from '@/components/ui/PageHeader'
import { PageLoading } from '@/components/ui/PageLoading'
import { ACCENT } from '@/src/config/theme'
import { relativeTime } from '@/src/utils/format'

interface FeatureButtonProps {
  href: string
  category: string
  title: string
  description: string
  cta: string
  accent: string
  icon: ReactNode
}

interface HubStats {
  runCount: number
  lastDrill: string
  bestEvacTime: number | null
}


export default function AnalysisPage() {
  const { isAuthenticated, isLoading: isAuthLoading } = useRequireAuth()
  const [hubStats, setHubStats] = useState<HubStats | null>(null)


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
      <PageLoading />
    )
  }

  if (!isAuthenticated) {
    return null
  }

  return (
    <div data-page-shell style={{ minHeight: '100vh', padding: '88px 40px 56px', maxWidth: '900px', margin: '0 auto' }}>
      {/* ── Page header ──────────────────────────────────────── */}
      <PageHeader
        icon={
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3v18h18"/><path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"/>
          </svg>
        }
        title="Analysis"
        subtitle="Pick a view to explore individual runs or the overall summary."
        style={{ marginBottom: '16px' }}
      />

      {/* ── Live stats strip — renders only once run data exists ───── */}
      {hubStats && (
        <div style={{
          display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '12px',
          marginTop: '20px', padding: '12px 18px',
          background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px',
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
          accent={ACCENT}
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M9 3v18M15 3v18M3 9h18M3 15h18" />
            </svg>
          }
        />

        <FeatureButton
          href="/analysis/summary"
          category="Summary"
          title="Aggregate insights"
          description="Review overall congestion trends and risk levels across all runs."
          cta="Open summary view"
          accent={ACCENT}
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3v18h18" />
              <polyline points="7 13 11 9 14 12 19 6" />
              <polyline points="15 6 19 6 19 10" />
            </svg>
          }
        />

        <FeatureButton
          href="/analysis/compare"
          category="Comparison"
          title="Side-by-side drills"
          description="Pick two completed runs and see which KPIs improved or regressed between them."
          cta="Open comparison view"
          accent={ACCENT}
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h6" /><path d="M3 12h6" /><path d="M3 18h6" />
              <path d="M15 6h6" /><path d="M15 12h6" /><path d="M15 18h6" />
            </svg>
          }
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
  accent,
  icon,
}: FeatureButtonProps) {
  return (
    <a
      href={href}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 'var(--space-4)',
        padding: '22px 26px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        textDecoration: 'none',
        boxShadow: '0 4px 18px rgba(15, 23, 42, 0.05), 0 1px 3px rgba(15, 23, 42, 0.04)',
        transition: 'transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease',
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)'
        e.currentTarget.style.borderColor = accent
        e.currentTarget.style.boxShadow = `0 10px 28px ${accent}29, 0 2px 6px rgba(15, 23, 42, 0.06)`
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.borderColor = 'var(--border)'
        e.currentTarget.style.boxShadow = '0 4px 18px rgba(15, 23, 42, 0.05), 0 1px 3px rgba(15, 23, 42, 0.04)'
      }}
    >
      <div style={{
        width: '44px', height: '44px', borderRadius: 'var(--radius)',
        background: `${accent}16`, color: accent,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        {icon}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0 }}>
        <div style={{
          fontSize: 'var(--text-xs)',
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: accent,
        }}>
          {category}
        </div>
        <div style={{
          fontSize: 'var(--text-xl)',
          fontWeight: 700,
          color: 'var(--text-primary)',
          letterSpacing: '-0.01em',
        }}>
          {title}
        </div>
        <div style={{
          fontSize: 'var(--text-base)',
          color: 'var(--text-secondary)',
          lineHeight: 1.6,
        }}>
          {description}
        </div>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          marginTop: '4px',
          fontSize: 'var(--text-base)',
          fontWeight: 600,
          color: accent,
        }}>
          {cta}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </div>
      </div>
    </a>
  )
}
