'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/src/hooks/useAuth'
import { useIsMobile } from '@/src/hooks/useIsMobile'
import { useOnboarding } from '@/src/hooks/useOnboarding'
import {
  getSimulationHistory,
  getAggregateSimulationStats,
} from '@/src/services/simulation.service'
import { getUserProfile } from '@/src/services/user.service'
import { OnboardingOverlay } from '@/components/Onboarding/OnboardingOverlay'
import { InfoTooltip } from '@/components/InfoTooltip'
import type { SimulationRun } from '@/src/schema/simulation.types'

// ─── Constants ────────────────────────────────────────────────────────────────
const SECTION_CARD: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid var(--border)',
  borderRadius: '14px',
  padding: '28px 32px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  marginBottom: '24px',
}

const TOTAL_CAMPUS_BUILDINGS = 21
const BUILDINGS_WITH_FLOORPLANS = 1 // admin-building

interface AggregateStats {
  totalRuns: number
  avgEvacuationRate: number
  totalAgentsSimulated: number
  avgBottlenecksPerRun: number
  avgEvacuationTime: number
}

// ─── Utilities ────────────────────────────────────────────────────────────────
function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffSec = Math.floor((now - then) / 1000)
  if (diffSec < 60) return 'just now'
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 30) return `${diffDay}d ago`
  return new Date(dateStr).toLocaleDateString()
}

function computeReadiness(stats: AggregateStats | null): number {
  if (!stats || stats.totalRuns === 0) return 0
  const evacScore = Math.min(stats.avgEvacuationRate, 100) * 0.4
  const bottleneckScore = Math.max(0, 100 - stats.avgBottlenecksPerRun * 20) * 0.3
  const timeScore = Math.max(0, 100 - stats.avgEvacuationTime * 2) * 0.3
  return Math.round(Math.max(0, Math.min(100, evacScore + bottleneckScore + timeScore)))
}

