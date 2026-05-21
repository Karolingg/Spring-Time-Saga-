'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { getSimulationRun, getDensityCells } from '@/src/services/simulation.service'
import { getBuildingById } from '@/src/simulation/building-model'
import { SpatialBottleneckHeatmap } from '@/components/analysis/SpatialBottleneckHeatmap'
import { ExitUtilizationBreakdown } from '@/components/analysis/ExitUtilizationBreakdown'
import type { DensityCell, SimulationRun, SimulationZone } from '@/src/schema/simulation.types'

const REPORT_MAX_ZONES = 6

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

function describeDisaster(type: SimulationRun['disasterType']): string {
  return type === 'fire' ? 'Fire' : 'Earthquake'
}

function describeNarrative(run: SimulationRun): string {
  const results = run.results
  const config = run.config
  if (!results || !config) {
    return 'Run data is incomplete — re-run the simulation to populate full report metrics.'
  }
  const lines: string[] = []
  const incomplete = results.evacuatedCount < config.agentCount
  if (results.maxCongestion >= 75) {
    lines.push(`Peak congestion reached ${results.maxCongestion}%, indicating critical corridor saturation during the run.`)
  }
  if (incomplete) {
    const trapped = config.agentCount - results.evacuatedCount
    lines.push(`${results.evacuatedCount} of ${config.agentCount} occupants reached an exit; ${trapped} were unable to evacuate within the run window.`)
  }
  if (!incomplete && results.maxCongestion < 75) {
    lines.push(`All ${results.evacuatedCount} occupants reached an exit. No corridors hit critical congestion thresholds during the run.`)
  }
  if (results.congestionExposure > 2) {
    lines.push(`Average hazard exposure was ${results.congestionExposure.toFixed(1)} seconds per occupant — review which routes pass closest to hazard zones.`)
  }
  return lines.join(' ')
}

function topZones(zones: SimulationZone[]): SimulationZone[] {
  return [...zones]
    .filter((z) => z.intensity > 0 || z.agentCount > 0 || z.bottleneckCount > 0)
    .sort((a, b) => b.intensity - a.intensity)
    .slice(0, REPORT_MAX_ZONES)
}

function riskColor(level: SimulationZone['riskLevel']): string {
  switch (level) {
    case 'HIGH':
      return '#ef4444'
    case 'MEDIUM':
      return '#f59e0b'
    default:
      return '#22c55e'
  }
}

