'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/src/hooks/useAuth'
import { updateUserEmail, updateUserPassword } from '@/src/services/user.service'

type Section = 'profile' | 'security'

const inputBase: React.CSSProperties = {
  width: '100%', padding: '10px 14px', background: '#f8fafc',
  border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px',
  color: '#1a2332', outline: 'none', boxSizing: 'border-box',
  transition: 'border-color 0.15s',
}

export default function SettingsPage() {
  const { isAuthenticated, isLoading, user, handleLogout } = useAuth()
  const [section, setSection] = useState<Section>('profile')

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Loading...</span>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  const email = (user as { email?: string } | null)?.email ?? ''
  const initial = email.charAt(0).toUpperCase() || '?'

  const nav: { id: Section; label: string; icon: React.ReactNode }[] = [
    {
      id: 'profile', label: 'Profile',
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
    },
    {
      id: 'security', label: 'Security',
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
    },
  ]

  return (
    <div style={{ minHeight: '100vh', padding: '88px 40px 56px', maxWidth: '860px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ margin: '0 0 4px', fontSize: '22px', fontWeight: '700', color: 'var(--text-primary)' }}>Settings</h1>
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>Manage your account</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '20px', alignItems: 'start' }}>

        {/* Sidebar */}
        <div style={{
          background: '#fff', border: '1px solid var(--border)', borderRadius: '12px',
          padding: '8px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
        }}>
          {/* User pill */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '12px 10px', marginBottom: '4px',
            borderBottom: '1px solid var(--border)',
          }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '8px', flexShrink: 0,
              background: '#2db8b0', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '14px', fontWeight: '700', color: '#fff',
            }}>{initial}</div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{
                fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>{email}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Signed in</div>
            </div>
          </div>

          {/* Nav links */}
          {nav.map(item => (
            <button key={item.id} onClick={() => setSection(item.id)} style={{
              display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
              padding: '9px 10px', border: 'none', borderRadius: '8px',
              background: section === item.id ? '#f0fdfa' : 'transparent',
              color: section === item.id ? '#0f766e' : 'var(--text-secondary)',
              fontSize: '13px', fontWeight: section === item.id ? '600' : '400',
              cursor: 'pointer', textAlign: 'left', transition: 'background 0.12s',
            }}>
              {item.icon}
              {item.label}
            </button>
          ))}

          {/* Sign out */}
          <div style={{ borderTop: '1px solid var(--border)', marginTop: '4px', paddingTop: '4px' }}>
            <button onClick={handleLogout} style={{
              display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
              padding: '9px 10px', border: 'none', borderRadius: '8px',
              background: 'transparent', color: '#ef4444',
              fontSize: '13px', fontWeight: '400', cursor: 'pointer', textAlign: 'left',
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              Sign out
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{
          background: '#fff', border: '1px solid var(--border)', borderRadius: '12px',
          padding: '28px 32px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
        }}>
          {section === 'profile' && <ProfilePanel userEmail={email} />}
          {section === 'security' && <SecurityPanel />}
        </div>
      </div>
    </div>
  )
}

/* ── Profile ── */
function ProfilePanel({ userEmail, userName }: { userEmail: string; userName: string }) {
  const [email, setEmail] = useState(userEmail)
  const [name, setName] = useState(userName)
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState(false)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true); setMsg(''); setErr(false)
    try {
      await updateUserEmail(email)
      setMsg('Check your inbox to confirm the new email.')
    } catch (ex) {
      setErr(true); setMsg((ex as Error).message)
    } finally { setSubmitting(false) }
  }

  const initial = userEmail.charAt(0).toUpperCase() || '?'

  return (
    <div>
      <h2 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>Profile</h2>
      <p style={{ margin: '0 0 24px', fontSize: '13px', color: 'var(--text-secondary)' }}>Your public account details.</p>

      {/* Avatar + name row */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '16px',
        padding: '16px', background: '#f8fafc', borderRadius: '10px',
        marginBottom: '24px',
      }}>
        <div style={{
          width: '48px', height: '48px', borderRadius: '12px', flexShrink: 0,
          background: '#2db8b0', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '20px', fontWeight: '700', color: '#fff',
        }}>{initial}</div>
        <div>
          <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>{userEmail}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Registered account
          </div>
        </div>
      </div>
      <form onSubmit={save}>
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '6px' }}>
            Email address
          </label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            style={inputBase} required
            onFocus={e => e.currentTarget.style.borderColor = '#2db8b0'}
            onBlur={e => e.currentTarget.style.borderColor = '#e2e8f0'}
          />
        </div>

        {msg && (
          <div style={{
            marginBottom: '16px', padding: '10px 14px', borderRadius: '8px', fontSize: '13px',
            background: err ? '#fef2f2' : '#f0fdf4',
            border: `1px solid ${err ? '#fecaca' : '#bbf7d0'}`,
            color: err ? '#dc2626' : '#16a34a',
          }}>{msg}</div>
        )}

        <button type="submit" disabled={submitting || email === userEmail} style={{
          padding: '10px 20px', border: 'none', borderRadius: '8px',
          background: submitting || email === userEmail ? '#e2e8f0' : '#2db8b0',
          color: submitting || email === userEmail ? '#94a3b8' : '#fff',
          fontSize: '13px', fontWeight: '600',
          cursor: submitting || email === userEmail ? 'default' : 'pointer',
        }}>
          {submitting ? 'Saving...' : 'Save changes'}
        </button>
      </form>
    </div>
  )
}

