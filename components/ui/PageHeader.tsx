import { CSSProperties, ReactNode } from 'react'

interface PageHeaderProps {
  /** Icon SVG; the caller controls its stroke color (usually the teal accent). */
  icon: ReactNode
  title: string
  subtitle?: string
  /** Right-aligned action buttons/links. */
  actions?: ReactNode
  /** Background tint of the icon chip. */
  chipBackground?: string
  /** Compact sizing for mobile layouts. */
  dense?: boolean
  style?: CSSProperties
}

/**
 * The standard page header: tinted icon chip + title + subtitle, with an
 * optional action area on the right. Extracted from the identical inline
 * pattern previously duplicated on the map/analysis/settings/about pages.
 */
export function PageHeader({ icon, title, subtitle, actions, chipBackground = 'var(--teal-light)', dense = false, style }: PageHeaderProps) {
  const chipSize = dense ? 38 : 44
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: dense ? 'var(--space-3)' : 'var(--space-4)',
      marginBottom: dense ? 'var(--space-4)' : 'var(--space-6)',
      flexWrap: 'wrap',
      ...style,
    }}>
      <div style={{
        width: `${chipSize}px`,
        height: `${chipSize}px`,
        borderRadius: 'var(--radius)',
        background: chipBackground,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        {icon}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <h1 style={{
          margin: subtitle ? '0 0 4px' : 0,
          fontSize: dense ? 'var(--text-xl)' : 'var(--text-2xl)',
          fontWeight: 700,
          color: 'var(--text-primary)',
          letterSpacing: '-0.02em',
          lineHeight: 1.2,
        }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{ margin: 0, fontSize: dense ? 'var(--text-sm)' : 'var(--text-base)', color: 'var(--text-secondary)' }}>
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexShrink: 0, flexWrap: 'wrap', alignItems: 'center' }}>
          {actions}
        </div>
      )}
    </div>
  )
}
