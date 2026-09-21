'use client'

import { useEffect, useState } from 'react'
import { useRequireAuth } from '@/src/hooks/useRequireAuth'
import { useIsMobile } from '@/src/hooks/useIsMobile'
import { useOnboarding } from '@/src/hooks/useOnboarding'
import {
  getSimulationHistory,
  getAggregateSimulationStats,
  getDashboardBuildingCoverage,
} from '@/src/services/simulation.service'
import { getBuildingScore } from '@/src/services/building-analytics.service'
import { getBuildingTotalCapacity } from '@/src/config/building-floor-occupancy'
import { BUILDING_FLOOR_COUNT } from '@/src/config/building-floor-counts'
import { getUserProfile } from '@/src/services/user.service'
import { OnboardingOverlay } from '@/components/Onboarding/OnboardingOverlay'
import { InfoTooltip } from '@/components/InfoTooltip'
import { Card } from '@/components/ui/Card'
import { StatCard } from '@/components/ui/StatCard'
import type { StatCardProps } from '@/components/ui/StatCard'
import type { SimulationRun } from '@/src/schema/simulation.types'
import { PageLoading } from '@/components/ui/PageLoading'
import { relativeTime } from '@/src/utils/format'
import { trendColor, trendTint, type BetterWhen } from '@/src/utils/trend'
import { ACCENT } from '@/src/config/theme'

interface AggregateStats {
  totalRuns: number
  avgEvacuationRate: number
  totalAgentsSimulated: number
  avgBottlenecksPerRun: number
  avgEvacuationTime: number
}

interface BuildingCoverage {
  totalBuildings: number
  coveredBuildings: number
  pendingBuildings: number
  coveredBuildingNames: string[]
}


function computeReadiness(stats: AggregateStats | null): number {
  if (!stats || stats.totalRuns === 0) return 0
  const evacScore = Math.min(stats.avgEvacuationRate, 100) * 0.4
  const bottleneckScore = Math.max(0, 100 - stats.avgBottlenecksPerRun * 20) * 0.3
  const timeScore = Math.max(0, 100 - stats.avgEvacuationTime * 2) * 0.3
  return Math.round(Math.max(0, Math.min(100, evacScore + bottleneckScore + timeScore)))
}

/**
 * `color` is the vivid hue for the gauge ring (a graphic); `textColor` is the
 * contrast-safe variant for the label, since the vivid hues only reach
 * ~2.2-3.8:1 as text on a white card.
 */
function readinessLabel(score: number): { text: string; color: string; textColor: string } {
  if (score >= 80) return { text: 'Excellent', color: '#22c55e', textColor: 'var(--status-text-green)' }
  if (score >= 60) return { text: 'Good', color: ACCENT, textColor: 'var(--status-text-teal)' }
  if (score >= 40) return { text: 'Fair', color: '#f59e0b', textColor: 'var(--status-text-amber)' }
  if (score > 0)   return { text: 'Needs Work', color: '#ef4444', textColor: 'var(--status-text-red)' }
  return { text: 'No Data', color: '#94a3b8', textColor: 'var(--status-text-slate)' }
}

function nameFromEmail(email?: string | null): string {
  if (!email) return 'Operator'
  const local = email.split('@')[0]
  return local.charAt(0).toUpperCase() + local.slice(1)
}

function userName(displayName: string | null, metadata: Record<string, unknown> | null | undefined, email?: string | null): string {
  const profileName = displayName?.trim()
  if (profileName) return profileName

  const metadataFullName = typeof metadata?.full_name === 'string' ? metadata.full_name.trim() : ''
  if (metadataFullName) return metadataFullName

  const metadataName = typeof metadata?.name === 'string' ? metadata.name.trim() : ''
  if (metadataName) return metadataName

  return nameFromEmail(email)
}

