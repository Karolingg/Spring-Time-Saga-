'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/src/hooks/useAuth'
import {
  getLatestSimulationRun,
  getSimulationHistory,
  getSimulationRun,
  deleteSimulationRun,
  resetAllSimulationData,
  getDensityCells,
} from '@/src/services/simulation.service'
import { CongestionHeatmap } from '@/components/analysis/CongestionHeatmap'
import { RunVisualization } from '@/components/analysis/RunVisualization'
import { BuildingRiskTable } from '@/components/analysis/BuildingRiskTable'
import { ConfirmModal } from '@/components/ConfirmModal'
import { downloadRunCsv } from '@/src/services/csv-export'
import type { DensityCell, SimulationRun, SimulationZone } from '@/src/schema/simulation.types'

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

export default function AnalysisRunsPage() {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth()

  const [run, setRun] = useState<SimulationRun | null>(null)
  const [densityCells, setDensityCells] = useState<DensityCell[]>([])
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
      setDensityCells(latest ? await getDensityCells(latest.id) : [])
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
      setDensityCells(await getDensityCells(selectedRunId))
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
          setDensityCells([])
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
      setDensityCells([])
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
  const usedZones = zones.filter((zone: SimulationZone) => (
    zone.agentCount > 0 || zone.intensity > 0 || zone.bottleneckCount > 0
  ))
  const bottleneckCount = usedZones.reduce((sum, z) => sum + z.bottleneckCount, 0)
  const avgEvacTime = run?.results?.evacuationTime != null ? `${run.results.evacuationTime.toFixed(1)}s` : '—'
  const hasUsedZones = usedZones.length > 0
  const hasDensityCells = densityCells.length > 0
  const hasAnalysisData = hasUsedZones || hasDensityCells

  return (
    <div style={{ minHeight: '100vh', padding: '88px 40px 56px', maxWidth: '1280px', margin: '0 auto' }}>

      <PageHeader
        runHistory={runHistory}
        currentRunId={run?.id ?? ''}
        currentRun={run}
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

      {!isLoadingData && run && hasAnalysisData && (
        <>
          {run.buildingId && (
            <div style={SECTION_CARD}>
              <RunVisualization
                buildingId={run.buildingId}
                simulatedFloorIndex={run.floorIndex}
                densityCells={densityCells}
                zones={usedZones}
                agentCount={run.config?.agentCount ?? null}
                disasterType={run.disasterType}
                hazards={run.hazards}
                agentsPerRoom={run.agentsPerRoom}
                seed={run.seed}
              />
            </div>
          )}

          {hasUsedZones && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
              <div style={{ ...SECTION_CARD, marginBottom: 0 }}>
                <CongestionHeatmap zones={usedZones} />
              </div>
              <div style={{ ...SECTION_CARD, marginBottom: 0 }}>
                <BuildingRiskTable zones={usedZones} />
              </div>
            </div>
          )}

          <SummaryStats
            zoneCount={usedZones.length}
            bottleneckCount={bottleneckCount}
            avgEvacTime={avgEvacTime}
          />
        </>
      )}

      {!isLoadingData && run && !hasAnalysisData && (
        <div style={{ ...SECTION_CARD, textAlign: 'center', padding: '48px 32px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#2db8b0" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M9 15l1.8-4.8L15 9l-1.8 4.8L9 15z" />
            </svg>
          </div>
          <h2 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)' }}>
            No movement recorded
          </h2>
          <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>
            This run did not record any traveled zones yet. Try another run to see heatmap results.
          </p>
        </div>
      )}

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
  currentRun: SimulationRun | null
  onRunChange: (id: string) => void
  onRequestDelete: (id: string) => void
  onRequestReset: () => void
}

function PageHeader({ runHistory, currentRunId, currentRun, onRunChange, onRequestDelete, onRequestReset }: PageHeaderProps) {
  const hasRun = currentRun !== null
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '32px', flexWrap: 'wrap' }}>
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
          Run Analysis
        </h1>
        <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>
          Crowd heatmap and bottleneck identification
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

        <button
          type="button"
          onClick={() => currentRun && downloadRunCsv(currentRun)}
          disabled={!hasRun}
          title={hasRun ? 'Download a CSV of this run summary + zones' : 'Load a run to enable export'}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '8px 14px',
            background: hasRun ? '#ffffff' : '#f1f5f9',
            color: hasRun ? '#0f172a' : '#94a3b8',
            borderRadius: '8px', fontSize: '13px', fontWeight: '600',
            border: '1px solid var(--border)',
            cursor: hasRun ? 'pointer' : 'not-allowed',
            flexShrink: 0,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Export CSV
        </button>

        <a
          href={hasRun && currentRun ? `/analysis/reports/${currentRun.id}` : undefined}
          target={hasRun ? '_blank' : undefined}
          rel={hasRun ? 'noopener noreferrer' : undefined}
          onClick={(event) => { if (!hasRun) event.preventDefault() }}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '8px 14px',
            background: hasRun ? '#ffffff' : '#f1f5f9',
            color: hasRun ? '#0f172a' : '#94a3b8',
            borderRadius: '8px', textDecoration: 'none', fontSize: '13px', fontWeight: '600',
            border: '1px solid var(--border)',
            cursor: hasRun ? 'pointer' : 'not-allowed',
            flexShrink: 0,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="9" y1="13" x2="15" y2="13" />
            <line x1="9" y1="17" x2="15" y2="17" />
          </svg>
          Generate Report
        </a>

        <a
          href={hasRun && currentRun ? `/analysis/compare?a=${currentRun.id}` : '/analysis/compare'}
          title={hasRun ? 'Compare this run against another' : 'Open the comparison view'}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '8px 14px', background: '#ffffff', color: '#0f172a',
            borderRadius: '8px', textDecoration: 'none', fontSize: '13px', fontWeight: '600',
            border: '1px solid var(--border)', flexShrink: 0,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h6" /><path d="M3 12h6" /><path d="M3 18h6" />
            <path d="M15 6h6" /><path d="M15 12h6" /><path d="M15 18h6" />
          </svg>
          Compare
        </a>

        <a href="/analysis/summary" style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          padding: '8px 14px', background: '#ffffff', color: '#0f172a',
          borderRadius: '8px', textDecoration: 'none', fontSize: '13px', fontWeight: '600',
          border: '1px solid var(--border)', flexShrink: 0,
        }}>
          Summary View
        </a>

        <a href="/map" style={{
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
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
        <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="#2db8b0" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M9 3v18M15 3v18M3 9h18M3 15h18" />
          <circle cx="15" cy="9" r="2.2" />
        </svg>
      </div>
      <h2 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)' }}>
        No Completed Simulations Yet
      </h2>
      <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>
        Run and complete a simulation first to see heatmap analysis here.
      </p>
      <a href="/map" style={{
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
    {
      label: 'Total Zones Analyzed',
      value: String(zoneCount),
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2db8b0" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2V6z" />
          <path d="M9 4v14M15 6v14" />
        </svg>
      ),
    },
    {
      label: 'Critical Bottlenecks',
      value: String(bottleneckCount),
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3l9 16H3L12 3z" />
          <path d="M12 9v4" />
          <circle cx="12" cy="16.5" r="0.7" fill="#f59e0b" />
        </svg>
      ),
    },
    {
      label: 'Avg Evacuation Time',
      value: avgEvacTime,
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2db8b0" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="13" r="8" />
          <path d="M12 13l3-2" />
          <path d="M12 5V3" />
        </svg>
      ),
    },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '8px' }}>
      {stats.map((stat, i) => (
        <div key={i} style={{
          background: '#ffffff', border: '1px solid var(--border)',
          borderRadius: '14px', padding: '28px 24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)', textAlign: 'center',
        }}>
          <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'center' }}>{stat.icon}</div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{stat.value}</div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>{stat.label}</div>
        </div>
      ))}
    </div>
  )
}