export default function EvacuationReportPage() {
  const params = useParams()
  const runId = params.runId as string
  const [run, setRun] = useState<SimulationRun | null>(null)
  const [densityCells, setDensityCells] = useState<DensityCell[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [generatedAt] = useState(() => new Date().toLocaleString())

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [data, cells] = await Promise.all([
          getSimulationRun(runId),
          getDensityCells(runId).catch(() => []),
        ])
        if (!cancelled) {
          setRun(data)
          setDensityCells(cells)
        }
      } catch (err) {
        if (!cancelled) setError((err as Error).message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [runId])

  const building = useMemo(() => (run?.buildingId ? getBuildingById(run.buildingId) : null), [run?.buildingId])
  const floorLabel = useMemo(() => {
    if (!building || run?.floorIndex == null) return null
    return building.floors[run.floorIndex]?.label ?? null
  }, [building, run?.floorIndex])

  const featuredZones = useMemo(() => (run ? topZones(run.zones) : []), [run])
  const maxIntensity = useMemo(() => (
    featuredZones.reduce((acc, z) => Math.max(acc, z.intensity), 0)
  ), [featuredZones])

  if (loading) {
    return <ReportShell><div style={{ color: '#64748b' }}>Loading report…</div></ReportShell>
  }
  if (error || !run) {
    return (
      <ReportShell>
        <EmptyState message={error ?? 'No run found with that ID.'} />
      </ReportShell>
    )
  }

  const results = run.results
  const config = run.config
  const narrative = describeNarrative(run)
  const buildingName = building?.name ?? run.buildingId ?? 'Unknown Building'

  return (
    <ReportShell>
      <div className="report-toolbar">
        <button onClick={() => window.print()} className="report-print-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 6 2 18 2 18 9" />
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
            <rect x="6" y="14" width="12" height="8" />
          </svg>
          Print / Save as PDF
        </button>
      </div>

      <header className="report-header">
        <div className="report-tag">EVACSIM · Evacuation Report</div>
        <h1>{buildingName}{floorLabel ? ` — ${floorLabel}` : ''}</h1>
        <div className="report-meta">
          <span><strong>Disaster:</strong> {describeDisaster(run.disasterType)}</span>
          <span><strong>Run:</strong> {run.id.slice(0, 8)}</span>
          <span><strong>Run started:</strong> {formatDateTime(run.createdAt)}</span>
        </div>
      </header>

      <section className="report-kpis">
        <ReportKpi label="Evacuation time" value={results ? `${results.evacuationTime.toFixed(1)}s` : '—'} />
        <ReportKpi label="Evacuated" value={results ? `${results.evacuatedCount} / ${config?.agentCount ?? '—'}` : '—'} />
        <ReportKpi
          label="Max congestion"
          value={results ? `${results.maxCongestion}%` : '—'}
          accent={results && results.maxCongestion >= 75 ? '#ef4444' : undefined}
        />
        <ReportKpi label="Global peak density" value={results ? `${results.globalPeakDensity.toFixed(1)}%` : '—'} />
      </section>

      <section className="report-narrative">
        <h2>Summary</h2>
        <p>{narrative || 'Run completed.'}</p>
      </section>

      {run.buildingId && (
        <section className="report-heatmap">
          <h2>Crowd Heatmap</h2>
          <p className="report-heatmap-caption">
            Spatial density across the floor plan during the drill. Warmer
            areas indicate sustained congestion; cooler greens indicate light
            traffic.
          </p>
          <div className="report-heatmap-shell">
            <SpatialBottleneckHeatmap
              buildingId={run.buildingId}
              zones={run.zones}
              densityCells={densityCells}
              simulatedFloorIndex={run.floorIndex}
              hideHeader
              hazards={run.hazards}
              agentsPerRoom={run.agentsPerRoom}
              seed={run.seed}
              disasterType={run.disasterType}
              agentCount={run.config?.agentCount ?? null}
            />
          </div>
        </section>
      )}

      {run.buildingId && run.floorIndex != null && (
        <section className="report-exits">
          <h2>Exit Utilization</h2>
          <p className="report-exits-caption">
            How evacuees were distributed across the floor&apos;s exits. A heavy
            skew toward one door signals a routing imbalance worth addressing
            with signage or staged release — even when every exit was reachable.
          </p>
          <ExitUtilizationBreakdown
            buildingId={run.buildingId}
            simulatedFloorIndex={run.floorIndex}
            disasterType={run.disasterType}
            hazards={run.hazards}
            agentsPerRoom={run.agentsPerRoom}
            seed={run.seed}
            agentCount={run.config?.agentCount ?? null}
          />
        </section>
      )}

      {featuredZones.length > 0 && (
        <section className="report-zones">
          <h2>Top zones by intensity</h2>
          <table className="report-table">
            <thead>
              <tr>
                <th>Zone</th>
                <th>Intensity</th>
                <th>Bottlenecks</th>
                <th>Risk</th>
              </tr>
            </thead>
            <tbody>
              {featuredZones.map((zone) => (
                <tr key={zone.id}>
                  <td>{zone.zoneName}</td>
                  <td>
                    <div className="report-bar-row">
                      <div className="report-bar-shell">
                        <div
                          className="report-bar-fill"
                          style={{
                            width: maxIntensity > 0 ? `${(zone.intensity / maxIntensity) * 100}%` : '0%',
                            background: riskColor(zone.riskLevel),
                          }}
                        />
                      </div>
                      <span className="report-bar-label">{zone.intensity.toFixed(0)}%</span>
                    </div>
                  </td>
                  <td>{zone.bottleneckCount}</td>
                  <td>
                    <span className="report-risk-pill" style={{ background: `${riskColor(zone.riskLevel)}22`, color: riskColor(zone.riskLevel) }}>
                      {zone.riskLevel}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <footer className="report-footer">
        <span>Generated {generatedAt}</span>
        <span>EVACSIM evacuation analysis</span>
      </footer>
    </ReportShell>
  )
}

function ReportShell({ children }: { children: React.ReactNode }) {
  return (
    <div data-page-shell className="report-page">
      <style>{`
        .report-page {
          max-width: 820px;
          margin: 0 auto;
          padding: 48px 40px 64px;
          color: #0f172a;
          font-family: inherit;
          background: #ffffff;
          min-height: 100vh;
        }
        @media (max-width: 768px) {
          .report-page {
            padding: 24px 14px 40px;
          }
          .report-kpis {
            grid-template-columns: repeat(2, 1fr);
          }
          .report-header h1 {
            font-size: 21px;
          }
          .report-meta {
            gap: 8px 14px;
          }
        }
        .report-toolbar {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 24px;
        }
        .report-print-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          border-radius: 8px;
          border: 1px solid #2db8b0;
          background: #2db8b0;
          color: #ffffff;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }
        .report-header {
          border-bottom: 2px solid #0f172a;
          padding-bottom: 18px;
          margin-bottom: 24px;
        }
        .report-tag {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: #2db8b0;
          margin-bottom: 8px;
        }
        .report-header h1 {
          margin: 0 0 12px;
          font-size: 26px;
          letter-spacing: -0.02em;
        }
        .report-meta {
          display: flex;
          gap: 18px;
          flex-wrap: wrap;
          font-size: 12px;
          color: #475569;
        }
        .report-kpis {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin-bottom: 24px;
        }
        .report-kpi {
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 14px 16px;
          background: #f8fafc;
        }
        .report-kpi-label {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #64748b;
          margin-bottom: 6px;
        }
        .report-kpi-value {
          font-size: 26px;
          font-weight: 700;
          letter-spacing: -0.02em;
        }
        .report-narrative {
          margin-bottom: 24px;
        }
        .report-narrative h2,
        .report-zones h2 {
          font-size: 15px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: #0f172a;
          margin: 0 0 10px;
        }
        .report-narrative p {
          font-size: 14px;
          line-height: 1.65;
          margin: 0;
          color: #1e293b;
        }
        .report-zones {
          margin-bottom: 24px;
        }
        .report-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }
        .report-table th, .report-table td {
          padding: 10px 12px;
          text-align: left;
          border-bottom: 1px solid #e2e8f0;
          vertical-align: middle;
        }
        .report-table th {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #475569;
          background: #f8fafc;
        }
        .report-bar-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .report-bar-shell {
          flex: 1;
          height: 8px;
          background: #e2e8f0;
          border-radius: 4px;
          overflow: hidden;
        }
        .report-bar-fill {
          height: 100%;
          border-radius: 4px;
        }
        .report-bar-label {
          font-size: 11px;
          font-weight: 600;
          color: #475569;
          min-width: 38px;
          text-align: right;
        }
        .report-risk-pill {
          display: inline-block;
          padding: 3px 9px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.06em;
        }
        .report-footer {
          display: flex;
          justify-content: space-between;
          padding-top: 14px;
          border-top: 1px solid #e2e8f0;
          font-size: 11px;
          color: #64748b;
        }
        .report-heatmap {
          margin-bottom: 24px;
        }
        .report-heatmap h2 {
          font-size: 15px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: #0f172a;
          margin: 0 0 8px;
        }
        .report-heatmap-caption {
          font-size: 12px;
          color: #475569;
          margin: 0 0 12px;
          line-height: 1.55;
        }
        .report-heatmap-shell {
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 12px;
          background: #ffffff;
        }
        .report-exits {
          margin-bottom: 24px;
        }
        .report-exits h2 {
          font-size: 15px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: #0f172a;
          margin: 0 0 8px;
        }
        .report-exits-caption {
          font-size: 12px;
          color: #475569;
          margin: 0 0 14px;
          line-height: 1.55;
        }
        @media print {
          .report-page {
            padding: 24px 28px;
            background: #ffffff;
          }
          .report-toolbar { display: none; }
          .report-print-btn { display: none; }
          .report-heatmap-shell {
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .report-exits {
            page-break-inside: avoid;
            break-inside: avoid;
          }
          body { background: #ffffff; }
          @page { margin: 16mm; size: A4; }
        }
      `}</style>
      {children}
    </div>
  )
}

function ReportKpi({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="report-kpi">
      <div className="report-kpi-label">{label}</div>
      <div className="report-kpi-value" style={{ color: accent ?? '#0f172a' }}>{value}</div>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div style={{
      padding: '32px 24px',
      borderRadius: '12px',
      border: '1px dashed #cbd5e1',
      background: '#f8fafc',
      color: '#475569',
      fontSize: '14px',
      textAlign: 'center',
    }}>
      {message}
    </div>
  )
}
