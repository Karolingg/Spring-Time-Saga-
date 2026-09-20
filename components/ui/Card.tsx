import { CSSProperties, ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  /** Inner padding; defaults to the standard section-card inset. */
  padding?: string
  /** Adds the hover-raise lift effect for clickable/scannable cards. */
  hover?: boolean
  className?: string
  /** Merged last, so callers can override any base style (e.g. marginBottom). */
  style?: CSSProperties
}

/**
 * The app's standard surface, as a plain style object. Prefer the `Card`
 * component below; this is for call sites that need to spread the surface
 * into an existing element's inline styles rather than wrap it.
 */
export const CARD_SURFACE: CSSProperties = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg)',
  padding: 'var(--space-7) var(--space-8)',
  boxShadow: 'var(--shadow)',
}

/**
 * The app's standard white surface: card background, hairline border,
 * rounded corners, and a soft shadow — all driven by theme variables so
 * it flips correctly in dark mode. Replaces the per-page SECTION_CARD
 * style objects that used to be copy-pasted around.
 */
export function Card({ children, padding = 'var(--space-7) var(--space-8)', hover = false, className, style }: CardProps) {
  const classes = [hover ? 'hover-raise' : '', className ?? ''].filter(Boolean).join(' ')
  return (
    <div
      className={classes || undefined}
      style={{
        ...CARD_SURFACE,
        padding,
        ...style,
      }}
    >
      {children}
    </div>
  )
}
