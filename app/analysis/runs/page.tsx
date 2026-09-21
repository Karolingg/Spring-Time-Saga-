'use client'

import { useEffect, useRef, useState } from 'react'
import { useRequireAuth } from '@/src/hooks/useRequireAuth'
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
import { useToast } from '@/src/context/ToastContext'
import { getFriendlyErrorMessage } from '@/src/services/rate-limit.service'
import type { DensityCell, SimulationRun, SimulationZone } from '@/src/schema/simulation.types'
import { PageLoading } from '@/components/ui/PageLoading'
import { CARD_SURFACE } from '@/components/ui/Card'
import { BackLink } from '@/components/ui/BackLink'
import { RunSelect } from '@/components/ui/RunSelect'
import { ACCENT } from '@/src/config/theme'

const SECTION_CARD = { ...CARD_SURFACE, marginBottom: '20px' }




export default function AnalysisRunsPage() {
  const { isAuthenticated, isLoading: isAuthLoading } = useRequireAuth()

  const [run, setRun] = useState<SimulationRun | null>(null)
  const [densityCells, setDensityCells] = useState<DensityCell[]>([])
  const [runHistory, setRunHistory] = useState<SimulationRun[]>([])
  const [isLoadingData, setIsLoadingData] = useState(true)
  const [isConfirmResetOpen, setIsConfirmResetOpen] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deletingRunId, setDeletingRunId] = useState<string | null>(null)
  const [isResettingData, setIsResettingData] = useState(false)
  /** Zone opened in the Zone Analysis panel — marked on the crowd heatmap. */
  const [selectedZoneName, setSelectedZoneName] = useState<string | null>(null)
  const isMutationInFlightRef = useRef(false)
  const { showToast } = useToast()


  useEffect(() => {
    if (!isAuthenticated) return
    loadInitialData()
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
      setRunHistory(history)
    } catch (err) {
      console.error('Failed to load simulation data:', err)
    } finally {
      setIsLoadingData(false)
    }
  }

  async function handleRunChange(selectedRunId: string) {
    setIsLoadingData(true)
    setSelectedZoneName(null)
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
      showToast('Simulation run deleted.', 'success')
    } catch (err) {
      console.error('Failed to delete simulation run:', err)
      showToast(getFriendlyErrorMessage(err, 'Failed to delete simulation run.'), 'error')
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
    try {
      await resetAllSimulationData()
      setRun(null)
      setDensityCells([])
      setRunHistory([])
      showToast('All simulation data deleted.', 'success')
    } catch (err) {
      console.error('Failed to reset simulation data:', err)
      showToast(getFriendlyErrorMessage(err, 'Failed to reset simulation data.'), 'error')
    } finally {
      isMutationInFlightRef.current = false
      setIsResettingData(false)
      setIsConfirmResetOpen(false)
    }
  }

  if (isAuthLoading) {
    return (
      <PageLoading />
    )
  }

  if (!isAuthenticated) return null

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
                highlightedZoneName={selectedZoneName}
              />
            </FeatureContainer>
          )}

          {/* ── Layer 2: Zone Analysis ───────────────────────────── */}
          {hasUsedZones && (
            <FeatureContainer
              title="Zone Analysis"
              subtitle="Per-zone congestion intensity, risk levels, and bottleneck counts"
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              }
            >
              <ZoneAnalysisPanel
                zones={usedZones}
                hideHeader
                onZoneSelect={setSelectedZoneName}
              />
            </FeatureContainer>
          )}

          {/* ── Layer 3: Key Metrics ─────────────────────────────── */}
          <FeatureContainer
            title="Key Metrics"
            subtitle="Aggregate evacuation statistics for this run"
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
              evacuatedCount={evacuatedCount}
              agentCount={agentCount}
            />
          </FeatureContainer>
        </>
      )}

      {!isLoadingData && run && !hasAnalysisData && (
        <div style={{ ...SECTION_CARD, textAlign: 'center', padding: '48px 32px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
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
  runHistory: SimulationRun[]
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
  const { showToast } = useToast()
  const hasRun = currentRun !== null
  const isMutating = isDeleting || isResetting
  return (
    <div style={{ marginBottom: '28px' }}>
      <BackLink href="/analysis" label="Back to analysis" />

      {/* ── Row 1 — identity + navigation/selection ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
        <div style={{
          width: '44px', height: '44px', borderRadius: '12px',
          background: 'rgba(45,184,176,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
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
          fontSize: '12px', fontWeight: 700, letterSpacing: '0.09em',
          textTransform: 'uppercase', color: 'var(--text-muted)', marginRight: '2px',
        }}>
          Actions
        </span>

        <button
          type="button"
          onClick={() => {
            if (!currentRun) return
            try {
              downloadRunCsv(currentRun)
              showToast('CSV exported — check your downloads.', 'success')
            } catch (err) {
              console.error('Failed to export CSV:', err)
              showToast('Failed to export CSV.', 'error')
            }
          }}
          disabled={!hasRun}
          title={hasRun ? 'Download a CSV of this run summary + zones' : 'Load a run to enable export'}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '12px 14px',
            background: hasRun ? 'var(--bg-card)' : 'var(--bg-inset)',
            color: hasRun ? 'var(--text-primary)' : 'var(--text-muted)',
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
            padding: '12px 14px',
            background: hasRun ? 'var(--bg-card)' : 'var(--bg-inset)',
            color: hasRun ? 'var(--text-primary)' : 'var(--text-muted)',
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
            padding: '12px 14px', background: 'var(--bg-card)', color: 'var(--text-primary)',
            borderRadius: '8px', textDecoration: 'none', fontSize: '13px', fontWeight: '600',
            border: '1px solid var(--border)', flexShrink: 0,
          }}
        >
          Compare
        </a>

        <a href="/analysis/summary" style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          padding: '12px 14px', background: 'var(--bg-card)', color: 'var(--text-primary)',
          borderRadius: '8px', textDecoration: 'none', fontSize: '13px', fontWeight: '600',
          border: '1px solid var(--border)', flexShrink: 0,
        }}>
          Summary View
        </a>

        <a href="/map" style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          padding: '12px 20px', background: 'var(--teal-button)', color: '#ffffff',
          borderRadius: '8px', textDecoration: 'none', fontSize: '13px', fontWeight: '600',
          flexShrink: 0, marginLeft: 'auto',
        }}>
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
      background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: 'var(--radius-lg)',
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
          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--status-text-red)' }}>Danger Zone</div>
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
  runHistory: SimulationRun[]
  currentRunId: string
  onRunChange: (id: string) => void
  onRequestDelete: (id: string) => void
  isDisabled: boolean
}

function RunControls({ runHistory, currentRunId, onRunChange, onRequestDelete, isDisabled }: RunControlsProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <RunSelect
        runs={runHistory}
        value={currentRunId}
        onChange={onRunChange}
        disabled={isDisabled}
      />
      <button
        onClick={() => onRequestDelete(currentRunId)}
        disabled={isDisabled}
        title="Delete this simulation run"
        aria-label="Delete this simulation run"
        style={{
          padding: '8px 10px', background: 'rgba(239,68,68,0.08)',
          border: '1px solid rgba(239,68,68,0.35)', borderRadius: '8px',
          color: 'var(--status-text-red)',
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
        <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
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
        background: 'var(--teal-button)', color: '#ffffff', borderRadius: '8px',
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
  evacuatedCount: number
  agentCount: number
}

function SummaryStats({
  zoneCount,
  bottleneckCount,
  avgEvacTime,
  evacuatedPct,
  evacuatedCount,
  agentCount,
}: SummaryStatsProps) {
  /* Only the two figures that carry a verdict are coloured — zones and elapsed
   * time are neutral facts, so they stay in ink. Colouring all four would flatten
   * the hierarchy and leave nothing standing out. */
  const evacTone = evacuatedPct == null
    ? 'var(--text-primary)'
    : evacuatedPct >= 90 ? 'var(--status-text-green)'
    : evacuatedPct >= 70 ? 'var(--status-text-amber)'
    : 'var(--status-text-red)'

  const stats = [
    {
      label: 'Zones analysed',
      value: String(zoneCount),
      tone: 'var(--text-primary)',
      note: 'with recorded activity',
    },
    {
      label: 'Critical bottlenecks',
      value: String(bottleneckCount),
      tone: bottleneckCount > 0 ? 'var(--status-text-amber)' : 'var(--status-text-green)',
      note: bottleneckCount > 0 ? `across ${zoneCount} zones` : 'none recorded',
    },
    {
      label: 'Avg evacuation time',
      value: avgEvacTime,
      tone: 'var(--text-primary)',
      note: 'from first move to last exit',
    },
    {
      label: 'Evacuated',
      value: evacuatedPct != null ? `${evacuatedPct.toFixed(0)}%` : '—',
      tone: evacTone,
      note: agentCount > 0 ? `${evacuatedCount} of ${agentCount} agents` : 'no agents recorded',
    },
  ]

  return (
    <div
      data-grid-2col-mobile
      style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)' }}
    >
      {stats.map((stat, i) => (
        <div
          key={stat.label}
          style={{
            padding: `0 ${i === stats.length - 1 ? '0' : 'var(--space-6)'} 0 ${i === 0 ? '0' : 'var(--space-6)'}`,
            borderRight: i === stats.length - 1 ? 'none' : '1px solid var(--border)',
          }}
        >
          <div style={{
            fontSize: 'var(--text-xs)', fontWeight: 700,
            letterSpacing: '0.1em', textTransform: 'uppercase',
            color: 'var(--text-muted)', marginBottom: '10px',
          }}>
            {stat.label}
          </div>
          <div style={{
            fontSize: '38px', fontWeight: 800, color: stat.tone,
            letterSpacing: '-0.03em', lineHeight: 1,
            fontFeatureSettings: '"tnum"',
          }}>
            {stat.value}
          </div>
          <div style={{
            fontSize: 'var(--text-sm)', color: 'var(--text-secondary)',
            marginTop: '8px', lineHeight: 1.4,
          }}>
            {stat.note}
          </div>
        </div>
      ))}
    </div>
  )
}
