'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/src/hooks/useAuth'
import {
  getLatestSimulationRun,
  getSimulationHistory,
  getSimulationRun,
  deleteSimulationRun,
  resetAllSimulationData,
} from '@/src/services/simulation.service'
import { CongestionHeatmap } from '@/components/analysis/CongestionHeatmap'
import { BuildingRiskTable } from '@/components/analysis/BuildingRiskTable'
import { AggregateAnalysis } from '@/components/analysis/AggregateAnalysis'
import { ConfirmModal } from '@/components/ConfirmModal'
import type { SimulationRun } from '@/src/schema/simulation.types'

const SECTION_CARD: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid var(--border)',
  borderRadius: '14px',
  padding: '28px 32px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  marginBottom: '20px',
}

interface RunHistoryItem {
  id: string
  label: string
}

export default function AnalysisPage() {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth()

  const [run, setRun] = useState<SimulationRun | null>(null)
  const [runHistory, setRunHistory] = useState<RunHistoryItem[]>([])
  const [isLoadingData, setIsLoadingData] = useState(true)
  const [isConfirmResetOpen, setIsConfirmResetOpen] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      window.location.href = '/auth'
    }
  }, [isAuthLoading, isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated) return
    loadInitialData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated])

  async function loadInitialData() {
    setIsLoadingData(true)
    try {
      const [latest, history] = await Promise.all([
        getLatestSimulationRun(),
        getSimulationHistory(20),
      ])
      setRun(latest)
      setRunHistory(buildRunHistory(history))
    } catch (err) {
      console.error('Failed to load simulation data:', err)
    } finally {
      setIsLoadingData(false)
    }
  }

  function buildRunHistory(runs: SimulationRun[]): RunHistoryItem[] {
    return runs.map(r => ({
      id: r.id,
      label: `${r.disasterType} — ${r.config?.agentCount ?? 0} agents (${new Date(r.createdAt).toLocaleString()})`,
    }))
  }

  async function handleRunChange(selectedRunId: string) {
    setIsLoadingData(true)
    try {
      const selected = await getSimulationRun(selectedRunId)
      setRun(selected)
    } catch (err) {
      console.error('Failed to load simulation run:', err)
    } finally {
      setIsLoadingData(false)
    }
  }

  async function handleDeleteRun(runId: string) {
    try {
      await deleteSimulationRun(runId)
      const wasCurrentRun = run?.id === runId
      const updatedHistory = runHistory.filter(r => r.id !== runId)
      setRunHistory(updatedHistory)

      if (wasCurrentRun) {
        if (updatedHistory.length > 0) {
          await handleRunChange(updatedHistory[0].id)
        } else {
          setRun(null)
        }
      }
    } catch (err) {
      console.error('Failed to delete simulation run:', err)
    } finally {
      setConfirmDeleteId(null)
    }
  }

  async function handleResetAll() {
    try {
      await resetAllSimulationData()
      setRun(null)
      setRunHistory([])
    } catch (err) {
      console.error('Failed to reset simulation data:', err)
    } finally {
      setIsConfirmResetOpen(false)
    }
  }

  if (isAuthLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Loading...</div>
      </div>
    )
  }

  const zones = run?.zones ?? []
  const bottleneckCount = zones.reduce((sum, z) => sum + z.bottleneckCount, 0)
  const avgEvacTime = run?.results?.evacuationTime != null ? `${run.results.evacuationTime.toFixed(1)}s` : '—'

  return (
    <div style={{ minHeight: '100vh', padding: '88px 40px 56px', maxWidth: '1280px', margin: '0 auto' }}>

      <PageHeader
        runHistory={runHistory}
        currentRunId={run?.id ?? ''}
        onRunChange={handleRunChange}
        onRequestDelete={id => setConfirmDeleteId(id)}
        onRequestReset={() => setIsConfirmResetOpen(true)}
      />

      {isLoadingData && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-secondary)', fontSize: '14px' }}>
          Loading simulation data...
        </div>
      )}

      {!isLoadingData && !run && <EmptyState />}

      {!isLoadingData && run && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
            <div style={{ ...SECTION_CARD, marginBottom: 0 }}>
              <CongestionHeatmap zones={zones} />
            </div>
            <div style={{ ...SECTION_CARD, marginBottom: 0 }}>
              <BuildingRiskTable zones={zones} />
            </div>
          </div>

          <SummaryStats
            zoneCount={zones.length}
            bottleneckCount={bottleneckCount}
            avgEvacTime={avgEvacTime}
          />
        </>
      )}

      <SectionDivider label="All Simulations — Aggregate Analysis" />
      <AggregateAnalysis />

      <ConfirmModal
        isOpen={isConfirmResetOpen}
        title="Reset All Simulation Data"
        message="This will permanently delete all simulation runs and their data. This action cannot be undone."
        confirmLabel="Delete All"
        onConfirm={handleResetAll}
        onCancel={() => setIsConfirmResetOpen(false)}
      />

      <ConfirmModal
        isOpen={confirmDeleteId !== null}
        title="Delete Simulation Run"
        message="This will permanently delete this simulation run and all its data. This action cannot be undone."
        confirmLabel="Delete Run"
        onConfirm={() => confirmDeleteId && handleDeleteRun(confirmDeleteId)}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface PageHeaderProps {
  runHistory: RunHistoryItem[]
  currentRunId: string
  onRunChange: (id: string) => void
  onRequestDelete: (id: string) => void
  onRequestReset: () => void
}

