'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/src/hooks/useAuth'
import {
  getSimulationHistory,
  getAggregateSimulationStats,
} from '@/src/services/simulation.service'
import type { SimulationRun } from '@/src/schema/simulation.types'

// ─── Constants ────────────────────────────────────────────────────────────────
const CARD: React.CSSProperties = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg)',
  padding: '24px 28px',
  boxShadow: 'var(--shadow)',
  transition: 'box-shadow var(--transition)',
}

const TOTAL_CAMPUS_BUILDINGS = 21
const BUILDINGS_WITH_FLOORPLANS = 1

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

function userName(email?: string | null): string {
  if (!email) return 'Operator'
  const local = email.split('@')[0]
  return local.charAt(0).toUpperCase() + local.slice(1)
}

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth()
  const [stats, setStats] = useState<AggregateStats | null>(null)
  const [recentRuns, setRecentRuns] = useState<SimulationRun[]>([])

  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) window.location.href = '/auth'
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

  return (
    <div style={{ minHeight: '100vh', padding: '92px 40px 64px', maxWidth: '1280px', margin: '0 auto' }}>

      {/* ── Welcome Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '28px', gap: '16px', flexWrap: 'wrap',
      }}>
        <div>
          <h1 style={{
            margin: '0 0 4px', fontSize: '24px', fontWeight: '700',
            color: 'var(--text-primary)', letterSpacing: '-0.025em',
          }}>
            {getGreeting()}, {userName(user?.email)}
          </h1>
          <p style={{ margin: 0, fontSize: '13.5px', color: 'var(--text-secondary)' }}>
            Campus evacuation overview and drill analytics
          </p>
        </div>
        <a href="/simulate" style={{
          display: 'inline-flex', alignItems: 'center', gap: '8px',
          padding: '10px 22px', background: 'var(--teal)', color: '#fff',
          borderRadius: 'var(--radius-sm)', textDecoration: 'none',
          fontSize: '13.5px', fontWeight: '600', flexShrink: 0,
          boxShadow: '0 1px 3px rgba(45,184,176,0.3)',
          transition: 'all var(--transition)',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
          Run Simulation
        </a>
      </div>

      {/* ── Readiness + Coverage ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>

        {/* Campus Readiness */}
        <div style={{ ...CARD, display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div style={{ position: 'relative', width: '88px', height: '88px', flexShrink: 0 }}>
            <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
              <circle cx="50" cy="50" r="40" fill="none" stroke="var(--bg)" strokeWidth="9" />
              <circle cx="50" cy="50" r="40" fill="none" stroke={rl.color} strokeWidth="9"
                strokeLinecap="round"
                strokeDasharray={`${readiness * 2.51} ${251 - readiness * 2.51}`}
                style={{ transition: 'stroke-dasharray 0.6s ease' }} />
            </svg>
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text-primary)', lineHeight: 1 }}>{readiness}</span>
              <span style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '2px', fontWeight: '500' }}>/ 100</span>
            </div>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '10.5px', fontWeight: '600', letterSpacing: '0.08em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
              Campus Readiness
            </div>
            <div style={{ fontSize: '18px', fontWeight: '700', color: rl.color, marginBottom: '4px', letterSpacing: '-0.01em' }}>
              {rl.text}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              Composite score from evacuation rate, bottleneck frequency, and response time.
            </div>
          </div>
        </div>

        {/* Building Coverage */}
        <div style={CARD}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="3" y1="9" x2="21" y2="9" />
              <line x1="9" y1="21" x2="9" y2="9" />
            </svg>
            <span style={{ fontSize: '10.5px', fontWeight: '600', letterSpacing: '0.08em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Building Coverage
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '8px' }}>
            <span style={{ fontSize: '28px', fontWeight: '700', color: 'var(--text-primary)', lineHeight: 1, letterSpacing: '-0.02em' }}>
              {BUILDINGS_WITH_FLOORPLANS}
            </span>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '500' }}>
              / {TOTAL_CAMPUS_BUILDINGS} buildings
            </span>
          </div>

          <div style={{ height: '5px', background: 'var(--bg)', borderRadius: '3px', marginBottom: '10px' }}>
            <div style={{
              height: '100%', borderRadius: '3px', background: 'var(--teal)',
              width: `${(BUILDINGS_WITH_FLOORPLANS / TOTAL_CAMPUS_BUILDINGS) * 100}%`,
              transition: 'width 0.4s ease',
            }} />
          </div>

          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: '10px' }}>
            Floor plans with simulation support ready for evacuation drills.
          </div>

          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{
              padding: '3px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '600',
              background: 'var(--teal-light)', color: 'var(--teal)',
            }}>
              Admin Building
            </span>
            <span style={{
              padding: '3px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '500',
              background: 'var(--bg)', color: 'var(--text-muted)',
            }}>
              +20 pending
            </span>
          </div>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '16px' }}>
        {statCards.map((card, i) => (
          <StatCard key={i} {...card} />
        ))}
      </div>

      {/* ── Drill Activity Timeline ── */}
      <div style={{ ...CARD, marginBottom: '16px' }}>
        <DrillTimeline runs={recentRuns} />
      </div>

      {/* ── Quick Actions ── */}
      <div style={CARD}>
        <QuickActions />
      </div>
    </div>
  )
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
      ...CARD,
      padding: '20px 22px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
        <div style={{
          width: '30px', height: '30px', borderRadius: '8px',
          background: `${color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {icon}
        </div>
        <span style={{ fontSize: '10.5px', fontWeight: '600', letterSpacing: '0.08em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: '28px', fontWeight: '700', color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1 }}>
        {value}
      </div>
      {progress !== undefined && (
        <div style={{ margin: '10px 0 4px', height: '4px', background: 'var(--bg)', borderRadius: '2px' }}>
          <div style={{ height: '100%', width: `${Math.min(progress, 100)}%`, background: color, borderRadius: '2px', transition: 'width 0.4s ease' }} />
        </div>
      )}
      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px' }}>{sub}</div>
    </div>
  )
}

function buildStatCards(stats: AggregateStats | null): StatCardData[] {
  return [
    {
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2db8b0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 3v18h18" /><path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" />
        </svg>
      ),
      label: 'SIMULATIONS',
      value: stats?.totalRuns.toString() ?? '0',
      sub: stats && stats.totalRuns > 0 ? 'completed runs' : 'No data yet',
      color: '#2db8b0',
    },
    {
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
      label: 'TOTAL AGENTS',
      value: stats?.totalAgentsSimulated.toLocaleString() ?? '0',
      sub: 'across all simulations',
      color: '#6366f1',
    },
    {
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      ),
      label: 'AVG EVACUATION',
      value: stats ? `${stats.avgEvacuationRate.toFixed(0)}%` : '0%',
      sub: 'average success rate',
      color: '#22c55e',
      progress: stats?.avgEvacuationRate ?? 0,
    },
    {
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
const DISASTER_META: Record<string, { color: string; bg: string; label: string }> = {
  fire:       { color: '#ef4444', bg: 'rgba(239,68,68,0.08)',  label: 'Fire Drill' },
  earthquake: { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', label: 'Earthquake Drill' },
}

function DrillTimeline({ runs }: { runs: SimulationRun[] }) {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
          </svg>
          <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
            Recent Drill Activity
          </span>
        </div>
        <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
          {runs.length > 0 ? `${runs.length} runs` : ''}
        </span>
      </div>

      {runs.length === 0 ? (
        <div style={{
          padding: '40px 16px', textAlign: 'center',
          background: 'var(--bg-subtle)', borderRadius: 'var(--radius)',
          border: '1px dashed var(--border)',
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--border-strong)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '10px' }}>
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '500' }}>No drill activity yet</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Run your first simulation to see results here
          </div>
        </div>
      ) : (
        <div style={{ position: 'relative', paddingLeft: '28px' }}>
          {/* Timeline line */}
          <div style={{
            position: 'absolute', left: '8px', top: '6px', bottom: '6px',
            width: '2px', background: 'var(--border)', borderRadius: '1px',
          }} />

          {runs.map((run, i) => {
            const dt = DISASTER_META[run.disasterType] ?? DISASTER_META.fire
            const agents = run.config?.agentCount ?? 0
            const evacuated = run.results?.evacuatedCount ?? 0
            const evacRate = agents > 0 ? Math.round((evacuated / agents) * 100) : 0
            const evacTime = run.results?.evacuationTime
            const steps = run.results?.totalSteps ?? 0

            return (
              <div key={run.id} style={{
                position: 'relative',
                paddingBottom: i < runs.length - 1 ? '12px' : '0',
              }}>
                {/* Timeline dot */}
                <div style={{
                  position: 'absolute', left: '-24px', top: '14px',
                  width: '10px', height: '10px', borderRadius: '50%',
                  background: 'var(--bg-card)', border: `2.5px solid ${dt.color}`,
                  boxShadow: 'var(--shadow-xs)',
                }} />

                {/* Card */}
                <div style={{
                  padding: '14px 18px',
                  background: 'var(--bg-subtle)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  transition: 'border-color var(--transition)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        padding: '3px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '600',
                        background: dt.bg, color: dt.color,
                      }}>
                        {dt.label}
                      </span>
                      <span style={{
                        padding: '3px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '600',
                        background: evacRate >= 80 ? 'rgba(34,197,94,0.08)' : evacRate >= 50 ? 'rgba(245,158,11,0.08)' : 'rgba(239,68,68,0.08)',
                        color: evacRate >= 80 ? '#16a34a' : evacRate >= 50 ? '#d97706' : '#dc2626',
                      }}>
                        {evacRate}% evacuated
                      </span>
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '500' }}>
                      {timeAgo(run.createdAt)}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '20px' }}>
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
      <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px', fontWeight: '500' }}>
        {label}
      </div>
      <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
        {value}
      </div>
    </div>
  )
}

// ─── Quick Actions ────────────────────────────────────────────────────────────
const QUICK_ACTIONS = [
  { href: '/simulate', label: 'Fire Simulation', sub: 'High urgency scenario', color: '#ef4444', iconPath: 'M12 2c.5 2.5 2 4.5 2 7a4 4 0 1 1-8 0c0-2.5 2-4.5 2-7 1.5 1.5 2.5 3 4 0z' },
  { href: '/simulate', label: 'Earthquake Drill', sub: 'Dynamic obstacles scenario', color: '#f59e0b', iconPath: 'M2 12h4l2-5 3 10 3-10 2 5h4' },
  { href: '/analysis', label: 'Heatmap Analysis', sub: 'View density & bottlenecks', color: '#2db8b0', iconPath: 'M3 3v18h18M18.7 8l-5.1 5.2-2.8-2.7L7 14.3' },
]

function QuickActions() {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
        <h2 style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>Quick Actions</h2>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
        {QUICK_ACTIONS.map(item => (
          <a key={item.label} href={item.href} style={{
            display: 'flex', alignItems: 'center', gap: '14px',
            padding: '14px 16px', background: 'var(--bg-subtle)',
            borderRadius: 'var(--radius)', textDecoration: 'none',
            border: '1px solid transparent',
            transition: 'all var(--transition)',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = 'var(--border)'
            e.currentTarget.style.boxShadow = 'var(--shadow)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = 'transparent'
            e.currentTarget.style.boxShadow = 'none'
          }}>
            <div style={{
              width: '38px', height: '38px', borderRadius: '10px',
              background: `${item.color}10`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={item.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d={item.iconPath} />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>{item.label}</div>
              <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '1px' }}>{item.sub}</div>
            </div>
          </a>
        ))}
      </div>
    </>
  )
}
