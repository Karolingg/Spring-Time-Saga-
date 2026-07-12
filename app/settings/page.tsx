'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/src/hooks/useAuth'
import { useIsMobile } from '@/src/hooks/useIsMobile'
import { useToast } from '@/src/context/ToastContext'
import { getFriendlyErrorMessage } from '@/src/services/rate-limit.service'
import {
  getUserProfile,
  updateUserEmail,
  updateUserPassword,
  updateUserProfile,
} from '@/src/services/user.service'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'

type Section = 'profile' | 'security'

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
  background: enabled ? '#2db8b0' : 'var(--bg-inset)',
  color: enabled ? '#fff' : 'var(--text-muted)',
  fontSize: '13px',
  fontWeight: '600',
  cursor: enabled ? 'pointer' : 'default',
  transition: 'background 0.15s',
})

const SETTINGS_ICON = (size: number) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#2db8b0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
)

const navIcons: Record<Section, React.ReactNode> = {
  profile: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  security: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  ),
}

export default function SettingsPage() {
  const { isAuthenticated, isLoading, user, handleLogout } = useAuth()
  const [section, setSection] = useState<Section>('profile')
  const isMobile = useIsMobile()

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <span style={{ color: 'var(--text-secondary)', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}><span className="spinner" />Loading...</span>
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

  if (isMobile) {
    return (
      <div data-page-shell style={{ minHeight: '100vh', padding: '20px 14px 32px' }}>
        {/* Header */}
        <PageHeader
          dense
          icon={SETTINGS_ICON(20)}
          title="Settings"
          subtitle="Manage your account"
        />

        {/* User card */}
        <Card padding="14px" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '14px',
        }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            flexShrink: 0,
            background: '#2db8b0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '15px',
            fontWeight: '700',
            color: '#fff',
          }}>
            {initial}
          </div>
          <div style={{ overflow: 'hidden', flex: 1 }}>
            <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {email}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Signed in with Google</div>
          </div>
        </Card>

        {/* Pill tab strip */}
        <div className="scroll-hide-x" style={{
          display: 'flex',
          gap: '8px',
          overflowX: 'auto',
          marginBottom: '16px',
          paddingBottom: '2px',
        }}>
          {nav.map(item => (
            <button key={item.id} onClick={() => setSection(item.id)} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              border: 'none',
              borderRadius: '999px',
              background: section === item.id ? '#2db8b0' : 'var(--bg-inset)',
              color: section === item.id ? '#fff' : 'var(--text-secondary)',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              transition: 'background 0.15s, color 0.15s',
            }}>
              {navIcons[item.id]}
              {item.label}
            </button>
          ))}
        </div>

        {/* Content card */}
        <Card padding="20px 16px">
          {section === 'profile' && <ProfilePanel userEmail={email} />}
          {section === 'security' && <SecurityPanel userEmail={email} />}
        </Card>
      </div>
    )
  }
  
  return (
    <div data-page-shell style={{ minHeight: '100vh', padding: '88px 40px 56px', maxWidth: '920px', margin: '0 auto' }}>
      {/* Page header */}
      <PageHeader
        icon={SETTINGS_ICON(22)}
        title="Settings"
        subtitle="Manage your account and preferences"
      />

      {/* User info card — full width */}
      <Card padding="16px 20px" style={{
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        marginBottom: '20px',
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          borderRadius: '10px',
          flexShrink: 0,
          background: '#2db8b0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '16px',
          fontWeight: '700',
          color: '#fff',
        }}>
          {initial}
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {email}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Signed in with Google</div>
        </div>
        <button onClick={handleLogout} style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '8px 14px',
          border: '1px solid rgba(239,68,68,0.35)',
          borderRadius: '8px',
          background: 'transparent',
          color: '#ef4444',
          fontSize: '12px',
          fontWeight: '500',
          cursor: 'pointer',
          transition: 'background 0.12s',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Sign out
        </button>
      </Card>

      {/* Main grid: sidebar nav + content */}
      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '20px', alignItems: 'start' }}>
        <Card padding="8px">
          {nav.map(item => (
            <button key={item.id} onClick={() => setSection(item.id)} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              width: '100%',
              padding: '10px 12px',
              border: 'none',
              borderRadius: '8px',
              background: section === item.id ? 'var(--teal-light)' : 'transparent',
              color: section === item.id ? 'var(--nav-active-text)' : 'var(--text-secondary)',
              fontSize: '13px',
              fontWeight: section === item.id ? '600' : '400',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'background 0.12s',
              marginBottom: '2px',
            }}>
              {navIcons[item.id]}
              {item.label}
            </button>
          ))}
        </Card>

        {/* Content panel */}
        <Card style={{ minHeight: '380px' }}>
          {section === 'profile' && <ProfilePanel userEmail={email} />}
          {section === 'security' && <SecurityPanel userEmail={email} />}
        </Card>
      </div>
    </div>
  )
}

