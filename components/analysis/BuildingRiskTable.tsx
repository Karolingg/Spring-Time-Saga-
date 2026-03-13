import type { SimulationZone } from '@/src/schema/simulation.types'

const RISK_COLORS: Record<string, string> = {
  CRITICAL: '#ef4444',
  HIGH: '#ef4444',
  MEDIUM: '#f59e0b',
  LOW: '#22c55e',
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
            return (
              <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '12px', fontSize: '13px', color: 'var(--text-primary)', fontWeight: '500' }}>{zone.zoneName}</td>
                <td style={{ padding: '12px' }}>
                  <span style={{
                    display: 'inline-block', padding: '3px 10px', borderRadius: '20px',
                    background: `${riskColor}18`, color: riskColor,
                    fontSize: '11px', fontWeight: '700', letterSpacing: '0.04em',
                  }}>{zone.riskLevel}</span>
                </td>
                <td style={{ padding: '12px', fontSize: '13px', color: 'var(--text-primary)' }}>{zone.agentCount}</td>
                <td style={{ padding: '12px', fontSize: '13px', color: zone.bottleneckCount > 0 ? '#ef4444' : '#22c55e', fontWeight: '600' }}>
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
