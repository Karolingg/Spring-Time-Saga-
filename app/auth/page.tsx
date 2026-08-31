'use client'

import { useEffect, useState } from 'react'
import { GOOGLE_SIGN_IN_COOLDOWN_MS } from '@/src/config/rate-limits'
import {
  SESSION_TIMEOUT_NOTICE_KEY,
  SESSION_TIMEOUT_NOTICE_VALUE,
} from '@/src/config/session-timeout'
import { loginWithEmail, loginWithGoogle, signUpWithEmail } from '@/src/services/auth.service'

/** Supabase rejects anything shorter, so enforcing it here avoids a round-trip. */
const MIN_PASSWORD_LENGTH = 6

const FIELD_LABEL: React.CSSProperties = {
  display: 'block',
  fontSize: 'var(--text-sm)',
  fontWeight: 600,
  color: 'var(--text-secondary)',
  marginBottom: 'var(--space-2)',
}

/** Shared geometry for the two full-width actions, so they line up exactly. */
const CONTROL: React.CSSProperties = {
  width: '100%',
  height: '44px',
  borderRadius: 'var(--radius-md)',
  fontSize: 'var(--text-md)',
  fontWeight: 600,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 'var(--space-2)',
}

type NoticeTone = 'info' | 'error' | 'success'

const NOTICE_TONES: Record<NoticeTone, { fill: string; line: string; text: string }> = {
  info: { fill: 'var(--teal-light)', line: 'rgba(45,184,176,0.35)', text: 'var(--status-text-teal)' },
  error: { fill: 'rgba(239,68,68,0.10)', line: 'rgba(239,68,68,0.32)', text: 'var(--status-text-red)' },
  success: { fill: 'rgba(34,197,94,0.10)', line: 'rgba(34,197,94,0.32)', text: 'var(--status-text-green)' },
}

const NOTICE_ICONS: Record<NoticeTone, React.ReactNode> = {
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>,
  error: <><path d="M10.3 4.3 2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z" /><path d="M12 10v4M12 17h.01" /></>,
  success: <><circle cx="12" cy="12" r="9" /><path d="m8.5 12.2 2.4 2.4 4.6-4.8" /></>,
}

