interface PageLoadingProps {
  /** Text shown beside the spinner; also what screen readers announce. */
  label?: string
}

/**
 * The full-viewport loading gate every auth-guarded page shows while
 * `useAuth()` resolves. Extracted from the identical inline block that was
 * duplicated across the map/analysis/settings/about/simulate pages.
 *
 * Two things it fixes over the copies it replaces: the wait is announced via
 * `role="status"`, and the wrapper no longer paints an opaque `--bg` over the
 * body's ambient gradient — that repaint was visible as a flash when the page
 * resolved, and as a seam under `.app-ui-scale-shell`'s zoom, which makes a
 * child's 100vh shorter than the real viewport.
 */
export function PageLoading({ label = 'Loading...' }: PageLoadingProps) {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'var(--space-6)',
    }}>
      <div
        role="status"
        aria-live="polite"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
          color: 'var(--text-secondary)',
          fontSize: 'var(--text-md)',
        }}
      >
        <span className="spinner" aria-hidden="true" />
        {label}
      </div>
    </div>
  )
}