function readinessLabel(score: number): { text: string; color: string } {
  if (score >= 80) return { text: 'Excellent', color: '#22c55e' }
  if (score >= 60) return { text: 'Good', color: '#2db8b0' }
  if (score >= 40) return { text: 'Fair', color: '#f59e0b' }
  if (score > 0)   return { text: 'Needs Work', color: '#ef4444' }
  return { text: 'No Data', color: '#94a3b8' }
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

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const isMobile = useIsMobile()
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth()
  const { resetOnboarding } = useOnboarding()
  const [stats, setStats] = useState<AggregateStats | null>(null)
  const [recentRuns, setRecentRuns] = useState<SimulationRun[]>([])
  const [profileName, setProfileName] = useState<{ userId: string; displayName: string | null } | null>(null)

  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      window.location.href = '/auth'
    }
  }, [isAuthLoading, isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated) return
    async function loadData() {
      try {
        const [aggregate, history] = await Promise.all([
          getAggregateSimulationStats(),
          getSimulationHistory(10),
        ])
        setStats(aggregate)
        setRecentRuns(history)
      } catch (err) {
        console.error('Failed to load dashboard data:', err)
      }
    }
    loadData()
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
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Loading...</div>
      </div>
    )
  }

  const readiness = computeReadiness(stats)
  const rl = readinessLabel(readiness)
  const statCards = buildStatCards(stats)
  const greeting = getGreeting()
  const displayName = profileName && profileName.userId === user?.id ? profileName.displayName : null

  return (
    <div data-page-shell style={{
      minHeight: '100vh',
      padding: isMobile ? '20px 14px 32px' : '88px 40px 56px',
      maxWidth: '1280px',
      margin: '0 auto',
    }}>

      {/* ── Welcome Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '32px', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: '26px', fontWeight: '700', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            {greeting}, {userName(displayName, user?.user_metadata, user?.email)}
          </h1>
          <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>
            Campus evacuation overview &amp; drill analytics
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', flexShrink: 0, flexWrap: 'wrap' }}>
          <button
            onClick={() => resetOnboarding()}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '10px 20px', background: '#f0f4f8', color: '#2db8b0',
              border: '1px solid #e0e8f0', borderRadius: '8px', cursor: 'pointer',
              fontSize: '14px', fontWeight: '600', transition: 'all 0.2s ease-in-out',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#e8f1f0'
              e.currentTarget.style.borderColor = '#2db8b0'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#f0f4f8'
              e.currentTarget.style.borderColor = '#e0e8f0'
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="16" x2="12" y2="12"/>
              <line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
            Tutorial
          </button>
          <a href="/map" style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '10px 20px', background: '#2db8b0', color: '#fff',
            borderRadius: '8px', textDecoration: 'none', fontSize: '14px', fontWeight: '600', flexShrink: 0,
            transition: 'all 0.2s ease-in-out',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#1f9189'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#2db8b0'
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#ffffff" stroke="none">
              <polygon points="8 5 19 12 8 19 8 5" />
            </svg>
            Run Simulation
          </a>
        </div>
      </div>

      {/* ── Readiness + Coverage row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px', marginBottom: '24px' }}>

        {/* Campus Readiness Score */}
        <div style={{
          ...SECTION_CARD, marginBottom: 0,
          display: 'flex', alignItems: 'center', gap: '28px',
        }}>
          {/* Circular progress ring */}
          <div style={{ position: 'relative', width: '96px', height: '96px', flexShrink: 0 }}>
            <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
              <circle cx="50" cy="50" r="42" fill="none" stroke="#f1f5f9" strokeWidth="8" />
              <circle cx="50" cy="50" r="42" fill="none" stroke={rl.color} strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${readiness * 2.64} ${264 - readiness * 2.64}`} />
            </svg>
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', lineHeight: 1 }}>{readiness}</span>
              <span style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>/ 100</span>
            </div>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.08em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Campus Readiness
              </span>
              <InfoTooltip
                title="Campus Readiness Score"
                description="A composite 0-100 score measuring evacuation preparedness. Based on evacuation rate (40%), bottleneck frequency (30%), and response time (30%)."
              />
            </div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: rl.color, marginBottom: '4px' }}>
              {rl.text}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Based on evacuation rate, bottleneck frequency, and drill response time across all completed runs.
            </div>
          </div>
        </div>

        {/* Building Coverage */}
        <div style={{ ...SECTION_CARD, marginBottom: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2db8b0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="3" y1="9" x2="21" y2="9" />
              <line x1="9" y1="21" x2="9" y2="9" />
            </svg>
            <span style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.08em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Building Coverage
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '6px' }}>
            <span style={{ fontSize: '32px', fontWeight: '700', color: 'var(--text-primary)', lineHeight: 1 }}>
              {BUILDINGS_WITH_FLOORPLANS}
            </span>
            <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
              / {TOTAL_CAMPUS_BUILDINGS} buildings
            </span>
          </div>

          <div style={{ height: '6px', background: '#f1f5f9', borderRadius: '3px', marginBottom: '10px' }}>
            <div style={{
              height: '100%', borderRadius: '3px', background: '#2db8b0',
              width: `${(BUILDINGS_WITH_FLOORPLANS / TOTAL_CAMPUS_BUILDINGS) * 100}%`,
              transition: 'width 0.3s',
            }} />
          </div>

          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Floor plans with simulation support. More buildings will be added for comprehensive campus-wide drills.
          </div>

          <div style={{ display: 'flex', gap: '6px', marginTop: '12px', flexWrap: 'wrap' }}>
            <span style={{
              padding: '3px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '600',
              background: 'rgba(45,184,176,0.1)', color: '#2db8b0',
            }}>
              Admin Building
            </span>
            <span style={{
              padding: '3px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '500',
              background: '#f1f5f9', color: 'var(--text-muted)',
            }}>
              +20 pending
            </span>
          </div>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        {statCards.map((card, i) => (
          <StatCard key={i} {...card} />
        ))}
      </div>

      {/* ── Drill Activity Timeline ── */}
      <div style={SECTION_CARD}>
        <DrillTimeline runs={recentRuns} />
      </div>

      {/* ── Drill Comparison ── */}
      <div style={SECTION_CARD}>
        <DrillComparison runs={recentRuns} isMobile={isMobile} />
      </div>

      {/* ── Quick Actions ── */}
      <div style={SECTION_CARD}>
        <QuickActions isMobile={isMobile} />
      </div>

      {/* Onboarding */}
      <OnboardingOverlay currentPage="dashboard" />
    </div>
  )
}

// ─── Greeting based on time of day ───────────────────────────────────────────
function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
interface StatCardData {
  icon: React.ReactNode
  label: string
  value: string
  sub: string
  color: string
  progress?: number
}

function StatCard({ icon, label, value, sub, color, progress }: StatCardData) {
  return (
    <div style={{
      background: '#ffffff',
      border: '1px solid var(--border)',
      borderRadius: '14px',
      padding: '24px 28px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        {icon}
        <span style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.08em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: '32px', fontWeight: '700', color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1 }}>
        {value}
      </div>
      {progress !== undefined && (
        <div style={{ margin: '10px 0 4px', height: '4px', background: '#f1f5f9', borderRadius: '2px' }}>
          <div style={{ height: '100%', width: `${Math.min(progress, 100)}%`, background: color, borderRadius: '2px' }} />
        </div>
      )}
      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '6px' }}>{sub}</div>
    </div>
  )
}

function buildStatCards(stats: AggregateStats | null): StatCardData[] {
  return [
    {
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2db8b0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 3v18h18" /><path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" />
        </svg>
      ),
      label: 'SIMULATIONS RUN',
      value: stats?.totalRuns.toString() ?? '0',
      sub: stats && stats.totalRuns > 0 ? 'completed runs' : 'No data yet',
      color: '#2db8b0',
    },
    {
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2db8b0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
      label: 'TOTAL AGENTS',
      value: stats?.totalAgentsSimulated.toLocaleString() ?? '0',
      sub: 'across all simulations',
      color: '#2db8b0',
    },
    {
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2db8b0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      ),
      label: 'AVG EVACUATION',
      value: stats ? `${stats.avgEvacuationRate.toFixed(0)}%` : '0%',
      sub: 'average success rate',
      color: '#2db8b0',
      progress: stats?.avgEvacuationRate ?? 0,
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
      sub: 'per simulation run',
      color: '#f59e0b',
    },
  ]
}

// ─── Drill Activity Timeline ─────────────────────────────────────────────────
const DISASTER_ICON: Record<string, { color: string; bg: string; label: string }> = {
  fire:       { color: '#ff6b35', bg: 'rgba(255,107,53,0.1)',  label: 'Fire Drill' },
  earthquake: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', label: 'Earthquake Drill' },
}

function DrillTimeline({ runs }: { runs: SimulationRun[] }) {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2db8b0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
        </svg>
        <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>Recent Drill Activity</span>
      </div>
      <p style={{ margin: '0 0 16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
        Latest simulation runs and their outcomes
      </p>

      {runs.length === 0 ? (
        <div style={{
          padding: '32px 16px', textAlign: 'center',
          background: '#f8fafc', borderRadius: '10px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
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
            width: '2px', background: '#e2e8f0', borderRadius: '1px',
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
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
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
                        color: evacRate >= 80 ? '#22c55e' : evacRate >= 50 ? '#f59e0b' : '#ef4444',
                      }}>
                        {evacRate}% evacuated
                      </span>
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {timeAgo(run.createdAt)}
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
      <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1px' }}>
        {label}
      </div>
      <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
        {value}
      </div>
    </div>
  )
}

// ─── Drill Comparison ────────────────────────────────────────────────────────
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

function DrillComparison({ runs, isMobile }: { runs: SimulationRun[]; isMobile: boolean }) {
  const hasPair = runs.length >= 2
  const a = hasPair ? runs[1] : null
  const b = hasPair ? runs[0] : null

  const compareUrl = hasPair && a && b
    ? `/analysis/compare?a=${a.id}&b=${b.id}`
    : '/analysis/compare'

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2db8b0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 6h6" /><path d="M3 12h6" /><path d="M3 18h6" />
          <path d="M15 6h6" /><path d="M15 12h6" /><path d="M15 18h6" />
        </svg>
        <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>Drill Comparison</span>
      </div>
      <p style={{ margin: '0 0 16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
        See how the latest drill stacks up against the one before it
      </p>

      {hasPair && a && b ? (
        <ComparisonPreview a={a} b={b} compareUrl={compareUrl} isMobile={isMobile} />
      ) : (
        <div style={{
          padding: '24px 20px', textAlign: 'center',
          background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '10px',
        }}>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
            {runs.length === 1
              ? 'Run one more simulation to unlock side-by-side comparison.'
              : 'Run at least two simulations to compare them side by side.'}
          </div>
          <a href="/map" style={{
            display: 'inline-block', marginTop: '8px', padding: '8px 16px',
            background: '#2db8b0', color: '#ffffff', borderRadius: '6px',
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

      <div style={{
        display: 'flex', alignItems: 'center', color: '#94a3b8',
        justifyContent: 'center',
        transform: isMobile ? 'rotate(90deg)' : 'none',
      }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="5" y1="12" x2="19" y2="12" />
          <polyline points="12 5 19 12 12 19" />
        </svg>
      </div>

      <RunCard label="Latest (B)" badgeColor="#2db8b0" run={b} dt={dtB} />

      <div style={{
        display: 'flex', flexDirection: 'column',
        justifyContent: 'space-between', gap: isMobile ? '10px' : '8px',
        minWidth: isMobile ? 'auto' : '180px',
      }}>
        <DeltaPill
          label="Evacuation rate"
          delta={evacDelta}
          format={(v) => `${v > 0 ? '+' : ''}${v}%`}
          betterWhenHigher
        />
        <DeltaPill
          label="Evacuation time"
          delta={timeDelta}
          format={(v) => `${v > 0 ? '+' : ''}${v.toFixed(1)}s`}
          betterWhenHigher={false}
        />
        <a href={compareUrl} style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
          padding: '9px 14px', background: '#2db8b0', color: '#ffffff',
          borderRadius: '6px', textDecoration: 'none', fontSize: '13px', fontWeight: '600',
          width: isMobile ? '100%' : undefined,
        }}>
          Open comparison
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </a>
      </div>
    </div>
  )
}

function RunCard({ label, badgeColor, run, dt }: {
  label: string
  badgeColor: string
  run: SimulationRun
  dt: { color: string; bg: string; label: string }
}) {
  const agents = run.config?.agentCount ?? 0
  const evacuated = run.results?.evacuatedCount ?? 0
  const rate = evacRate(run)
  const time = run.results?.evacuationTime

  return (
    <div style={{
      padding: '12px 14px', background: '#f8fafc',
      border: '1px solid #e2e8f0', borderRadius: '10px',
      display: 'flex', flexDirection: 'column', gap: '8px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
        <span style={{
          padding: '2px 8px', borderRadius: '5px', fontSize: '10px', fontWeight: '700', letterSpacing: '0.06em',
          background: `${badgeColor}1A`, color: badgeColor,
        }}>
          {label}
        </span>
        <span style={{
          padding: '2px 8px', borderRadius: '5px', fontSize: '11px', fontWeight: '600',
          background: dt.bg, color: dt.color,
        }}>
          {dt.label}
        </span>
      </div>
      <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
        <MetricChip label="Evacuated" value={`${evacuated}/${agents}`} />
        <MetricChip label="Rate" value={`${rate}%`} />
        <MetricChip label="Time" value={time != null ? `${time.toFixed(1)}s` : '—'} />
      </div>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
        {timeAgo(run.createdAt)}
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
  const improved = delta !== 0 && (betterWhenHigher ? delta > 0 : delta < 0)
  const color = delta === 0 ? '#64748b' : improved ? '#22c55e' : '#ef4444'
  const bg = delta === 0 ? '#e2e8f0' : improved ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)'

  return (
    <div>
      <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '3px' }}>
        {label}
      </div>
      <div style={{
        display: 'inline-block', padding: '3px 8px', borderRadius: '5px',
        background: bg, color, fontSize: '13px', fontWeight: '600',
      }}>
        {delta === 0 ? 'Unchanged' : format(delta)}
      </div>
    </div>
  )
}

// ─── Quick Actions ────────────────────────────────────────────────────────────
const QUICK_ACTIONS = [
  {
    href: '/map',
    label: 'Fire Simulation',
    sub: 'High urgency scenario',
    color: '#ff6b35',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ff6b35" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 21c-4.4 0-8-3.3-8-7.5 0-2.4 1.2-4.5 2.8-6.2C8.3 5.7 9.4 4 10 2c1.4.9 2.8 2.5 3.6 4.2.7-1 1.1-2 1.3-3.2 2.9 2.3 5.1 6 5.1 10.2 0 4.4-3.6 7.8-8 7.8z" />
        <path d="M12 18.2c-1.9 0-3.5-1.4-3.5-3.2 0-1.1.5-2 1.3-2.8.7-.6 1.2-1.3 1.5-2.2 1.6 1.1 2.9 2.9 2.9 5 0 1.8-1 3.2-2.2 3.2z" />
      </svg>
    ),
  },
  {
    href: '/map',
    label: 'Earthquake Drill',
    sub: 'Dynamic obstacles scenario',
    color: '#f59e0b',
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
    color: '#2db8b0',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2db8b0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
      <h2 style={{ margin: '0 0 14px', fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>Quick Actions</h2>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '12px' }}>
        {QUICK_ACTIONS.map(item => (
          <a key={item.label} href={item.href} style={{
            display: 'flex', alignItems: 'center', gap: '14px',
            padding: '12px 14px', background: '#f8fafc',
            borderRadius: '8px', textDecoration: 'none',
          }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '8px',
              background: `${item.color}18`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '18px', flexShrink: 0,
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
    </>
  )
}
