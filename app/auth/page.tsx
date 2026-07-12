'use client'

import { useEffect, useState } from 'react'
import { GOOGLE_SIGN_IN_COOLDOWN_MS } from '@/src/config/rate-limits'
import {
  SESSION_TIMEOUT_NOTICE_KEY,
  SESSION_TIMEOUT_NOTICE_VALUE,
} from '@/src/config/session-timeout'
import { loginWithEmail, loginWithGoogle, signUpWithEmail } from '@/src/services/auth.service'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [infoMessage, setInfoMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isRegisterMode, setIsRegisterMode] = useState(false)
  const [lastGoogleAttemptAt, setLastGoogleAttemptAt] = useState(0)

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

  function handleToggleMode() {
    setIsRegisterMode(prev => !prev)
    setErrorMessage('')
    setSuccessMessage('')
  }

  return (
    <div data-page-shell style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      backgroundColor: 'var(--bg)',
      backgroundImage: `
        linear-gradient(var(--border) 1px, transparent 1px),
        linear-gradient(90deg, var(--border) 1px, transparent 1px)
      `,
      backgroundSize: '32px 32px',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '36px', gap: '14px' }}>
        <div style={{
          width: '68px',
          height: '68px',
          borderRadius: '20px',
          background: 'linear-gradient(135deg, #2db8b0 0%, #1f9189 100%)',
          boxShadow: '0 8px 20px -6px rgba(45, 184, 176, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
          </svg>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '26px', fontWeight: '800', color: 'var(--text-primary)' }}>
            EVAC<span style={{ color: '#2db8b0' }}>SIM</span>
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Crowd Evacuation Simulator with Predictive Congestion Analysis
          </div>
        </div>
      </div>

      <div className="fade-in-up" style={{
        background: 'var(--bg-card)',
        borderRadius: '20px',
        border: '1px solid var(--border)',
        boxShadow: '0 12px 40px -12px rgba(15, 23, 42, 0.18)',
        padding: '44px 48px',
        width: '100%',
        maxWidth: '480px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
          <div style={{
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            border: '2px solid #2db8b0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#2db8b0' }} />
          </div>
          <h1 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)' }}>
            {isRegisterMode ? 'Create Account' : 'Sign In'}
          </h1>
        </div>

        <form onSubmit={handleFormSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              fontSize: '11px',
              fontWeight: '600',
              letterSpacing: '0.08em',
              color: 'var(--text-secondary)',
              textTransform: 'uppercase',
              marginBottom: '6px',
            }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="operator@evacsim.io"
              required
              disabled={isLoading || isGoogleLoading}
              className="input-field"
              style={{ fontSize: '14px' }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: '11px',
              fontWeight: '600',
              letterSpacing: '0.08em',
              color: 'var(--text-secondary)',
              textTransform: 'uppercase',
              marginBottom: '6px',
            }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="********"
              required
              disabled={isLoading || isGoogleLoading}
              className="input-field"
              style={{ fontSize: '14px' }}
            />
          </div>

          {infoMessage && (
            <div style={{
              marginBottom: '16px',
              padding: '10px 14px',
              background: 'rgba(59,130,246,0.1)',
              border: '1px solid rgba(59,130,246,0.35)',
              borderRadius: '8px',
              color: '#3b82f6',
              fontSize: '13px',
            }}>
              {infoMessage}
            </div>
          )}

          {errorMessage && (
            <div style={{
              marginBottom: '16px',
              padding: '10px 14px',
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.35)',
              borderRadius: '8px',
              color: '#ef4444',
              fontSize: '13px',
            }}>
              {errorMessage}
            </div>
          )}

          {successMessage && (
            <div style={{
              marginBottom: '16px',
              padding: '10px 14px',
              background: 'rgba(34,197,94,0.1)',
              border: '1px solid rgba(34,197,94,0.35)',
              borderRadius: '8px',
              color: '#22c55e',
              fontSize: '13px',
            }}>
              {successMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || isGoogleLoading}
            className="hover-darken"
            style={{
              width: '100%',
              padding: '12px',
              background: isLoading ? '#94e0db' : '#2db8b0',
              border: 'none',
              borderRadius: '8px',
              boxShadow: '0 4px 12px -4px rgba(45, 184, 176, 0.5)',
              color: '#ffffff',
              fontSize: '14px',
              fontWeight: '600',
              cursor: (isLoading || isGoogleLoading) ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'background 0.15s',
              opacity: isGoogleLoading ? 0.6 : 1,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
            </svg>
            {isLoading
              ? (isRegisterMode ? 'Creating...' : 'Signing in...')
              : (isRegisterMode ? 'Create Account' : 'Sign In')}
          </button>
        </form>

        <div style={{ margin: '20px 0', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ flex: 1, borderTop: '1px solid var(--border)' }} />
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '500' }}>or</span>
          <div style={{ flex: 1, borderTop: '1px solid var(--border)' }} />
        </div>

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={isGoogleLoading || isLoading}
          style={{
            width: '100%',
            padding: '12px 20px',
            background: isGoogleLoading ? 'var(--bg-subtle)' : 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '999px',
            color: 'var(--text-primary)',
            fontSize: '14px',
            fontWeight: '600',
            cursor: (isGoogleLoading || isLoading) ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            transition: 'background 0.15s, box-shadow 0.15s',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            opacity: isLoading ? 0.6 : 1,
          }}
          onMouseEnter={e => {
            if (!isGoogleLoading && !isLoading) {
              e.currentTarget.style.background = 'var(--bg-subtle)'
              e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.12)'
            }
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = isGoogleLoading ? 'var(--bg-subtle)' : 'var(--bg-card)'
            e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)'
          }}
        >
          {isGoogleLoading ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83">
                <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite"/>
              </path>
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          )}
          {isGoogleLoading ? 'Connecting...' : 'Continue with Google'}
        </button>

        <div style={{ margin: '16px 0 0', borderTop: '1px solid var(--border)' }} />

        <div style={{ textAlign: 'center' }}>
          <button
            type="button"
            onClick={handleToggleMode}
            disabled={isLoading || isGoogleLoading}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              fontSize: '13px',
              cursor: (isLoading || isGoogleLoading) ? 'not-allowed' : 'pointer',
              padding: '12px 0 0',
            }}
          >
            {isRegisterMode ? 'Already have an account? ' : "Don't have an account? "}
            <span style={{ color: '#2db8b0', fontWeight: 600 }}>
              {isRegisterMode ? 'Sign in' : 'Sign up'}
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