function ProfilePanel({ userEmail }: { userEmail: string }) {
  const { showToast } = useToast()
  const [email, setEmail] = useState(userEmail)
  const [displayName, setDisplayName] = useState('')
  const [initialDisplayName, setInitialDisplayName] = useState('')
  const [initialEmail, setInitialEmail] = useState(userEmail)
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    getUserProfile()
      .then(profile => {
        const profileName = profile?.display_name ?? ''
        setDisplayName(profileName)
        setInitialDisplayName(profileName)
        setEmail(userEmail)
        setInitialEmail(userEmail)
      })
      .catch(() => {})
      .finally(() => setLoadingProfile(false))
  }, [userEmail])

  const initial = userEmail.charAt(0).toUpperCase() || '?'
  const trimmedDisplayName = displayName.trim()
  const trimmedEmail = email.trim()
  const hasChanges = trimmedDisplayName !== initialDisplayName || trimmedEmail !== initialEmail

  async function save(event: React.FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    try {
      if (trimmedDisplayName !== initialDisplayName) {
        await updateUserProfile(trimmedDisplayName)
        setInitialDisplayName(trimmedDisplayName)
        setDisplayName(trimmedDisplayName)
      }

      if (trimmedEmail !== initialEmail) {
        await updateUserEmail(trimmedEmail)
        setInitialEmail(trimmedEmail)
        setEmail(trimmedEmail)
        showToast('Check your inbox to confirm the new email.', 'info')
      } else {
        showToast('Profile updated successfully.', 'success')
      }
    } catch (err) {
      showToast(getFriendlyErrorMessage(err, (err as Error).message), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <h2 style={sectionTitle}>Profile</h2>
      <p style={sectionDesc}>Your public account details.</p>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', background: 'var(--bg-subtle)', borderRadius: '10px', marginBottom: '24px' }}>
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
            {displayName ? userEmail : 'Registered account'}
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
            className="input-field"
            style={{ fontSize: '14px' }}
            placeholder={loadingProfile ? 'Loading...' : 'Enter your name'}
            disabled={loadingProfile || submitting}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={labelStyle}>Email address</label>
          <input
            type="email"
            value={email}
            onChange={event => setEmail(event.target.value)}
            className="input-field"
            style={{ fontSize: '14px' }}
            required
            disabled={submitting}
          />
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
            Changing your email may require confirmation.
          </span>
        </div>

        <hr style={divider} />

        <div style={{ marginBottom: '20px' }}>
          <label style={labelStyle}>Role</label>
          <div style={{ padding: '10px 14px', background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>
            Administrator
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
            Contact your system admin to change roles.
          </span>
        </div>

        <button type="submit" disabled={submitting || !hasChanges} className="hover-darken" style={btnPrimary(!submitting && hasChanges)}>
          {submitting ? 'Saving...' : 'Save changes'}
        </button>
      </form>
    </div>
  )
}

function SecurityPanel({ userEmail }: { userEmail: string }) {
  const { handleLogout } = useAuth()
  const { showToast } = useToast()
  const [pw, setPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)

  const mismatch = confirm.length > 0 && pw !== confirm
  const tooShort = pw.length > 0 && pw.length < 6

  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (pw !== confirm) { showToast('Passwords do not match.', 'error'); return }
    if (pw.length < 6) { showToast('Use at least 6 characters.', 'error'); return }

    setSubmitting(true)
    try {
      await updateUserPassword(pw)
      showToast('Password updated.', 'success')
      setPw('')
      setConfirm('')
    } catch (error) {
      showToast(getFriendlyErrorMessage(error, (error as Error).message), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSignOut() {
    setIsSigningOut(true)
    try {
      await handleLogout()
    } finally {
      setIsSigningOut(false)
    }
  }

  return (
    <div>
      <h2 style={sectionTitle}>Security</h2>
      <p style={sectionDesc}>Manage your account security and active session.</p>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '14px',
        background: 'var(--bg-subtle)',
        borderRadius: '8px',
        border: '1px solid var(--border)',
        marginBottom: '20px',
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>Signed in as</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {userEmail || 'Account'}
          </div>
        </div>
        <div style={{ padding: '4px 8px', borderRadius: '999px', background: '#dcfce7', color: '#15803d', fontSize: '11px', fontWeight: '600' }}>
          Active
        </div>
      </div>

      <h3 style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>
        Change password
      </h3>
      <form onSubmit={save}>
        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>New password</label>
          <input
            type="password"
            value={pw}
            onChange={e => setPw(e.target.value)}
            className="input-field"
            style={{ fontSize: '14px' }}
            required
            placeholder="At least 6 characters"
            disabled={submitting}
          />
          {tooShort && (
            <span style={{ display: 'block', marginTop: '4px', fontSize: '12px', color: '#ef4444' }}>
              Too short - needs 6+ characters
            </span>
          )}
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={labelStyle}>Confirm password</label>
          <input
            type="password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            className="input-field"
            style={{ fontSize: '14px', borderColor: mismatch ? '#ef4444' : undefined }}
            required
            placeholder="Re-enter password"
            disabled={submitting}
          />
          {mismatch && (
            <span style={{ display: 'block', marginTop: '4px', fontSize: '12px', color: '#ef4444' }}>
              Does not match
            </span>
          )}
        </div>

        <button type="submit" disabled={mismatch || tooShort || submitting} className="hover-darken" style={btnPrimary(!mismatch && !tooShort && !submitting)}>
          {submitting ? 'Updating...' : 'Update password'}
        </button>
      </form>

      <hr style={divider} />

      <h3 style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>
        Active session
      </h3>
      <p style={{ margin: '0 0 12px', fontSize: '12px', color: 'var(--text-muted)' }}>
        Sign out here to end this browser session.
      </p>
      <button type="button" onClick={handleSignOut} disabled={isSigningOut} className="hover-darken" style={btnPrimary(!isSigningOut)}>
        {isSigningOut ? 'Signing out...' : 'Sign out'}
      </button>
    </div>
  )
}

