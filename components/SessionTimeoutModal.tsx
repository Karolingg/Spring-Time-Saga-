'use client'

interface SessionTimeoutModalProps {
  isOpen: boolean
  secondsRemaining: number
  onStaySignedIn: () => void
  onSignOut: () => void
}

export function SessionTimeoutModal({
  isOpen,
  secondsRemaining,
  onStaySignedIn,
  onSignOut,
}: SessionTimeoutModalProps) {
  if (!isOpen) return null

  return (
    <div
      role="presentation"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1200,
        background: 'rgba(15, 23, 42, 0.42)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-timeout-title"
        style={{
          width: '100%',
          maxWidth: '440px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: '14px',
          boxShadow: 'var(--shadow-md)',
          padding: '28px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'rgba(45, 184, 176, 0.12)',
              color: '#1f9189',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div>
            <h2 id="session-timeout-title" style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Your session is about to expire
            </h2>
            <div style={{ marginTop: '3px', fontSize: '12px', color: 'var(--text-muted)' }}>
              Inactivity timeout
            </div>
          </div>
        </div>

        <p style={{ margin: '0 0 18px', fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          You will be signed out in {Math.max(0, secondsRemaining)} seconds due to inactivity.
        </p>

        <div
          aria-live="polite"
          style={{
            marginBottom: '24px',
            padding: '12px 14px',
            borderRadius: '10px',
            background: 'var(--bg-subtle)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
            fontSize: '13px',
            fontWeight: 600,
          }}
        >
          {Math.max(0, secondsRemaining)} seconds remaining
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button
            type="button"
            onClick={onSignOut}
            style={{
              padding: '9px 16px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: 'var(--bg-card)',
              color: 'var(--text-secondary)',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Sign out
          </button>
          <button
            type="button"
            onClick={onStaySignedIn}
            style={{
              padding: '9px 16px',
              borderRadius: '8px',
              border: 'none',
              background: '#2db8b0',
              color: '#ffffff',
              fontSize: '14px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Stay signed in
          </button>
        </div>
      </div>
    </div>
  )
}
