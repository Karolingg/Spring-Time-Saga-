'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/src/hooks/useAuth'
import { getFriendlyErrorMessage } from '@/src/services/rate-limit.service'
import { getUserProfile, updateUserProfile } from '@/src/services/user.service'

type Section = 'profile' | 'security'

const inputBase: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  background: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  fontSize: '14px',
  color: '#0f172a',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.15s',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '13px',
  fontWeight: '500',
  color: 'var(--text-secondary)',
  marginBottom: '6px',
}

const sectionTitle: React.CSSProperties = {
  margin: '0 0 4px',
  fontSize: '16px',
  fontWeight: '600',
  color: 'var(--text-primary)',
}

const sectionDesc: React.CSSProperties = {
  margin: '0 0 24px',
  fontSize: '13px',
  color: 'var(--text-secondary)',
}

const divider: React.CSSProperties = {
  border: 'none',
  borderTop: '1px solid var(--border)',
  margin: '24px 0',
}

const btnPrimary = (enabled: boolean): React.CSSProperties => ({
  padding: '10px 20px',
  border: 'none',
  borderRadius: '8px',
  background: enabled ? '#2db8b0' : '#e2e8f0',
  color: enabled ? '#fff' : '#94a3b8',
  fontSize: '13px',
  fontWeight: '600',
  cursor: enabled ? 'pointer' : 'default',
  transition: 'background 0.15s',
})

