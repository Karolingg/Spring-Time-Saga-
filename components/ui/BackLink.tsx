import { CSSProperties } from 'react'

interface BackLinkProps {
  href: string
  /** e.g. "Back to analysis" — name the destination, not just "Back". */
  label: string
  style?: CSSProperties
}

/**
 * Quiet breadcrumb-style link back up a level, sitting above the page header.
 * Hierarchical navigation reads differently from the page's actions, so it
 * stays out of the header's action cluster.
 */
export function BackLink({ href, label, style }: BackLinkProps) {
  return (
    <a
      href={href}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        color: 'var(--text-secondary)',
        fontSize: 'var(--text-base)',
        textDecoration: 'none',
        marginBottom: 'var(--space-4)',
        ...style,
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6" />
      </svg>
      {label}
    </a>
  )
}
