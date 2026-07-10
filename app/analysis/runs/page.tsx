'use client'

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/src/hooks/useAuth'
import {
  getLatestSimulationRun,
  getSimulationHistory,
  getSimulationRun,
  deleteSimulationRun,
  resetAllSimulationData,
  getDensityCells,
} from '@/src/services/simulation.service'
import { RunVisualization } from '@/components/analysis/RunVisualization'
import { ZoneAnalysisPanel } from '@/components/analysis/ZoneAnalysisPanel'
import { FeatureContainer } from '@/components/analysis/FeatureContainer'
import { ConfirmModal } from '@/components/ConfirmModal'
import { downloadRunCsv } from '@/src/services/csv-export'
import { getFriendlyErrorMessage } from '@/src/services/rate-limit.service'
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

/** Compact relative-time label, e.g. "2h ago" — keeps the run selector
 *  scannable instead of a 40-character datetime string. */
function relativeTime(dateStr: string): string {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

export default function AnalysisRunsPage() {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth()

  const [run, setRun] = useState<SimulationRun | null>(null)
  const [densityCells, setDensityCells] = useState<DensityCell[]>([])
  const [runHistory, setRunHistory] = useState<RunHistoryItem[]>([])
  const [isLoadingData, setIsLoadingData] = useState(true)
  const [isConfirmResetOpen, setIsConfirmResetOpen] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deletingRunId, setDeletingRunId] = useState<string | null>(null)
  const [isResettingData, setIsResettingData] = useState(false)
  const [actionMessage, setActionMessage] = useState('')
  const [isActionError, setIsActionError] = useState(false)
  const isMutationInFlightRef = useRef(false)

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
    return runs.map(r => {
      const type = r.disasterType.charAt(0).toUpperCase() + r.disasterType.slice(1)
      return {
        id: r.id,
        label: `${type} · ${r.config?.agentCount ?? 0} agents · ${relativeTime(r.createdAt)}`,
      }
    })
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
    if (isMutationInFlightRef.current || deletingRunId !== null || isResettingData) return

    isMutationInFlightRef.current = true
    setDeletingRunId(runId)
    setActionMessage('')
    setIsActionError(false)
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
      setIsActionError(true)
      setActionMessage(getFriendlyErrorMessage(err, 'Failed to delete simulation run.'))
    } finally {
      isMutationInFlightRef.current = false
      setDeletingRunId(null)
      setConfirmDeleteId(null)
    }
  }

  async function handleResetAll() {
    if (isMutationInFlightRef.current || isResettingData || deletingRunId !== null) return

    isMutationInFlightRef.current = true
    setIsResettingData(true)
    setActionMessage('')
    setIsActionError(false)
    try {
      await resetAllSimulationData()
      setRun(null)
      setDensityCells([])
      setRunHistory([])
    } catch (err) {
      console.error('Failed to reset simulation data:', err)
      setIsActionError(true)
      setActionMessage(getFriendlyErrorMessage(err, 'Failed to reset simulation data.'))
    } finally {
      isMutationInFlightRef.current = false
      setIsResettingData(false)
      setIsConfirmResetOpen(false)
    }
  }

  if (isAuthLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div style={{ color: 'var(--text-secondary)', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}><span className="spinner" />Loading...</div>
      </div>
    )
  }

  const zones = run?.zones ?? []
  const usedZones = zones.filter((zone: SimulationZone) => (
    zone.agentCount > 0 || zone.intensity > 0 || zone.bottleneckCount > 0
  ))
  const bottleneckCount = usedZones.reduce((sum, z) => sum + z.bottleneckCount, 0)
  const avgEvacTime = run?.results?.evacuationTime != null ? `${run.results.evacuationTime.toFixed(1)}s` : '—'
  const agentCount = run?.config?.agentCount ?? 0
  const evacuatedCount = run?.results?.evacuatedCount ?? 0
  const evacuatedPct = agentCount > 0 ? (evacuatedCount / agentCount) * 100 : null
  const hasUsedZones = usedZones.length > 0
  const hasDensityCells = densityCells.length > 0
  const hasAnalysisData = hasUsedZones || hasDensityCells

  return (
    <div data-page-shell style={{ minHeight: '100vh', padding: '88px 40px 56px', maxWidth: '1280px', margin: '0 auto' }}>

      <PageHeader
        runHistory={runHistory}
        currentRunId={run?.id ?? ''}
        currentRun={run}
        onRunChange={handleRunChange}
        onRequestDelete={id => setConfirmDeleteId(id)}
        isDeleting={deletingRunId !== null}
        isResetting={isResettingData}
      />

      {actionMessage && (
        <div style={{
          marginBottom: '20px',
          padding: '12px 14px',
          borderRadius: '10px',
          background: isActionError ? '#fef2f2' : '#ecfdf5',
          border: `1px solid ${isActionError ? '#fecaca' : '#bbf7d0'}`,
          color: isActionError ? '#b91c1c' : '#166534',
          fontSize: '13px',
        }}>
          {actionMessage}
        </div>
      )}

      {isLoadingData && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-secondary)', fontSize: '14px' }}>
          Loading simulation data...
        </div>
      )}

      {!isLoadingData && !run && <EmptyState />}

      {!isLoadingData && run && hasAnalysisData && (
        <>
          {/* ── Layer 1: Crowd Heatmap & Replay ─────────────────── */}
          {run.buildingId && (
            <FeatureContainer
              title="Crowd Heatmap & Replay"
              subtitle="Spatial density map and time-lapse replay of agent movement"
              accent="#2db8b0"
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M9 3v18M15 3v18M3 9h18M3 15h18" />
                </svg>
              }
            >
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
            </FeatureContainer>
          )}

          {/* ── Layer 2: Zone Analysis ───────────────────────────── */}
          {hasUsedZones && (
            <FeatureContainer
              title="Zone Analysis"
              subtitle="Per-zone congestion intensity, risk levels, and bottleneck counts"
              accent="#2db8b0"
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              }
            >
              <ZoneAnalysisPanel zones={usedZones} hideHeader />
            </FeatureContainer>
          )}

          {/* ── Layer 3: Key Metrics ─────────────────────────────── */}
          <FeatureContainer
            title="Key Metrics"
            subtitle="Aggregate evacuation statistics for this run"
            accent="#2db8b0"
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 3v18h18" />
                <path d="M7 14l4-4 4 4 5-5" />
              </svg>
            }
          >
            <SummaryStats
              zoneCount={usedZones.length}
              bottleneckCount={bottleneckCount}
              avgEvacTime={avgEvacTime}
              evacuatedPct={evacuatedPct}
            />
          </FeatureContainer>
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

      {/* ── Danger zone — destructive reset, kept well away from navigation ── */}
      {!isLoadingData && runHistory.length > 0 && (
        <DangerZone
          onRequestReset={() => setIsConfirmResetOpen(true)}
          isResetting={isResettingData}
          isDisabled={isResettingData || deletingRunId !== null}
        />
      )}

      <ConfirmModal
        isOpen={isConfirmResetOpen}
        title="Reset All Simulation Data"
        message="This will permanently delete all simulation runs and their data. This action cannot be undone."
        confirmLabel={isResettingData ? 'Deleting...' : 'Delete All'}
        isConfirming={isResettingData}
        onConfirm={handleResetAll}
        onCancel={() => {
          if (!isResettingData) setIsConfirmResetOpen(false)
        }}
      />

      <ConfirmModal
        isOpen={confirmDeleteId !== null}
        title="Delete Simulation Run"
        message="This will permanently delete this simulation run and all its data. This action cannot be undone."
        confirmLabel={deletingRunId !== null ? 'Deleting...' : 'Delete Run'}
        isConfirming={deletingRunId !== null}
        onConfirm={() => confirmDeleteId && handleDeleteRun(confirmDeleteId)}
        onCancel={() => {
          if (deletingRunId === null) setConfirmDeleteId(null)
        }}
      />
    </div>
  )
}

