'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/src/config/supabase'

export default function AuthCallbackPage() {
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'error'>('loading')

  useEffect(() => {
    const code = new URL(window.location.href).searchParams.get('code')
    const error = new URL(window.location.href).searchParams.get('error')

    if (error) {
      setStatus('error')
      setTimeout(() => router.replace('/auth'), 2000)
      return
    }

    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error: exchError }) => {
        if (exchError) {
          setStatus('error')
          setTimeout(() => router.replace('/auth'), 2000)
        } else {
          router.replace('/')
        }
      })
    } else {
      router.replace('/')
    }
  }, [router])

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#eef0f2',
      backgroundImage: `
        linear-gradient(rgba(0,0,0,0.04) 1px, transparent 1px),
        linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px)
      `,
      backgroundSize: '32px 32px',
      gap: '16px',
    }}>
      <div style={{
        width: '68px',
        height: '68px',
        borderRadius: '20px',
        background: 'rgba(45,184,176,0.12)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {status === 'loading' ? (
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2db8b0" strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83">
              <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite"/>
            </path>
          </svg>
        ) : (
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        )}
      </div>

      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '15px', fontWeight: '600', color: '#1a2332' }}>
          {status === 'loading' ? 'Signing you in…' : 'Something went wrong'}
        </div>
        <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
          {status === 'loading' ? 'Just a moment' : 'Redirecting back to login…'}
        </div>
      </div>
    </div>
  )
}
