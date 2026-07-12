import { ReactNode } from 'react'
import { Card } from './Card'

export interface StatCardProps {
  /** Icon SVG; the caller controls its stroke color to match `color`. */
  icon: ReactNode
  label: string
  value: string
  sub: string
  /** Accent for the icon chip tint and the progress bar. */
  color: string
  /** 0–100; renders a slim progress bar under the value when provided. */
  progress?: number
  /** Shows a shimmer skeleton in place of the value. */
  loading?: boolean
}

/**
 * KPI tile: tinted icon chip, uppercase label, large numeric value with an
 * optional progress bar and sub-caption. Skeletons while loading. Shared by
 * the dashboard; reuse anywhere a metric tile is needed.
 */
export function StatCard({ icon, label, value, sub, color, progress, loading }: StatCardProps) {
  return (
    <Card hover padding="22px 24px">
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
        <div style={{
          width: '32px', height: '32px', borderRadius: '9px',
          background: `${color}16`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          {icon}
        </div>
        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, letterSpacing: '0.08em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
          {label}
        </span>
      </div>
      {loading ? (
        <span className="skeleton" style={{ width: '72px', height: '32px' }} />
      ) : (
        <div style={{ fontSize: 'var(--text-num)', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1 }}>
          {value}
        </div>
      )}
      {progress !== undefined && (
        <div style={{ margin: '10px 0 4px', height: '4px', background: 'var(--bg-inset)', borderRadius: '2px' }}>
          <div style={{
            height: '100%', width: `${Math.min(progress, 100)}%`, background: color, borderRadius: '2px',
            transition: 'width 0.6s ease',
          }} />
        </div>
      )}
      <div style={{ fontSize: 'var(--text-base)', color: 'var(--text-secondary)', marginTop: '6px' }}>{sub}</div>
    </Card>
  )
}
