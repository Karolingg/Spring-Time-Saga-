'use client';

import { useAuth } from '../../src/context/auth-context';

const ACCENT_COLOR = '#00ffb4';

export function AuthBar() {
  const { isAuthenticated, isLoading, user, handleLogout } = useAuth();

  if (isLoading) {
    return null;
  }

  const userEmail = (user as { email?: string } | null)?.email ?? 'Unknown';

  function handleLogoutClick() {
    handleLogout();
  }

  function handleLoginClick() {
    window.location.href = '/auth';
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        padding: '0 32px',
        height: '40px',
      }}
    >
      {isAuthenticated ? (
        <>
          <span
            style={{
              fontSize: '10px',
              letterSpacing: '0.12em',
              color: '#555',
              fontFamily: 'monospace',
              textTransform: 'uppercase',
            }}
          >
            {userEmail}
          </span>
          <button
            onClick={handleLogoutClick}
            style={{
              background: 'rgba(255,60,60,0.08)',
              border: '1px solid rgba(255,60,60,0.25)',
              borderRadius: '2px',
              color: '#ff6b6b',
              fontFamily: 'monospace',
              fontSize: '9px',
              fontWeight: '700',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              padding: '4px 12px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            LOGOUT
          </button>
        </>
      ) : (
        <button
          onClick={handleLoginClick}
          style={{
            background: `rgba(0,255,180,0.08)`,
            border: `1px solid ${ACCENT_COLOR}33`,
            borderRadius: '2px',
            color: ACCENT_COLOR,
            fontFamily: 'monospace',
            fontSize: '9px',
            fontWeight: '700',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            padding: '4px 12px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          LOGIN
        </button>
      )}
    </div>
  );
}
