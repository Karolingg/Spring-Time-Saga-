import type { SimulationZone } from '@/src/schema/simulation.types'

const RISK_COLORS: Record<string, string> = {
  CRITICAL: '#ef4444',
  HIGH: '#ef4444',
  MEDIUM: '#f59e0b',
  LOW: '#22c55e',
}

/** Text-safe counterparts to RISK_COLORS — the vivid hues above stay for the
 * pill fills, but only reach ~2.2-3.8:1 as text on a light card. */
const RISK_TEXT_COLORS: Record<string, string> = {
  CRITICAL: 'var(--status-text-red)',
  HIGH: 'var(--status-text-red)',
  MEDIUM: 'var(--status-text-amber)',
  LOW: 'var(--status-text-green)',
}

const TABLE_COLUMNS = ['Building', 'Risk', 'Agents', 'Bottlenecks']

interface BuildingRiskTableProps {
  zones: SimulationZone[]
  subtitle?: string
}

export function BuildingRiskTable({ zones, subtitle = 'Based on latest simulation run' }: BuildingRiskTableProps) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2db8b0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
        </svg>
        <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>Building Risk Assessment</span>
      </div>
      <p style={{ margin: '0 0 16px', fontSize: '12px', color: 'var(--text-secondary)' }}>{subtitle}</p>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            {TABLE_COLUMNS.map(col => (
              <th key={col} style={{
                padding: '8px 12px', textAlign: 'left', fontSize: '11px',
                fontWeight: '600', letterSpacing: '0.06em',
                color: 'var(--text-muted)', textTransform: 'uppercase' as const,
              }}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {zones.map((zone, i) => {
            const riskColor = RISK_COLORS[zone.riskLevel] ?? '#22c55e'
            const riskTextColor = RISK_TEXT_COLORS[zone.riskLevel] ?? 'var(--status-text-green)'
            return (
              <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '12px', fontSize: '13px', color: 'var(--text-primary)', fontWeight: '500' }}>{zone.zoneName}</td>
                <td style={{ padding: '12px' }}>
                  <span style={{
                    display: 'inline-block', padding: '3px 10px', borderRadius: '20px',
                    background: `${riskColor}18`, color: riskTextColor,
                    fontSize: '11px', fontWeight: '700', letterSpacing: '0.04em',
                  }}>{zone.riskLevel}</span>
                </td>
                <td style={{ padding: '12px', fontSize: '13px', color: 'var(--text-primary)' }}>{zone.agentCount}</td>
                <td style={{ padding: '12px', fontSize: '13px', color: zone.bottleneckCount > 0 ? 'var(--status-text-red)' : 'var(--status-text-green)', fontWeight: '600' }}>
                  {zone.bottleneckCount}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
