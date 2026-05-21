'use client'

import type { ReactNode } from 'react'

/**
 * Layered "Docker-style" feature container.
 *
 * Each analysis feature sits in its own pill-shaped container with a coloured
 * banner header on top and a clean white body underneath. Inspired by stacked
 * architecture diagrams (Docker / OS / Infrastructure) for clear visual
 * separation between independent analysis layers.
 */
export interface FeatureContainerProps {
  title: string
  subtitle?: string
  /** Solid colour of the header band. */
  accent: string
  /** Text/icon colour against the accent band. */
  accentText?: string
  /** Optional SVG icon shown to the left of the title. */
  icon?: ReactNode
  /** Optional right-side badge label (e.g. "Layer 1"). */
  badge?: string
  /** Optional extra controls slot on the right side of the header. */
  headerRight?: ReactNode
  /** Padding override for the body. */
  bodyPadding?: string
  children: ReactNode
}

export function FeatureContainer({
  title,
  subtitle,
  accent,
  accentText = '#ffffff',
  icon,
  badge,
  headerRight,
  bodyPadding = '24px 28px',
  children,
}: FeatureContainerProps) {
  /* Derive a slightly darker shade for the gradient — adds depth without
   * extra props. Falls back to the accent itself if parsing fails. */
  const accentDark = darkenHex(accent, 0.14)
  const gradient = `linear-gradient(135deg, ${accent} 0%, ${accentDark} 100%)`

  return (
    <div
      data-feature-card
      style={{
        background: '#ffffff',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        overflow: 'hidden',
        boxShadow: '0 4px 14px rgba(15, 23, 42, 0.06), 0 1px 3px rgba(15, 23, 42, 0.04)',
        marginBottom: '20px',
      }}
    >
      {/* Colored header banner with subtle gradient + radial highlight */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        padding: '18px 26px',
        background: gradient,
        backgroundImage: `radial-gradient(circle at 12% 50%, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 55%), ${gradient}`,
        color: accentText,
        position: 'relative',
        borderBottom: `1px solid ${accentDark}`,
      }}>
        {icon && (
          <div style={{
            width: '38px', height: '38px', borderRadius: '11px',
            background: 'rgba(255,255,255,0.24)',
            border: '1px solid rgba(255,255,255,0.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25)',
          }}>
            {icon}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{
            margin: 0, fontSize: '16px', fontWeight: 700,
            color: accentText, letterSpacing: '-0.01em',
            textShadow: '0 1px 1px rgba(0,0,0,0.06)',
          }}>
            {title}
          </h2>
          {subtitle && (
            <p style={{
              margin: '3px 0 0', fontSize: '12px',
              color: accentText, opacity: 0.92,
            }}>
              {subtitle}
            </p>
          )}
        </div>
        {headerRight}
        {badge && (
          <span style={{
            padding: '5px 11px', borderRadius: '999px',
            background: 'rgba(255,255,255,0.22)',
            border: '1px solid rgba(255,255,255,0.18)',
            color: accentText,
            fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em',
            textTransform: 'uppercase',
            flexShrink: 0,
          }}>
            {badge}
          </span>
        )}
      </div>

      {/* White content body */}
      <div style={{ padding: bodyPadding, background: '#ffffff' }}>
        {children}
      </div>
    </div>
  )
}

/* Darken a hex colour by the given fraction (0–1). Used to build the
 * banner gradient automatically from the single `accent` prop. */
function darkenHex(hex: string, amount: number): string {
  const cleaned = hex.replace('#', '')
  if (cleaned.length !== 6) return hex
  const r = parseInt(cleaned.slice(0, 2), 16)
  const g = parseInt(cleaned.slice(2, 4), 16)
  const b = parseInt(cleaned.slice(4, 6), 16)
  const factor = 1 - amount
  const dr = Math.max(0, Math.min(255, Math.round(r * factor)))
  const dg = Math.max(0, Math.min(255, Math.round(g * factor)))
  const db = Math.max(0, Math.min(255, Math.round(b * factor)))
  return `#${dr.toString(16).padStart(2, '0')}${dg.toString(16).padStart(2, '0')}${db.toString(16).padStart(2, '0')}`
}
