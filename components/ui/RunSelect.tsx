'use client'

import type { SimulationRun } from '@/src/schema/simulation.types'
import { relativeTime } from '@/src/utils/format'

/**
 * One label for a run, wherever a run is listed. The two pickers used to
 * format this differently, so the same run read differently depending on which
 * page you were on.
 */
export function formatRunLabel(run: SimulationRun): string {
  const disaster = run.disasterType === 'fire' ? 'Fire' : 'Earthquake'
  const agents = run.config?.agentCount ?? 0
  return `${disaster} · ${agents} agents · ${relativeTime(run.createdAt)}`
}

interface RunSelectProps {
  runs: SimulationRun[]
  /** Currently selected run id, or '' when nothing is picked. */
  value: string
  onChange: (runId: string) => void
  /** Shown as an empty first option — omit to require a selection. */
  placeholder?: string
  disabled?: boolean
  fullWidth?: boolean
  'aria-label'?: string
}

/** Picker for a completed simulation run. */
export function RunSelect({
  runs,
  value,
  onChange,
  placeholder,
  disabled = false,
  fullWidth = false,
  'aria-label': ariaLabel = 'Select a simulation run',
}: RunSelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      aria-label={ariaLabel}
      style={{
        padding: '9px 12px',
        borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--border)',
        fontSize: 'var(--text-base)',
        color: 'var(--text-primary)',
        background: 'var(--bg-card)',
        width: fullWidth ? '100%' : undefined,
        maxWidth: fullWidth ? undefined : '320px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.7 : 1,
      }}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {runs.map((run) => (
        <option key={run.id} value={run.id}>{formatRunLabel(run)}</option>
      ))}
    </select>
  )
}
