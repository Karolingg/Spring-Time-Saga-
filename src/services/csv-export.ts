import type { SimulationRun } from '@/src/schema/simulation.types'

/**
 * CSV builder for stakeholder run exports.
 *
 * The output is two sections separated by a blank line:
 *   A. Single-row run summary.
 *   B. Zero or more zone rows (one per SimulationZone).
 *
 * Spec: docs/feature-specs.md §2 — column names and order are stable so
 * stakeholders can pivot the file in Excel/Sheets without remapping headers.
 */

const RUN_HEADERS = [
  'run_id',
  'created_at',
  'building_id',
  'disaster_type',
  'agent_count',
  'total_steps',
  'evacuated_count',
  'evacuation_time_seconds',
  'max_congestion_percent',
  'congestion_exposure',
  'global_peak_density',
] as const

const ZONE_HEADERS = [
  'zone_name',
  'intensity_percent',
  'agent_count',
  'bottleneck_count',
  'risk_level',
  'lat',
  'lng',
] as const

/** Wrap a value for safe CSV inclusion. Commas, quotes, and newlines force
 *  quoting; empty / nullish stays empty so missing fields stay blank (per spec). */
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  const raw = typeof value === 'string' ? value : String(value)
  if (raw === '') return ''
  if (/[",\n\r]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`
  }
  return raw
}

function csvRow(values: unknown[]): string {
  return values.map(csvCell).join(',')
}

export function buildRunCsv(run: SimulationRun): string {
  const results = run.results
  const config = run.config

  const runRow = [
    run.id,
    run.createdAt,
    run.buildingId,
    run.disasterType,
    config?.agentCount,
    results?.totalSteps,
    results?.evacuatedCount,
    results?.evacuationTime,
    results?.maxCongestion,
    results?.congestionExposure,
    results?.globalPeakDensity,
  ]

  const lines: string[] = [
    csvRow([...RUN_HEADERS]),
    csvRow(runRow),
    '',
    csvRow([...ZONE_HEADERS]),
  ]

  for (const zone of run.zones) {
    lines.push(csvRow([
      zone.zoneName,
      zone.intensity,
      zone.agentCount,
      zone.bottleneckCount,
      zone.riskLevel,
      zone.lat,
      zone.lng,
    ]))
  }

  return lines.join('\r\n') + '\r\n'
}

export function buildRunCsvFilename(runId: string, createdAt: string): string {
  const datePart = new Date(createdAt).toISOString().slice(0, 10).replace(/-/g, '')
  return `evacsim_run_${runId.slice(0, 8)}_${datePart}.csv`
}

export function downloadRunCsv(run: SimulationRun): void {
  if (typeof window === 'undefined') return
  const csv = buildRunCsv(run)
  const filename = buildRunCsvFilename(run.id, run.createdAt)
  // Prepend the UTF-8 BOM so Excel opens the file with the correct encoding —
  // without it, accented characters render as mojibake in Excel for Windows.
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}