interface PageHeaderProps {
  runHistory: RunHistoryItem[]
  currentRunId: string
  currentRun: SimulationRun | null
  onRunChange: (id: string) => void
  onRequestDelete: (id: string) => void
  isDeleting: boolean
  isResetting: boolean
}

function PageHeader({
  runHistory,
  currentRunId,
  currentRun,
  onRunChange,
  onRequestDelete,
  isDeleting,
  isResetting,
}: PageHeaderProps) {
  const hasRun = currentRun !== null
  const isMutating = isDeleting || isResetting
  return (
    <div style={{ marginBottom: '28px' }}>
      {/* ── Row 1 — identity + navigation/selection ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
        <div style={{
          width: '44px', height: '44px', borderRadius: '12px',
          background: 'rgba(45,184,176,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2db8b0" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3v18h18"/><path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"/>
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <h1 style={{ margin: 0, fontSize: '26px', fontWeight: '700', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Run Analysis
          </h1>
          <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>
            Crowd heatmap and bottleneck identification
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <a href="/analysis" style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '8px 14px', background: '#ffffff', color: '#0f172a',
            borderRadius: '8px', textDecoration: 'none', fontSize: '13px', fontWeight: '600',
            border: '1px solid var(--border)', flexShrink: 0,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back to analysis
          </a>
          {runHistory.length > 0 && (
            <RunControls
              runHistory={runHistory}
              currentRunId={currentRunId}
              onRunChange={onRunChange}
              onRequestDelete={onRequestDelete}
              isDisabled={isMutating}
            />
          )}
        </div>
      </div>

      {/* ── Row 2 — run actions, separated from navigation ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap',
        marginTop: '18px', paddingTop: '18px',
        borderTop: '1px solid var(--border)',
      }}>
        <span style={{
          fontSize: '11px', fontWeight: 700, letterSpacing: '0.09em',
          textTransform: 'uppercase', color: 'var(--text-muted)', marginRight: '2px',
        }}>
          Actions
        </span>

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
          borderRadius: '8px', textDecoration: 'none', fontSize: '13px', fontWeight: '600',
          flexShrink: 0, marginLeft: 'auto',
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
          </svg>
          New Simulation
        </a>
      </div>
    </div>
  )
}

/** Destructive "reset everything" control, isolated in its own red-bordered
 *  card at the very bottom of the page — well away from the navigation and
 *  action toolbars so it can't be clicked by accident during a demo. */
function DangerZone({ onRequestReset, isResetting, isDisabled }: {
  onRequestReset: () => void
  isResetting: boolean
  isDisabled: boolean
}) {
  return (
    <div style={{
      marginTop: '32px', padding: '20px 24px',
      background: '#fffbfb', border: '1px solid #fecaca', borderRadius: '14px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: '16px', flexWrap: 'wrap',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '220px', flex: 1 }}>
        <div style={{
          width: '40px', height: '40px', borderRadius: '10px',
          background: 'rgba(239,68,68,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#b91c1c' }}>Danger Zone</div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Permanently delete every simulation run and all associated analysis data. This cannot be undone.
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={onRequestReset}
        disabled={isDisabled}
        style={{
          padding: '9px 16px',
          background: isDisabled ? '#fca5a5' : '#ef4444',
          color: '#ffffff', border: 'none', borderRadius: '8px',
          fontSize: '13px', fontWeight: 700,
          cursor: isDisabled ? 'not-allowed' : 'pointer',
          flexShrink: 0,
        }}
      >
        {isResetting ? 'Resetting...' : 'Reset All Data'}
      </button>
    </div>
  )
}

interface RunControlsProps {
  runHistory: RunHistoryItem[]
  currentRunId: string
  onRunChange: (id: string) => void
  onRequestDelete: (id: string) => void
  isDisabled: boolean
}

function RunControls({ runHistory, currentRunId, onRunChange, onRequestDelete, isDisabled }: RunControlsProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <select
        onChange={e => onRunChange(e.target.value)}
        value={currentRunId}
        disabled={isDisabled}
        style={{
          padding: '8px 12px', borderRadius: '8px',
          border: '1px solid var(--border)', fontSize: '12px',
          color: 'var(--text-primary)', background: '#ffffff',
          maxWidth: '320px',
          cursor: isDisabled ? 'not-allowed' : 'default',
          opacity: isDisabled ? 0.7 : 1,
        }}
      >
        {runHistory.map(r => (
          <option key={r.id} value={r.id}>{r.label}</option>
        ))}
      </select>
      <button
        onClick={() => onRequestDelete(currentRunId)}
        disabled={isDisabled}
        title="Delete this simulation run"
        style={{
          padding: '8px 10px', background: '#fff5f5',
          border: '1px solid #fecaca', borderRadius: '8px',
          color: '#ef4444',
          cursor: isDisabled ? 'not-allowed' : 'pointer',
          opacity: isDisabled ? 0.55 : 1,
          flexShrink: 0,
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
  evacuatedPct: number | null
}

function SummaryStats({ zoneCount, bottleneckCount, avgEvacTime, evacuatedPct }: SummaryStatsProps) {
  const evacAccent = evacuatedPct == null
    ? '#94a3b8'
    : evacuatedPct >= 90 ? '#22c55e'
    : evacuatedPct >= 70 ? '#f59e0b'
    : '#ef4444'

  const stats = [
    {
      label: 'Total Zones Analyzed',
      value: String(zoneCount),
      accent: '#2db8b0',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2V6z" />
          <path d="M9 4v14M15 6v14" />
        </svg>
      ),
    },
    {
      label: 'Critical Bottlenecks',
      value: String(bottleneckCount),
      accent: bottleneckCount > 0 ? '#f59e0b' : '#22c55e',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3l9 16H3L12 3z" />
          <path d="M12 9v4" />
          <circle cx="12" cy="16.5" r="0.7" fill="currentColor" />
        </svg>
      ),
    },
    {
      label: 'Avg Evacuation Time',
      value: avgEvacTime,
      accent: '#2db8b0',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="13" r="8" />
          <path d="M12 13l3-2" />
          <path d="M12 5V3" />
        </svg>
      ),
    },
    {
      label: 'Evacuated',
      value: evacuatedPct != null ? `${evacuatedPct.toFixed(0)}%` : '—',
      accent: evacAccent,
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      ),
    },
  ]

  return (
    <div data-grid-2col-mobile style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
      {stats.map((stat, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: '14px',
          padding: '18px 20px',
          background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
        }}>
          <div style={{
            width: '46px', height: '46px', borderRadius: '12px',
            background: `${stat.accent}15`, color: stat.accent,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            {stat.icon}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: '24px', fontWeight: 800,
              color: 'var(--text-primary)',
              letterSpacing: '-0.02em', lineHeight: 1,
              fontFeatureSettings: '"tnum"',
            }}>
              {stat.value}
            </div>
            <div style={{
              fontSize: '12px', color: 'var(--text-secondary)',
              marginTop: '4px', fontWeight: 500,
            }}>
              {stat.label}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
