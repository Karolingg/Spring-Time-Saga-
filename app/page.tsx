'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/src/hooks/useAuth'
import {
  getSimulationHistory,
  getAggregateSimulationStats,
} from '@/src/services/simulation.service'
import type { SimulationRun } from '@/src/schema/simulation.types'

const SECTION_CARD: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid var(--border)',
  borderRadius: '14px',
  padding: '28px 32px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  marginBottom: '24px',
}

interface AggregateStats {
  totalRuns: number
  avgEvacuationRate: number
  totalAgentsSimulated: number
  avgBottlenecksPerRun: number
  avgEvacuationTime: number
}

export default function DashboardPage() {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth()
  const [stats, setStats] = useState<AggregateStats | null>(null)
  const [recentRuns, setRecentRuns] = useState<SimulationRun[]>([])

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
          getSimulationHistory(5),
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

  const statCards = buildStatCards(stats)

  return (
    <div style={{ minHeight: '100vh', padding: '88px 40px 56px', maxWidth: '1280px', margin: '0 auto' }}>
      <DashboardHeader />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        {statCards.map((card, i) => (
          <StatCard key={i} {...card} />
        ))}
      </div>

      <div style={SECTION_CARD}>
        <RecentRunsTable runs={recentRuns} />
      </div>

      <div style={SECTION_CARD}>
        <QuickActions />
      </div>
    </div>
  )
}

function DashboardHeader() {
  return (
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
  )
}

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
          <div style={{ height: '100%', width: `${Math.min(progress, 100)}%`, background: cardColorOrDefault(color), borderRadius: '2px' }} />
        </div>
      )}
      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '6px' }}>{sub}</div>
    </div>
  )
}

function cardColorOrDefault(color: string): string {
  return color || '#2db8b0'
}

function buildStatCards(stats: AggregateStats | null): StatCardData[] {
  return [
    {
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2db8b0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 3v18h18"/><path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"/>
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
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
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
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
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
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      ),
      label: 'AVG BOTTLENECKS',
      value: stats ? stats.avgBottlenecksPerRun.toFixed(1) : '0',
      sub: 'per simulation run',
      color: '#f59e0b',
    },
  ]
}

interface RecentRunsTableProps {
  runs: SimulationRun[]
}

function RecentRunsTable({ runs }: RecentRunsTableProps) {
  const TABLE_COLUMNS = ['RUN', 'AGENTS', 'EVACUATED', 'STEPS', 'EVAC TIME']

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2db8b0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
        </svg>
        <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>Recent Completed Runs</span>
      </div>
      <p style={{ margin: '0 0 16px', fontSize: '12px', color: 'var(--text-secondary)' }}>Latest 5 completed simulation runs</p>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            {TABLE_COLUMNS.map(col => (
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
          {runs.length === 0 ? (
            <tr>
              <td colSpan={5} style={{ padding: '24px 12px', textAlign: 'center', fontSize: '13px', color: 'var(--text-secondary)' }}>
                No completed simulation runs yet
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
            { href: '/simulate?disaster=fire', label: 'Fire Simulation', sub: 'High urgency scenario', color: '#ff6b35'},
            { href: '/simulate?disaster=earthquake', label: 'Earthquake Simulation', sub: 'Dynamic obstacles scenario', color: '#f59e0b'},
            { href: '/analysis', label: 'Heatmap Analysis', sub: 'Density analysis', color: '#2db8b0' },
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
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>{item.label}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{item.sub}</div>
              </div>
            </a>
          ))}
        </div>
      </div>
          /*) : (
            runs.map(run => (
              <tr key={run.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '12px', fontSize: '13px', color: 'var(--text-primary)', fontWeight: '500', textTransform: 'capitalize' }}>
                  {run.disasterType}
                </td>
                <td style={{ padding: '12px', fontSize: '13px', color: 'var(--text-primary)' }}>{run.config?.agentCount ?? 0}</td>
                <td style={{ padding: '12px', fontSize: '13px', color: '#2db8b0', fontWeight: '600' }}>
                  {(((run.results?.evacuatedCount ?? 0) / (run.config?.agentCount ?? 1)) * 100).toFixed(0)}%
                </td>
                <td style={{ padding: '12px', fontSize: '13px', color: 'var(--text-primary)' }}>{run.results?.totalSteps ?? 0}</td>
                <td style={{ padding: '12px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  {run.results?.evacuationTime != null ? `${run.results.evacuationTime.toFixed(1)}s` : '—'}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </> */
  )
}

const QUICK_ACTIONS = [
  { href: '/simulate?disaster=fire', label: 'Fire Simulation', sub: 'High urgency scenario', color: '#ff6b35', icon: '🔥' },
  { href: '/simulate?disaster=earthquake', label: 'Earthquake Simulation', sub: 'Dynamic obstacles scenario', color: '#f59e0b', icon: '🌎' },
  { href: '/analysis', label: 'Heatmap Analysis', sub: 'View density & bottlenecks', color: '#2db8b0', icon: '📊' },
]

function QuickActions() {
  return (
    <>
      <h2 style={{ margin: '0 0 14px', fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>Quick Actions</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
        {QUICK_ACTIONS.map(item => (
          <a key={item.href} href={item.href} style={{
            display: 'flex', alignItems: 'center', gap: '14px',
            padding: '12px 14px', background: '#f8fafc',
            borderRadius: '8px', textDecoration: 'none',
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
    </>
  )
}