/** Inline status banner shared by the session, error, and success messages. */
function Notice({ tone, children }: { tone: NoticeTone; children: React.ReactNode }) {
  const palette = NOTICE_TONES[tone]
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 'var(--space-2)',
        marginBottom: 'var(--space-4)',
        padding: '10px 12px',
        background: palette.fill,
        border: `1px solid ${palette.line}`,
        borderRadius: 'var(--radius-sm)',
        color: palette.text,
        fontSize: 'var(--text-base)',
        lineHeight: 1.5,
      }}
    >
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ flexShrink: 0, marginTop: '2px' }}
        aria-hidden="true"
      >
        {NOTICE_ICONS[tone]}
      </svg>
      <span>{children}</span>
    </div>
  )
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [infoMessage, setInfoMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isRegisterMode, setIsRegisterMode] = useState(false)
  const [lastGoogleAttemptAt, setLastGoogleAttemptAt] = useState(0)

  const isBusy = isLoading || isGoogleLoading

  useEffect(() => {
    const timeoutNotice = window.localStorage.getItem(SESSION_TIMEOUT_NOTICE_KEY)
    if (timeoutNotice === SESSION_TIMEOUT_NOTICE_VALUE) {
      window.localStorage.removeItem(SESSION_TIMEOUT_NOTICE_KEY)
      const timeoutId = window.setTimeout(() => {
        setInfoMessage('Your session expired due to inactivity. Please sign in again.')
      }, 0)
      return () => window.clearTimeout(timeoutId)
    }
  }, [])

  async function handleFormSubmit(event: React.FormEvent) {
    event.preventDefault()
    setIsLoading(true)
    setErrorMessage('')
    setSuccessMessage('')
    try {
      if (isRegisterMode) {
        await signUpWithEmail(email, password)
        setSuccessMessage('Account created. Check your email to confirm, then sign in.')
        setIsRegisterMode(false)
      } else {
        await loginWithEmail(email, password)
        window.location.href = '/'
      }
    } catch (err) {
      setErrorMessage((err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleGoogleSignIn() {
    const now = Date.now()
    if (now - lastGoogleAttemptAt < GOOGLE_SIGN_IN_COOLDOWN_MS) {
      setErrorMessage('Please wait a few seconds before trying Google sign-in again.')
      return
    }

    setLastGoogleAttemptAt(now)
    setIsGoogleLoading(true)
    setErrorMessage('')
    setSuccessMessage('')
    try {
      await loginWithGoogle()
    } catch (err) {
      setErrorMessage((err as Error).message)
      setIsGoogleLoading(false)
    }
  }

  function selectMode(registerMode: boolean) {
    if (registerMode === isRegisterMode) return
    setIsRegisterMode(registerMode)
    setErrorMessage('')
    setSuccessMessage('')
    setInfoMessage('')
  }

  return (
    <div
      data-page-shell
      data-auth-shell
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
      }}
    >
      <main style={{ width: '100%', maxWidth: '420px' }}>
        {/* ── Brand lockup ── */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            gap: 'var(--space-4)',
            marginBottom: 'var(--space-8)',
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '18px',
              background: 'linear-gradient(140deg, #35c8bf 0%, #1f9189 100%)',
              boxShadow: '0 10px 26px -10px rgba(45, 184, 176, 0.75), inset 0 1px 0 rgba(255, 255, 255, 0.28)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, letterSpacing: '-0.015em', color: 'var(--text-primary)' }}>
              EVAC<span style={{ color: 'var(--teal)' }}>SIM</span>
            </div>
            <p style={{ margin: '6px auto 0', maxWidth: '300px', fontSize: 'var(--text-base)', lineHeight: 1.55, color: 'var(--text-muted)' }}>
              Crowd evacuation simulator with predictive congestion analysis
            </p>
          </div>
        </div>

        {/* ── Auth card ── */}
        <div
          className="fade-in-up"
          style={{
            background: 'var(--bg-card)',
            borderRadius: 'var(--radius-xl)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-md)',
            padding: 'clamp(24px, 6vw, 32px)',
          }}
        >
          {/* Mode switch — segmented, so registering is one click away rather
              than a footnote under the fold. */}
          <div
            role="group"
            aria-label="Choose sign in or account creation"
            style={{
              display: 'flex',
              gap: '4px',
              padding: '4px',
              background: 'var(--bg-inset)',
              borderRadius: 'var(--radius-md)',
              marginBottom: 'var(--space-6)',
            }}
          >
            {[
              { label: 'Sign in', register: false },
              { label: 'Create account', register: true },
            ].map(mode => {
              const isActive = mode.register === isRegisterMode
              return (
                <button
                  key={mode.label}
                  type="button"
                  onClick={() => selectMode(mode.register)}
                  aria-pressed={isActive}
                  disabled={isBusy}
                  style={{
                    flex: 1,
                    padding: '8px 10px',
                    border: 'none',
                    borderRadius: 'var(--radius-xs)',
                    background: isActive ? 'var(--bg-card)' : 'transparent',
                    boxShadow: isActive ? 'var(--shadow)' : 'none',
                    color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                    fontSize: 'var(--text-base)',
                    fontWeight: 600,
                    cursor: isBusy ? 'not-allowed' : 'pointer',
                    transition: 'background 150ms ease, color 150ms ease, box-shadow 150ms ease',
                  }}
                >
                  {mode.label}
                </button>
              )
            })}
          </div>

          <h1 style={{ margin: 0, fontSize: 'var(--text-xl)', fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>
            {isRegisterMode ? 'Create your account' : 'Welcome back'}
          </h1>
          <p style={{ margin: '6px 0 var(--space-6)', fontSize: 'var(--text-base)', color: 'var(--text-muted)' }}>
            {isRegisterMode
              ? 'Set up an operator account to run and share simulations.'
              : 'Sign in to continue to your simulation workspace.'}
          </p>

          {infoMessage && <Notice tone="info">{infoMessage}</Notice>}
          {errorMessage && <Notice tone="error">{errorMessage}</Notice>}
          {successMessage && <Notice tone="success">{successMessage}</Notice>}

          <form onSubmit={handleFormSubmit}>
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <label htmlFor="auth-email" style={FIELD_LABEL}>Email</label>
              <input
                id="auth-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="operator@evacsim.io"
                required
                autoComplete="email"
                disabled={isBusy}
                className="input-field"
                style={{ height: '44px', fontSize: 'var(--text-md)' }}
              />
            </div>

            <div style={{ marginBottom: 'var(--space-6)' }}>
              <label htmlFor="auth-password" style={FIELD_LABEL}>Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="auth-password"
                  type={isPasswordVisible ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={isRegisterMode ? `At least ${MIN_PASSWORD_LENGTH} characters` : 'Enter your password'}
                  required
                  minLength={isRegisterMode ? MIN_PASSWORD_LENGTH : undefined}
                  autoComplete={isRegisterMode ? 'new-password' : 'current-password'}
                  disabled={isBusy}
                  className="input-field"
                  style={{ height: '44px', paddingRight: '44px', fontSize: 'var(--text-md)' }}
                />
                <button
                  type="button"
                  onClick={() => setIsPasswordVisible(visible => !visible)}
                  aria-label={isPasswordVisible ? 'Hide password' : 'Show password'}
                  aria-pressed={isPasswordVisible}
                  disabled={isBusy}
                  style={{
                    position: 'absolute',
                    top: '50%',
                    right: '6px',
                    transform: 'translateY(-50%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '32px',
                    height: '32px',
                    padding: 0,
                    border: 'none',
                    borderRadius: 'var(--radius-xs)',
                    background: 'transparent',
                    color: 'var(--text-muted)',
                    cursor: isBusy ? 'not-allowed' : 'pointer',
                  }}
                >
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M2.2 12S5.6 5.5 12 5.5 21.8 12 21.8 12 18.4 18.5 12 18.5 2.2 12 2.2 12Z" />
                    <circle cx="12" cy="12" r="3" />
                    {!isPasswordVisible && <path d="m4 20 16-16" />}
                  </svg>
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isBusy}
              className="hover-darken"
              style={{
                ...CONTROL,
                background: 'var(--teal)',
                border: 'none',
                boxShadow: '0 6px 16px -8px rgba(45, 184, 176, 0.9)',
                color: '#ffffff',
                cursor: isBusy ? 'not-allowed' : 'pointer',
                opacity: isBusy ? 0.65 : 1,
              }}
            >
              {isLoading ? (
                <span
                  className="spinner"
                  style={{ width: '15px', height: '15px', borderColor: 'rgba(255, 255, 255, 0.4)', borderTopColor: '#ffffff' }}
                  aria-hidden="true"
                />
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
              )}
              {isLoading
                ? (isRegisterMode ? 'Creating account...' : 'Signing in...')
                : (isRegisterMode ? 'Create account' : 'Sign in')}
            </button>
          </form>

          <div style={{ margin: 'var(--space-6) 0', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div style={{ flex: 1, borderTop: '1px solid var(--border)' }} />
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', fontWeight: 500, whiteSpace: 'nowrap' }}>
              or continue with
            </span>
            <div style={{ flex: 1, borderTop: '1px solid var(--border)' }} />
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isBusy}
            style={{
              ...CONTROL,
              background: 'var(--bg-card)',
              border: '1px solid var(--border-strong)',
              color: 'var(--text-primary)',
              cursor: isBusy ? 'not-allowed' : 'pointer',
              transition: 'background 150ms ease',
              opacity: isLoading ? 0.65 : 1,
            }}
            onMouseEnter={e => {
              if (isBusy) return
              e.currentTarget.style.background = 'var(--bg-subtle)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'var(--bg-card)'
            }}
          >
            {isGoogleLoading ? (
              <span className="spinner" style={{ width: '15px', height: '15px' }} aria-hidden="true" />
            ) : (
              <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
            )}
            {isGoogleLoading ? 'Connecting...' : 'Google'}
          </button>
        </div>

        <p style={{ margin: 'var(--space-6) 0 0', textAlign: 'center', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
          {isRegisterMode
            ? 'Already have an account? Switch to Sign in above.'
            : 'New here? Choose Create account above to get started.'}
        </p>
      </main>
    </div>
  )
}