export default function DashboardPage() {
  const isMobile = useIsMobile()
  const { user, isAuthenticated, isLoading: isAuthLoading } = useRequireAuth()
  const { resetOnboarding } = useOnboarding()
  const [stats, setStats] = useState<AggregateStats | null>(null)
  const [recentRuns, setRecentRuns] = useState<SimulationRun[]>([])
  const [buildingCoverage, setBuildingCoverage] = useState<BuildingCoverage | null>(null)
  const [isDashboardLoading, setIsDashboardLoading] = useState(true)
  const [campusReadiness, setCampusReadiness] = useState<number | null>(null)
  const [isCampusLoading, setIsCampusLoading] = useState(false)
  const [dashboardError, setDashboardError] = useState<string | null>(null)
  const [profileName, setProfileName] = useState<{ userId: string; displayName: string | null } | null>(null)


  useEffect(() => {
    if (!isAuthenticated) return
    let active = true

    async function loadData() {
      setIsDashboardLoading(true)
      setDashboardError(null)
      try {
        const [aggregate, history, coverage] = await Promise.all([
          getAggregateSimulationStats(),
          getSimulationHistory(10),
          getDashboardBuildingCoverage(),
        ])
        if (!active) return
        setStats(aggregate)
        setRecentRuns(history)
        setBuildingCoverage(coverage)
      } catch (err) {
        console.error('Failed to load dashboard data:', err)
        if (active) setDashboardError(err instanceof Error ? err.message : 'Unable to load dashboard data.')
      } finally {
        if (active) setIsDashboardLoading(false)
      }
    }
    loadData()

    return () => {
      active = false
    }
  }, [isAuthenticated])

  // Compute campus readiness by averaging per-building scores (weighted by capacity).
  useEffect(() => {
    if (!isAuthenticated) return
    let active = true
    setIsCampusLoading(true)
    setCampusReadiness(null)

    const buildingIds = Object.keys(BUILDING_FLOOR_COUNT)
    Promise.all(buildingIds.map(id => getBuildingScore(id, getBuildingTotalCapacity(id)).catch(() => null)))
      .then((scores) => {
        if (!active) return
        let weightedSum = 0
        let weightTotal = 0
        for (let i = 0; i < buildingIds.length; i++) {
          const id = buildingIds[i]
          const score = scores[i]
          const cap = getBuildingTotalCapacity(id)
          if (score && score.runCount > 0) {
            const w = cap > 0 ? cap : 1
            weightedSum += (score.score ?? 0) * w
            weightTotal += w
          }
        }
        if (weightTotal > 0) {
          setCampusReadiness(Math.round(weightedSum / weightTotal))
        } else {
          setCampusReadiness(null)
        }
      })
      .catch(err => {
        console.error('Failed to load building scores:', err)
        if (active) setCampusReadiness(null)
      })
      .finally(() => { if (active) setIsCampusLoading(false) })

    return () => { active = false }
  }, [isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated || !user?.id) return

    let active = true

    getUserProfile()
      .then(profile => {
        if (active) setProfileName({ userId: user.id, displayName: profile?.display_name ?? null })
      })
      .catch(err => {
        console.error('Failed to load user profile:', err)
        if (active) setProfileName({ userId: user.id, displayName: null })
      })

    return () => {
      active = false
    }
  }, [isAuthenticated, user?.id])

  if (isAuthLoading) {
    return (
      <PageLoading />
    )
  }

  const effectiveLoading = isDashboardLoading || isCampusLoading
  const readiness = (!isDashboardLoading && !isCampusLoading && campusReadiness !== null)
    ? campusReadiness
    : (isDashboardLoading ? 0 : computeReadiness(stats))
  const rl = effectiveLoading
    ? { text: 'Loading', color: '#94a3b8', textColor: 'var(--status-text-slate)' }
    : readinessLabel(readiness)
  const statCards = buildStatCards(stats, isDashboardLoading)
  const greeting = getGreeting()
  const displayName = profileName && profileName.userId === user?.id ? profileName.displayName : null
  const coverageTotal = buildingCoverage?.totalBuildings ?? 0
  const coverageCovered = buildingCoverage?.coveredBuildings ?? 0
  const coveragePending = buildingCoverage?.pendingBuildings ?? 0
  const coverageNames = buildingCoverage?.coveredBuildingNames ?? []

  return (
    <div data-page-shell style={{
      minHeight: '100vh',
      padding: isMobile ? '20px 14px 32px' : '88px 40px 56px',
      maxWidth: '1280px',
      margin: '0 auto',
    }}>

      {/* ── Welcome Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 'var(--space-8)', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: 'var(--text-3xl)', fontWeight: '700', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            {greeting}, {userName(displayName, user?.user_metadata, user?.email)}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            <p style={{ margin: 0, fontSize: 'var(--text-md)', color: 'var(--text-secondary)' }}>
              Campus evacuation overview &amp; drill analytics
            </p>
            {!isDashboardLoading && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                fontSize: 'var(--text-xs)', color: 'var(--text-muted)',
              }}>
                <span style={{
                  width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0,
                  background: recentRuns.length > 0 ? '#22c55e' : 'var(--border-strong)',
                  boxShadow: recentRuns.length > 0 ? '0 0 0 3px rgba(34,197,94,0.16)' : 'none',
                }} />
                {recentRuns.length > 0 ? `Last drill logged ${relativeTime(recentRuns[0].createdAt)}` : 'No drills logged yet'}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px', flexShrink: 0, flexWrap: 'wrap' }}>
          <button
            onClick={() => resetOnboarding()}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '10px 20px', background: 'var(--bg-inset)', color: 'var(--status-text-teal)',
              border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer',
              fontSize: '14px', fontWeight: '600', transition: 'all 0.2s ease-in-out',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--teal-light)'
              e.currentTarget.style.borderColor = ACCENT
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--bg-inset)'
              e.currentTarget.style.borderColor = 'var(--border)'
            }}
          >
            Tutorial
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="16" x2="12" y2="12"/>
              <line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
          </button>
          <a href="/map" className="hover-darken" style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '10px 20px', background: 'var(--teal-button)', color: '#fff',
            borderRadius: '8px', textDecoration: 'none', fontSize: '14px', fontWeight: '600', flexShrink: 0,
          }}>
            Run Simulation
          </a>
        </div>
      </div>

      {/* ── Readiness + Coverage row ── */}
      {dashboardError && (
        <Card padding="14px 16px" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          marginBottom: '24px',
          borderColor: 'rgba(239,68,68,0.35)',
          background: 'rgba(239,68,68,0.08)',
          color: 'var(--status-text-red)',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div style={{ fontSize: '13px', lineHeight: 1.5 }}>
            Dashboard data could not be loaded. {dashboardError}
          </div>
        </Card>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.3fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>

        {/* Campus Readiness Score */}
        <Card style={{
          display: 'flex', alignItems: 'center', gap: 'var(--space-7)',
          backgroundImage: 'radial-gradient(circle at 12% 8%, rgba(45,184,176,0.09) 0%, transparent 45%)',
        }}>
          {/* Circular progress ring, with a faint dashed outer ring echoing the
              hazard-radius rings drawn around fire/smoke in a live drill. */}
          <div style={{ position: 'relative', width: '112px', height: '112px', flexShrink: 0 }}>
            <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
              <circle cx="50" cy="50" r="48" fill="none" stroke={rl.color} strokeWidth="0.75" strokeDasharray="1.5 4" opacity="0.35" />
              <circle cx="50" cy="50" r="42" fill="none" stroke="var(--bg-inset)" strokeWidth="8" />
              <circle cx="50" cy="50" r="42" fill="none" stroke={rl.color} strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${readiness * 2.64} ${264 - readiness * 2.64}`}
                style={{ transition: 'stroke-dasharray 0.8s ease, stroke 0.3s ease' }} />
            </svg>
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: 'var(--text-2xl)', fontWeight: '700', color: 'var(--text-primary)', lineHeight: 1 }}>{readiness}</span>
              <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-secondary)', marginTop: '2px' }}>/ 100</span>
            </div>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: '6px' }}>
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: '600', letterSpacing: '0.08em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Campus Readiness
              </span>
              <InfoTooltip
                title="Campus Readiness Score"
                description="A composite 0-100 score measuring evacuation preparedness. Based on evacuation rate (40%), bottleneck frequency (30%), and response time (30%)."
              />
            </div>
            <div style={{ fontSize: 'var(--text-xl)', fontWeight: '700', color: rl.textColor, marginBottom: '4px' }}>
              {rl.text}
            </div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {isDashboardLoading
                ? 'Loading completed evacuation runs for your account.'
                : 'Based on evacuation rate, bottleneck frequency, and drill response time across your completed runs.'}
            </div>
          </div>
        </Card>

        {/* Building Coverage */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="3" y1="9" x2="21" y2="9" />
              <line x1="9" y1="21" x2="9" y2="9" />
            </svg>
            <span style={{ fontSize: 'var(--text-xs)', fontWeight: '600', letterSpacing: '0.08em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Building Coverage
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
            {isDashboardLoading ? (
              <span className="skeleton" style={{ width: '96px', height: '32px' }} />
            ) : (
              <>
                <span style={{ fontSize: 'var(--text-num)', fontWeight: '700', color: 'var(--text-primary)', lineHeight: 1 }}>
                  {coverageCovered}
                </span>
                <span style={{ fontSize: 'var(--text-md)', color: 'var(--text-secondary)' }}>
                  / {coverageTotal} buildings
                </span>
              </>
            )}
          </div>

          {/* Coverage board: one tick per campus building, lit as its drill data
              comes in — reads as a building roster, not a generic percent bar. */}
          <div style={{ display: 'flex', gap: '3px', marginBottom: 'var(--space-3)' }} aria-hidden="true">
            {Array.from({ length: Math.max(coverageTotal, 1) }).map((_, i) => (
              <div key={i} style={{
                flex: 1, height: '6px', borderRadius: '2px',
                background: !isDashboardLoading && i < coverageCovered ? ACCENT : 'var(--bg-inset)',
                transition: 'background 0.3s',
              }} />
            ))}
          </div>

          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {isDashboardLoading
              ? 'Loading building coverage from your completed simulation runs.'
              : 'Buildings with completed simulation data in your account.'}
          </div>

          <div style={{ display: 'flex', gap: '6px', marginTop: 'var(--space-3)', flexWrap: 'wrap' }}>
            {isDashboardLoading ? (
              <CoveragePill label="Loading" tone="muted" />
            ) : coverageNames.length > 0 ? (
              <>
                {coverageNames.slice(0, 2).map(name => (
                  <CoveragePill key={name} label={name} tone="active" />
                ))}
                {coveragePending > 0 && (
                  <CoveragePill label={`+${coveragePending} pending`} tone="muted" />
                )}
              </>
            ) : (
              <CoveragePill label="No covered buildings yet" tone="muted" />
            )}
          </div>
        </Card>
      </div>

      {/* ── Stat Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        {statCards.map((card, i) => (
          <StatCard key={i} {...card} />
        ))}
      </div>

      {/* ── Drill Activity Timeline ── */}
      <Card style={{ marginBottom: '24px' }}>
        <DrillTimeline runs={recentRuns} isLoading={isDashboardLoading} />
      </Card>

      {/* ── Drill Comparison ── */}
      <Card style={{ marginBottom: '24px' }}>
        <DrillComparison runs={recentRuns} isMobile={isMobile} isLoading={isDashboardLoading} />
      </Card>

      {/* ── Quick Actions ── */}
      <Card style={{ marginBottom: '24px' }}>
        <QuickActions isMobile={isMobile} />
      </Card>

      {/* Onboarding */}
      <OnboardingOverlay currentPage="dashboard" />
    </div>
  )
}

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

function CoveragePill({ label, tone }: { label: string; tone: 'active' | 'muted' }) {
  return (
    <span style={{
      padding: '3px 10px',
      borderRadius: '6px',
      fontSize: '11px',
      fontWeight: tone === 'active' ? '600' : '500',
      background: tone === 'active' ? 'rgba(45,184,176,0.1)' : 'var(--bg-inset)',
      color: tone === 'active' ? 'var(--status-text-teal)' : 'var(--text-muted)',
    }}>
      {label}
    </span>
  )
}

function buildStatCards(stats: AggregateStats | null, isLoading: boolean): StatCardProps[] {
  return [
    {
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 3v18h18" /><path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" />
        </svg>
      ),
      label: 'SIMULATIONS RUN',
      value: stats?.totalRuns.toString() ?? '0',
      sub: isLoading ? 'Loading completed runs' : stats && stats.totalRuns > 0 ? 'completed runs' : 'No data yet',
      color: ACCENT,
      loading: isLoading,
    },
    {
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
      label: 'TOTAL AGENTS',
      value: stats?.totalAgentsSimulated.toLocaleString() ?? '0',
      sub: isLoading ? 'Loading agent totals' : 'across your simulations',
      color: ACCENT,
      loading: isLoading,
    },
    {
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      ),
      label: 'AVG EVACUATION',
      value: stats ? `${stats.avgEvacuationRate.toFixed(0)}%` : '0%',
      sub: isLoading ? 'Loading success rate' : 'average success rate',
      color: ACCENT,
      progress: isLoading ? 0 : stats?.avgEvacuationRate ?? 0,
      loading: isLoading,
    },
    {
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      ),
      label: 'AVG BOTTLENECKS',
      value: stats ? stats.avgBottlenecksPerRun.toFixed(1) : '0',
      sub: isLoading ? 'Loading bottleneck average' : 'per simulation run',
      color: '#f59e0b',
      loading: isLoading,
    },
  ]
}

const DISASTER_ICON: Record<string, { color: string; bg: string; label: string }> = {
  fire:       { color: '#ff6b35', bg: 'rgba(255,107,53,0.1)',  label: 'Fire Drill' },
  earthquake: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', label: 'Earthquake Drill' },
}

function DrillTimeline({ runs, isLoading }: { runs: SimulationRun[]; isLoading: boolean }) {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
          </svg>
          <span style={{ fontSize: 'var(--text-md)', fontWeight: '600', color: 'var(--text-primary)' }}>Recent Drill Activity</span>
        </div>
        {!isLoading && runs.length > 0 && (
          <a href="/analysis/runs" className="hover-darken" style={{
            fontSize: 'var(--text-xs)', fontWeight: '600', color: 'var(--status-text-teal)', textDecoration: 'none',
          }}>
            View all runs →
          </a>
        )}
      </div>
      <p style={{ margin: '0 0 16px', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
        Latest simulation runs and their outcomes
      </p>

      {isLoading ? (
        <DashboardLoadingState text="Loading recent drill activity..." />
      ) : runs.length === 0 ? (
        <div style={{
          padding: '32px 16px', textAlign: 'center',
          background: 'var(--bg-subtle)', borderRadius: '10px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--border-strong)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>No drill activity yet</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Run your first simulation to see results here</div>
        </div>
      ) : (
        <div style={{ position: 'relative', paddingLeft: '24px' }}>
          {/* Timeline line */}
          <div style={{
            position: 'absolute', left: '7px', top: '8px', bottom: '8px',
            width: '2px', background: 'var(--border)', borderRadius: '1px',
          }} />

          {runs.map((run, i) => {
            const dt = DISASTER_ICON[run.disasterType] ?? DISASTER_ICON.fire
            const agents = run.config?.agentCount ?? 0
            const evacuated = run.results?.evacuatedCount ?? 0
            const evacRate = agents > 0 ? Math.round((evacuated / agents) * 100) : 0
            const evacTime = run.results?.evacuationTime
            const steps = run.results?.totalSteps ?? 0

            return (
              <div key={run.id} style={{
                position: 'relative',
                paddingBottom: i < runs.length - 1 ? '20px' : '0',
              }}>
                {/* Timeline dot */}
                <div style={{
                  position: 'absolute', left: '-21px', top: '6px',
                  width: '12px', height: '12px', borderRadius: '50%',
                  background: dt.bg, border: `2px solid ${dt.color}`,
                }} />

                {/* Card */}
                <div style={{
                  padding: '14px 16px',
                  background: 'var(--bg-subtle)',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                }}>
                  {/* Top row: type + time */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: '5px', fontSize: '11px', fontWeight: '600',
                        background: dt.bg, color: dt.color,
                      }}>
                        {dt.label}
                      </span>
                      <span style={{
                        padding: '2px 8px', borderRadius: '5px', fontSize: '11px', fontWeight: '500',
                        background: evacRate >= 80 ? 'rgba(34,197,94,0.1)' : evacRate >= 50 ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)',
                        color: evacRate >= 80 ? 'var(--status-text-green)' : evacRate >= 50 ? 'var(--status-text-amber)' : 'var(--status-text-red)',
                      }}>
                        {evacRate}% evacuated
                      </span>
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {relativeTime(run.createdAt)}
                    </span>
                  </div>

                  {/* Metrics row */}
                  <div style={{ display: 'flex', gap: '16px' }}>
                    <MetricChip label="Agents" value={agents.toString()} />
                    <MetricChip label="Steps" value={steps.toString()} />
                    <MetricChip label="Time" value={evacTime != null ? `${evacTime.toFixed(1)}s` : '—'} />
                    <MetricChip label="Evacuated" value={`${evacuated}/${agents}`} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

function MetricChip({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>
        {label}
      </div>
      <div style={{ fontSize: 'var(--text-md)', fontWeight: '600', color: 'var(--text-primary)' }}>
        {value}
      </div>
    </div>
  )
}

/** Green/amber/red read on the evacuation rate, matching the thresholds
 * already used for the timeline's evacuation-rate pill. */
function rateTone(rate: number): string {
  if (rate >= 80) return 'var(--status-text-green)'
  if (rate >= 50) return 'var(--status-text-amber)'
  return 'var(--status-text-red)'
}

function DashboardLoadingState({ text }: { text: string }) {
  return (
    <div style={{
      padding: '32px 16px',
      textAlign: 'center',
      background: 'var(--bg-subtle)',
      borderRadius: '10px',
      color: 'var(--text-secondary)',
      fontSize: '13px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '10px',
    }}>
      <span className="spinner" />
      {text}
    </div>
  )
}

function evacRate(run: SimulationRun): number {
  const agents = run.config?.agentCount ?? 0
  const evacuated = run.results?.evacuatedCount ?? 0
  return agents > 0 ? Math.round((evacuated / agents) * 100) : 0
}

function compareDelta(a: SimulationRun, b: SimulationRun): { evacDelta: number; timeDelta: number } {
  const rateA = evacRate(a)
  const rateB = evacRate(b)
  const timeA = a.results?.evacuationTime ?? 0
  const timeB = b.results?.evacuationTime ?? 0
  return { evacDelta: rateB - rateA, timeDelta: timeB - timeA }
}

function DrillComparison({ runs, isMobile, isLoading }: { runs: SimulationRun[]; isMobile: boolean; isLoading: boolean }) {
  const hasPair = runs.length >= 2
  const a = hasPair ? runs[1] : null
  const b = hasPair ? runs[0] : null

  const compareUrl = hasPair && a && b
    ? `/analysis/compare?a=${a.id}&b=${b.id}`
    : '/analysis/compare'

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h6" /><path d="M3 12h6" /><path d="M3 18h6" />
            <path d="M15 6h6" /><path d="M15 12h6" /><path d="M15 18h6" />
          </svg>
          <span style={{ fontSize: 'var(--text-lg)', fontWeight: '600', color: 'var(--text-primary)' }}>Drill Comparison</span>
        </div>
        {!isLoading && hasPair && (
          <a href="/analysis/compare" className="hover-darken" style={{
            fontSize: 'var(--text-sm)', fontWeight: '600', color: 'var(--status-text-teal)', textDecoration: 'none',
          }}>
            Compare any runs →
          </a>
        )}
      </div>
      <p style={{ margin: '0 0 16px', fontSize: 'var(--text-base)', color: 'var(--text-secondary)' }}>
        See how the latest drill stacks up against the one before it
      </p>

      {isLoading ? (
        <DashboardLoadingState text="Loading comparison data..." />
      ) : hasPair && a && b ? (
        <ComparisonPreview a={a} b={b} compareUrl={compareUrl} isMobile={isMobile} />
      ) : (
        <div style={{
          padding: '24px 20px', textAlign: 'center',
          background: 'var(--bg-subtle)', border: '1px dashed var(--border-strong)', borderRadius: '10px',
        }}>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
            {runs.length === 1
              ? 'Run one more simulation to unlock side-by-side comparison.'
              : 'Run at least two simulations to compare them side by side.'}
          </div>
          <a href="/map" className="hover-darken" style={{
            display: 'inline-block', marginTop: '8px', padding: '8px 16px',
            background: 'var(--teal-button)', color: '#ffffff', borderRadius: '6px',
            textDecoration: 'none', fontSize: '13px', fontWeight: '600',
          }}>
            Run another simulation
          </a>
        </div>
      )}
    </>
  )
}

function ComparisonPreview({ a, b, compareUrl, isMobile }: { a: SimulationRun; b: SimulationRun; compareUrl: string; isMobile: boolean }) {
  const { evacDelta, timeDelta } = compareDelta(a, b)
  const dtA = DISASTER_ICON[a.disasterType] ?? DISASTER_ICON.fire
  const dtB = DISASTER_ICON[b.disasterType] ?? DISASTER_ICON.fire

  return (
    <div style={{
      display: isMobile ? 'flex' : 'grid',
      flexDirection: isMobile ? 'column' : undefined,
      gridTemplateColumns: isMobile ? undefined : '1fr auto 1fr auto',
      gap: isMobile ? '12px' : '16px',
      alignItems: 'stretch',
    }}>
      <RunCard label="Baseline (A)" badgeColor="#64748b" run={a} dt={dtA} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{
          width: '34px', height: '34px', borderRadius: '50%', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--bg-inset)', border: '1px solid var(--border)', color: 'var(--text-muted)',
          transform: isMobile ? 'rotate(90deg)' : 'none',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </div>
      </div>

      <RunCard label="Latest (B)" badgeColor={ACCENT} run={b} dt={dtB} emphasize />

      <div style={{
        display: 'flex', flexDirection: 'column', gap: 'var(--space-4)',
        justifyContent: 'space-between', minWidth: isMobile ? 'auto' : '190px',
        padding: 'var(--space-4)', background: 'var(--bg-subtle)',
        border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
      }}>
        <div style={{ display: 'flex', gap: 'var(--space-5)' }}>
          <DeltaPill
            label="Evac. rate"
            delta={evacDelta}
            format={(v) => `${v > 0 ? '+' : ''}${v}%`}
            betterWhenHigher
          />
          <DeltaPill
            label="Evac. time"
            delta={timeDelta}
            format={(v) => `${v > 0 ? '+' : ''}${v.toFixed(1)}s`}
            betterWhenHigher={false}
          />
        </div>
        <a href={compareUrl} className="hover-darken" style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
          padding: '10px 16px', background: 'var(--teal-button)', color: '#ffffff',
          borderRadius: 'var(--radius-sm)', textDecoration: 'none', fontSize: 'var(--text-md)', fontWeight: '600',
          width: '100%',
        }}>
          Open comparison
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </a>
      </div>
    </div>
  )
}

function RunCard({ label, badgeColor, run, dt, emphasize }: {
  label: string
  badgeColor: string
  run: SimulationRun
  dt: { color: string; bg: string; label: string }
  /** Latest (B) gets a teal-tinted surface so it reads as the current run at a glance. */
  emphasize?: boolean
}) {
  const agents = run.config?.agentCount ?? 0
  const evacuated = run.results?.evacuatedCount ?? 0
  const rate = evacRate(run)
  const time = run.results?.evacuationTime

  return (
    <div style={{
      padding: 'var(--space-4)',
      background: emphasize ? 'var(--teal-light)' : 'var(--bg-subtle)',
      border: '1px solid var(--border)', borderLeft: `3px solid ${badgeColor}`,
      borderRadius: 'var(--radius-md)',
      display: 'flex', flexDirection: 'column', gap: 'var(--space-3)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
        <span style={{
          padding: '2px 8px', borderRadius: '5px', fontSize: 'var(--text-xs)', fontWeight: '700', letterSpacing: '0.06em',
          background: `${badgeColor}1A`, color: badgeColor,
        }}>
          {label}
        </span>
        <span style={{
          padding: '2px 8px', borderRadius: '5px', fontSize: 'var(--text-sm)', fontWeight: '600',
          background: dt.bg, color: dt.color,
        }}>
          {dt.label}
        </span>
      </div>

      {/* Evacuation rate is the headline outcome of a run, so it gets its own
          hero line instead of sitting flush with the secondary metrics. */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
        <span style={{ fontSize: 'var(--text-2xl)', fontWeight: '700', color: rateTone(rate), lineHeight: 1 }}>
          {rate}%
        </span>
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>evacuated</span>
      </div>

      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        <MetricChip label="Agents" value={`${evacuated}/${agents}`} />
        <MetricChip label="Time" value={time != null ? `${time.toFixed(1)}s` : '—'} />
      </div>
      <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
        {relativeTime(run.createdAt)}
      </div>
    </div>
  )
}

function DeltaPill({ label, delta, format, betterWhenHigher }: {
  label: string
  delta: number
  format: (value: number) => string
  betterWhenHigher: boolean
}) {
  const better: BetterWhen = betterWhenHigher ? 'higher' : 'lower'
  const color = trendColor(delta, better)
  const bg = trendTint(delta, better)

  return (
    <div>
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
        {label}
      </div>
      <div style={{
        display: 'inline-block', padding: delta === 0 ? '4px 0' : '4px 10px', borderRadius: 'var(--radius-xs)',
        background: bg, color, fontSize: 'var(--text-md)', fontWeight: '600',
      }}>
        {delta === 0 ? 'Unchanged' : format(delta)}
      </div>
    </div>
  )
}

const QUICK_ACTIONS = [
  {
    href: '/map',
    label: 'Fire Simulation',
    sub: 'High urgency scenario',
    color: '#ff6b35',
  },
  {
    href: '/map',
    label: 'Earthquake Drill',
    sub: 'Dynamic obstacles scenario',
    color: 'var(--status-text-amber)',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 8h18" />
        <path d="M3 16h18" />
        <path d="M9 5l-2 6 4 2-2 6" />
        <path d="M15 5l-2 6 4 2-2 6" />
      </svg>
    ),
  },
  {
    href: '/analysis',
    label: 'Heatmap Analysis',
    sub: 'View density & bottlenecks',
    color: 'var(--status-text-teal)',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M9 3v18M15 3v18M3 9h18M3 15h18" />
        <circle cx="15" cy="9" r="2.2" />
      </svg>
    ),
  },
]

function QuickActions({ isMobile }: { isMobile: boolean }) {
  return (
    <>
      <h2 style={{ margin: '0 0 14px', fontSize: 'var(--text-md)', fontWeight: '600', color: 'var(--text-primary)' }}>Quick Actions</h2>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '12px' }}>
        {QUICK_ACTIONS.map(item => (
          <a key={item.label} href={item.href} className="hover-darken" style={{
            display: 'flex', flexDirection: 'column', gap: '2px',
            padding: '12px 14px', background: 'var(--teal-button)',
            borderRadius: '8px', textDecoration: 'none',
          }}>
            <div style={{ fontSize: '13px', fontWeight: '600', color: '#fff' }}>{item.label}</div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.85)' }}>{item.sub}</div>          </a>
        ))}
      </div>
    </>
  )
}
