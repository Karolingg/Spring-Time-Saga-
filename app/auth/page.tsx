'use client'

import { useState } from 'react'
import { GOOGLE_SIGN_IN_COOLDOWN_MS } from '@/src/config/rate-limits'
import { loginWithGoogle } from '@/src/services/auth.service'

export default function LoginPage() {
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [lastGoogleAttemptAt, setLastGoogleAttemptAt] = useState(0)

  async function handleGoogleSignIn() {
    const now = Date.now()
    if (now - lastGoogleAttemptAt < GOOGLE_SIGN_IN_COOLDOWN_MS) {
      setErrorMessage('Please wait a few seconds before trying Google sign-in again.')
      return
    }

    setLastGoogleAttemptAt(now)
    setIsGoogleLoading(true)
    setErrorMessage('')
    try {
      await loginWithGoogle()
      // Supabase redirects away from this page.
    } catch (err) {
      setErrorMessage((err as Error).message)
      setIsGoogleLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      backgroundColor: '#eef0f2',
      backgroundImage: `
        linear-gradient(rgba(0,0,0,0.04) 1px, transparent 1px),
        linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px)
      `,
      backgroundSize: '32px 32px',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '36px', gap: '14px' }}>
        <div style={{
          width: '68px',
          height: '68px',
          borderRadius: '20px',
          background: 'rgba(45,184,176,0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#2db8b0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
          </svg>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '26px', fontWeight: '800', color: '#1a2332' }}>
            EVAC<span style={{ color: '#2db8b0' }}>SIM</span>
          </div>
          <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
            Crowd Evacuation Simulator with Predictive Congestion Analysis
          </div>
        </div>
      </div>

      <div style={{
        background: '#ffffff',
        borderRadius: '20px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
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
          <h1 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#1a2332' }}>
            Sign in with Google
          </h1>
        </div>

        <p style={{ margin: '0 0 24px', fontSize: '13px', color: '#64748b', lineHeight: 1.5 }}>
          Use your Google account to access EVACSIM simulations, saved runs, and readiness analytics.
        </p>

        {errorMessage && (
          <div style={{
            marginBottom: '16px',
            padding: '10px 14px',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            color: '#dc2626',
            fontSize: '13px',
          }}>
            {errorMessage}
          </div>
        )}

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={isGoogleLoading}
          style={{
            width: '100%',
            padding: '12px 20px',
            background: isGoogleLoading ? '#f8fafc' : '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '999px',
            color: '#40403e',
            fontSize: '14px',
            fontWeight: '600',
            cursor: isGoogleLoading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            transition: 'background 0.15s, box-shadow 0.15s',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          }}
          onMouseEnter={e => {
            if (!isGoogleLoading) {
              e.currentTarget.style.background = '#f8fafc'
              e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.12)'
            }
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = isGoogleLoading ? '#f8fafc' : '#ffffff'
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
      </div>
    </div>
  )
}
