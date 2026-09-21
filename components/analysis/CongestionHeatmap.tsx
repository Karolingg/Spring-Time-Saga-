import type { SimulationZone } from '@/src/schema/simulation.types'
import { CONGESTION_BANDS, bandFor } from '@/src/config/congestion'
import { ACCENT } from '@/src/config/theme'

function getIntensityColor(intensity: number): string {
  return bandFor(intensity).color
}

interface CongestionHeatmapProps {
  zones: SimulationZone[]
  title?: string
  subtitle?: string
}

export function CongestionHeatmap({ zones, title = 'Congestion Zones', subtitle }: CongestionHeatmapProps) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
        </svg>
        <span style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.1em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
          {title}
        </span>
      </div>
      {subtitle && (
        <p style={{ margin: '0 0 12px', fontSize: '12px', color: 'var(--text-secondary)' }}>{subtitle}</p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {zones.map((zone, i) => {
          const color = getIntensityColor(zone.intensity)
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)', minWidth: '140px' }}>{zone.zoneName}</span>
              <div style={{ flex: 1, height: '8px', background: 'var(--bg-inset)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${zone.intensity}%`,
                  background: color, borderRadius: '4px', transition: 'width 0.6s ease',
                }} />
              </div>
              <span style={{ fontSize: '12px', fontWeight: '600', color, minWidth: '36px', textAlign: 'right' }}>
                {zone.intensity.toFixed(0)}%
              </span>
            </div>
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: '16px', marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
        {CONGESTION_BANDS.map(item => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: item.color }} />
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