function PageHeader({ runHistory, currentRunId, onRunChange, onRequestDelete, onRequestReset }: PageHeaderProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '32px', flexWrap: 'wrap' }}>
      <div style={{
        width: '44px', height: '44px', borderRadius: '12px',
        background: 'rgba(45,184,176,0.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2db8b0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 3v18h18"/><path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"/>
        </svg>
      </div>
      <div style={{ flex: 1 }}>
        <h1 style={{ margin: 0, fontSize: '26px', fontWeight: '700', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
          Heatmap Analysis
        </h1>
        <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>
          Congestion density and bottleneck identification
        </p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        {runHistory.length > 0 && (
          <RunControls
            runHistory={runHistory}
            currentRunId={currentRunId}
            onRunChange={onRunChange}
            onRequestDelete={onRequestDelete}
          />
        )}

        <a href="/simulate?disaster=fire" style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          padding: '8px 14px', background: '#2db8b0', color: '#ffffff',
          borderRadius: '8px', textDecoration: 'none', fontSize: '13px', fontWeight: '600', flexShrink: 0,
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
          </svg>
          New Simulation
        </a>

        <button
          onClick={onRequestReset}
          style={{
            padding: '8px 14px', background: '#ffffff',
            border: '1px solid #ef4444', borderRadius: '8px',
            fontSize: '13px', fontWeight: '600', color: '#ef4444', cursor: 'pointer', flexShrink: 0,
          }}
        >
          Reset All Data
        </button>
      </div>
    </div>
  )
}

interface RunControlsProps {
  runHistory: RunHistoryItem[]
  currentRunId: string
  onRunChange: (id: string) => void
  onRequestDelete: (id: string) => void
}

function RunControls({ runHistory, currentRunId, onRunChange, onRequestDelete }: RunControlsProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <select
        onChange={e => onRunChange(e.target.value)}
        value={currentRunId}
        style={{
          padding: '8px 12px', borderRadius: '8px',
          border: '1px solid var(--border)', fontSize: '12px',
          color: 'var(--text-primary)', background: '#ffffff',
          maxWidth: '320px',
        }}
      >
        {runHistory.map(r => (
          <option key={r.id} value={r.id}>{r.label}</option>
        ))}
      </select>
      <button
        onClick={() => onRequestDelete(currentRunId)}
        title="Delete this simulation run"
        style={{
          padding: '8px 10px', background: '#fff5f5',
          border: '1px solid #fecaca', borderRadius: '8px',
          color: '#ef4444', cursor: 'pointer', flexShrink: 0,
          display: 'flex', alignItems: 'center',
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
          <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
        </svg>
      </button>
    </div>
  )
}

function EmptyState() {
  return (
    <div style={{ ...SECTION_CARD, textAlign: 'center', padding: '60px 32px' }}>
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
      <h2 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)' }}>
        No Completed Simulations Yet
      </h2>
      <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>
        Run and complete a simulation first to see heatmap analysis here.
      </p>
      <a href="/simulate?disaster=fire" style={{
        display: 'inline-block', marginTop: '16px', padding: '10px 20px',
        background: '#2db8b0', color: '#ffffff', borderRadius: '8px',
        textDecoration: 'none', fontSize: '14px', fontWeight: '600',
      }}>
        Run Simulation
      </a>
    </div>
  )
}

interface SummaryStatsProps {
  zoneCount: number
  bottleneckCount: number
  avgEvacTime: string
}

function SummaryStats({ zoneCount, bottleneckCount, avgEvacTime }: SummaryStatsProps) {
  const stats = [
    { label: 'Total Zones Analyzed', value: String(zoneCount), icon: '🗺' },
    { label: 'Critical Bottlenecks', value: String(bottleneckCount), icon: '⚠️' },
    { label: 'Avg Evacuation Time', value: avgEvacTime, icon: '⏱' },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '8px' }}>
      {stats.map((stat, i) => (
        <div key={i} style={{
          background: '#ffffff', border: '1px solid var(--border)',
          borderRadius: '14px', padding: '28px 24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)', textAlign: 'center',
        }}>
          <div style={{ fontSize: '28px', marginBottom: '8px' }}>{stat.icon}</div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{stat.value}</div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>{stat.label}</div>
        </div>
      ))}
    </div>
  )
}

interface SectionDividerProps {
  label: string
}

function SectionDivider({ label }: SectionDividerProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', margin: '32px 0 20px' }}>
      <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
      <span style={{
        fontSize: '11px', fontWeight: '700', letterSpacing: '0.1em',
        color: 'var(--text-muted)', textTransform: 'uppercase', whiteSpace: 'nowrap',
      }}>
        {label}
      </span>
      <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
    </div>
  )
}