/* ── Security ── */
function SecurityPanel() {
  const [pw, setPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState(false)

  const mismatch = confirm.length > 0 && pw !== confirm
  const tooShort = pw.length > 0 && pw.length < 6

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setMsg(''); setErr(false)
    if (pw !== confirm) { setErr(true); setMsg('Passwords don\u2019t match.'); return }
    if (pw.length < 6) { setErr(true); setMsg('Use at least 6 characters.'); return }
    setSubmitting(true)
    try {
      await updateUserPassword(pw)
      setMsg('Password updated.'); setPw(''); setConfirm('')
    } catch (ex) {
      setErr(true); setMsg((ex as Error).message)
    } finally { setSubmitting(false) }
  }

  const canSubmit = pw.length >= 6 && pw === confirm && !submitting

  return (
    <div>
      <h2 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>Security</h2>
      <p style={{ margin: '0 0 24px', fontSize: '13px', color: 'var(--text-secondary)' }}>Update your password.</p>

      <form onSubmit={save}>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '6px' }}>
            New password
          </label>
          <input type="password" value={pw} onChange={e => setPw(e.target.value)}
            style={inputBase} required placeholder="At least 6 characters"
            onFocus={e => e.currentTarget.style.borderColor = '#2db8b0'}
            onBlur={e => e.currentTarget.style.borderColor = '#e2e8f0'}
          />
          {tooShort && (
            <span style={{ display: 'block', marginTop: '4px', fontSize: '12px', color: '#ef4444' }}>
              Too short — needs 6+ characters
            </span>
          )}
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '6px' }}>
            Confirm password
          </label>
          <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
            style={{
              ...inputBase,
              borderColor: mismatch ? '#fecaca' : '#e2e8f0',
            }} required placeholder="Re-enter password"
            onFocus={e => e.currentTarget.style.borderColor = mismatch ? '#ef4444' : '#2db8b0'}
            onBlur={e => e.currentTarget.style.borderColor = mismatch ? '#fecaca' : '#e2e8f0'}
          />
          {mismatch && (
            <span style={{ display: 'block', marginTop: '4px', fontSize: '12px', color: '#ef4444' }}>
              Doesn&apos;t match
            </span>
          )}
        </div>

        {/* Strength indicator */}
        {pw.length > 0 && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
              {[1, 2, 3, 4].map(i => (
                <div key={i} style={{
                  flex: 1, height: '3px', borderRadius: '2px',
                  background: pw.length >= i * 3 ? (pw.length >= 10 ? '#22c55e' : pw.length >= 6 ? '#f59e0b' : '#ef4444') : '#e2e8f0',
                  transition: 'background 0.2s',
                }} />
              ))}
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {pw.length < 6 ? 'Weak' : pw.length < 10 ? 'Okay' : 'Strong'}
            </span>
          </div>
        )}

        {msg && (
          <div style={{
            marginBottom: '16px', padding: '10px 14px', borderRadius: '8px', fontSize: '13px',
            background: err ? '#fef2f2' : '#f0fdf4',
            border: `1px solid ${err ? '#fecaca' : '#bbf7d0'}`,
            color: err ? '#dc2626' : '#16a34a',
          }}>{msg}</div>
        )}

        <button type="submit" disabled={!canSubmit} style={{
          padding: '10px 20px', border: 'none', borderRadius: '8px',
          background: canSubmit ? '#2db8b0' : '#e2e8f0',
          color: canSubmit ? '#fff' : '#94a3b8',
          fontSize: '13px', fontWeight: '600',
          cursor: canSubmit ? 'pointer' : 'default',
        }}>
          {submitting ? 'Updating...' : 'Update password'}
        </button>
      </form>
    </div>
  )
}