const navIcons: Record<Section, React.ReactNode> = {
  profile: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  security: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
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

  if (!isAuthenticated) return null

  const email = user?.email ?? ''
  const initial = email.charAt(0).toUpperCase() || '?'
  const nav: { id: Section; label: string }[] = [
    { id: 'profile', label: 'Profile' },
    { id: 'security', label: 'Security' },
  ]

  return (
    <div style={{ minHeight: '100vh', padding: '88px 40px 56px', maxWidth: '860px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '24px' }}>
        <div style={{
          width: '44px',
          height: '44px',
          borderRadius: '12px',
          background: 'rgba(45,184,176,0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2db8b0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </div>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: '22px', fontWeight: '700', color: 'var(--text-primary)' }}>Settings</h1>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>Manage your account and preferences</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '20px', alignItems: 'start' }}>
        <div style={{
          background: '#fff',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '8px',
          boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 10px', marginBottom: '4px', borderBottom: '1px solid var(--border)' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              flexShrink: 0,
              background: '#2db8b0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
              fontWeight: '700',
              color: '#fff',
            }}>
              {initial}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {email}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Signed in with Google</div>
            </div>
          </div>

          {nav.map(item => (
            <button key={item.id} onClick={() => setSection(item.id)} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              width: '100%',
              padding: '9px 10px',
              border: 'none',
              borderRadius: '8px',
              background: section === item.id ? '#f0fdfa' : 'transparent',
              color: section === item.id ? '#0f766e' : 'var(--text-secondary)',
              fontSize: '13px',
              fontWeight: section === item.id ? '600' : '400',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'background 0.12s',
            }}>
              {navIcons[item.id]}
              {item.label}
            </button>
          ))}

          <div style={{ borderTop: '1px solid var(--border)', marginTop: '4px', paddingTop: '4px' }}>
            <button onClick={handleLogout} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              width: '100%',
              padding: '9px 10px',
              border: 'none',
              borderRadius: '8px',
              background: 'transparent',
              color: '#ef4444',
              fontSize: '13px',
              fontWeight: '400',
              cursor: 'pointer',
              textAlign: 'left',
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              Sign out
            </button>
          </div>
        </div>

        <div style={{
          background: '#fff',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '28px 32px',
          boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
        }}>
          {section === 'profile' && <ProfilePanel userEmail={email} />}
          {section === 'security' && <SecurityPanel userEmail={email} onSignOut={handleLogout} />}
        </div>
      </div>
    </div>
  )
}

function ProfilePanel({ userEmail }: { userEmail: string }) {
  const [displayName, setDisplayName] = useState('')
  const [initialDisplayName, setInitialDisplayName] = useState('')
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    getUserProfile()
      .then(profile => {
        const profileName = profile?.display_name ?? ''
        setDisplayName(profileName)
        setInitialDisplayName(profileName)
      })
      .catch(() => {})
      .finally(() => setLoadingProfile(false))
  }, [])

  const initial = userEmail.charAt(0).toUpperCase() || '?'
  const trimmedDisplayName = displayName.trim()
  const hasChanges = trimmedDisplayName !== initialDisplayName

  async function save(event: React.FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setMessage('')
    setHasError(false)
    try {
      await updateUserProfile(trimmedDisplayName)
      setInitialDisplayName(trimmedDisplayName)
      setDisplayName(trimmedDisplayName)
      setMessage('Profile updated successfully.')
    } catch (err) {
      setHasError(true)
      setMessage(getFriendlyErrorMessage(err, (err as Error).message))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <h2 style={sectionTitle}>Profile</h2>
      <p style={sectionDesc}>Your public account details.</p>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', background: '#f8fafc', borderRadius: '10px', marginBottom: '24px' }}>
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: '12px',
          flexShrink: 0,
          background: '#2db8b0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '20px',
          fontWeight: '700',
          color: '#fff',
        }}>
          {initial}
        </div>
        <div>
          <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>
            {displayName || userEmail}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
            {displayName ? userEmail : 'Google account'}
          </div>
        </div>
      </div>

      <form onSubmit={save}>
        <div style={{ marginBottom: '20px' }}>
          <label style={labelStyle}>Display name</label>
          <input
            type="text"
            value={loadingProfile ? '' : displayName}
            onChange={event => setDisplayName(event.target.value)}
            style={inputBase}
            placeholder={loadingProfile ? 'Loading...' : 'Enter your name'}
            disabled={loadingProfile}
            onFocus={event => event.currentTarget.style.borderColor = '#2db8b0'}
            onBlur={event => event.currentTarget.style.borderColor = '#e2e8f0'}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={labelStyle}>Email address</label>
          <div style={{ ...inputBase, color: 'var(--text-secondary)', cursor: 'default' }}>
            {userEmail || 'No provider email available'}
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
            Email is managed by your Google account.
          </span>
        </div>

        <hr style={divider} />

        <div style={{ marginBottom: '20px' }}>
          <label style={labelStyle}>Role</label>
          <div style={{ padding: '10px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>
            Administrator
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
            Contact your system admin to change roles.
          </span>
        </div>

        {message && (
          <div style={{
            marginBottom: '16px',
            padding: '10px 14px',
            borderRadius: '8px',
            fontSize: '13px',
            background: hasError ? '#fef2f2' : '#f0fdf4',
            border: `1px solid ${hasError ? '#fecaca' : '#bbf7d0'}`,
            color: hasError ? '#dc2626' : '#16a34a',
          }}>
            {message}
          </div>
        )}

        <button type="submit" disabled={submitting || !hasChanges} style={btnPrimary(!submitting && hasChanges)}>
          {submitting ? 'Saving...' : 'Save changes'}
        </button>
      </form>
    </div>
  )
}

function SecurityPanel({ userEmail, onSignOut }: { userEmail: string; onSignOut: () => Promise<void> }) {
  const [isSigningOut, setIsSigningOut] = useState(false)

  async function handleSignOut() {
    setIsSigningOut(true)
    try {
      await onSignOut()
    } finally {
      setIsSigningOut(false)
    }
  }

  return (
    <div>
      <h2 style={sectionTitle}>Security</h2>
      <p style={sectionDesc}>Your EVACSIM account is protected through Google OAuth.</p>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '14px',
        background: '#f8fafc',
        borderRadius: '8px',
        border: '1px solid #e2e8f0',
        marginBottom: '20px',
      }}>
        <svg width="20" height="20" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
            Google account
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {userEmail || 'Connected through Supabase OAuth'}
          </div>
        </div>
        <div style={{ padding: '4px 8px', borderRadius: '999px', background: '#dcfce7', color: '#15803d', fontSize: '11px', fontWeight: '600' }}>
          Connected
        </div>
      </div>

      <h3 style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>
        Password and email
      </h3>
      <p style={{ margin: '0 0 20px', fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
        Passwords and provider email changes are managed by Google. EVACSIM only stores your Supabase session and app profile details.
      </p>

      <hr style={divider} />

      <h3 style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>
        Active session
      </h3>
      <p style={{ margin: '0 0 12px', fontSize: '12px', color: 'var(--text-muted)' }}>
        Sign out here to end this browser session.
      </p>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px 14px',
        background: '#f8fafc',
        borderRadius: '8px',
        border: '1px solid #e2e8f0',
        marginBottom: '16px',
      }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2db8b0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
        </svg>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)' }}>Current browser</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Active now</div>
        </div>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e' }} />
      </div>

      <button type="button" onClick={handleSignOut} disabled={isSigningOut} style={btnPrimary(!isSigningOut)}>
        {isSigningOut ? 'Signing out...' : 'Sign out'}
      </button>
    </div>
  )
}
