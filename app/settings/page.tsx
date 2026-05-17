'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/src/hooks/useAuth'
import { getUserProfile, updateUserProfile } from '@/src/services/user.service'

type Section = 'profile' | 'security' | 'notifications' | 'simulation' | 'about'

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
  notifications: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  simulation: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>,
  about: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>,
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
    { id: 'notifications', label: 'Notifications' },
    { id: 'simulation', label: 'Simulation' },
    { id: 'about', label: 'About' },
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
          {section === 'notifications' && <NotificationsPanel />}
          {section === 'simulation' && <SimulationDefaultsPanel />}
          {section === 'about' && <AboutPanel />}
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
      setMessage((err as Error).message)
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

function NotificationsPanel() {
  const [emailAlerts, setEmailAlerts] = useState(true)
  const [drillReminders, setDrillReminders] = useState(true)
  const [simComplete, setSimComplete] = useState(true)
  const [weeklyReport, setWeeklyReport] = useState(false)
  const [saved, setSaved] = useState(false)

  function handleSave() {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const toggles = [
    { label: 'Email alerts', desc: 'Receive email notifications for critical events and system updates.', value: emailAlerts, onChange: setEmailAlerts },
    { label: 'Drill reminders', desc: 'Get notified before scheduled evacuation drills.', value: drillReminders, onChange: setDrillReminders },
    { label: 'Simulation complete', desc: 'Notify when a simulation run finishes processing.', value: simComplete, onChange: setSimComplete },
    { label: 'Weekly summary report', desc: 'Receive a weekly digest of simulation activity and campus readiness.', value: weeklyReport, onChange: setWeeklyReport },
  ]

  return (
    <div>
      <h2 style={sectionTitle}>Notifications</h2>
      <p style={sectionDesc}>Choose what alerts and updates you receive.</p>

      <div>
        {toggles.map((toggle, index) => (
          <div key={toggle.label}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0' }}>
              <div style={{ flex: 1, marginRight: '16px' }}>
                <div style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-primary)', marginBottom: '2px' }}>{toggle.label}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.4' }}>{toggle.desc}</div>
              </div>
              <button
                onClick={() => toggle.onChange(!toggle.value)}
                style={{
                  width: '44px',
                  height: '24px',
                  borderRadius: '12px',
                  border: 'none',
                  background: toggle.value ? '#2db8b0' : '#e2e8f0',
                  position: 'relative',
                  cursor: 'pointer',
                  flexShrink: 0,
                  transition: 'background 0.2s',
                }}
              >
                <div style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  background: '#fff',
                  position: 'absolute',
                  top: '3px',
                  left: toggle.value ? '23px' : '3px',
                  transition: 'left 0.2s',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                }} />
              </button>
            </div>
            {index < toggles.length - 1 && <hr style={{ ...divider, margin: '0' }} />}
          </div>
        ))}
      </div>

      <div style={{ marginTop: '24px' }}>
        {saved && (
          <div style={{ marginBottom: '12px', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#16a34a' }}>
            Notification preferences saved.
          </div>
        )}
        <button onClick={handleSave} style={btnPrimary(true)}>Save preferences</button>
      </div>
    </div>
  )
}

function SimulationDefaultsPanel() {
  const [agentCount, setAgentCount] = useState(120)
  const [simSpeed, setSimSpeed] = useState(200)
  const [defaultDisaster, setDefaultDisaster] = useState<'fire' | 'earthquake'>('fire')
  const [autoSave, setAutoSave] = useState(true)
  const [saved, setSaved] = useState(false)

  function handleSave() {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div>
      <h2 style={sectionTitle}>Simulation Defaults</h2>
      <p style={sectionDesc}>Set default parameters for new simulation runs.</p>

      <div style={{ marginBottom: '20px' }}>
        <label style={labelStyle}>Default agent count</label>
        <input
          type="number"
          value={agentCount}
          onChange={event => setAgentCount(Math.max(1, parseInt(event.target.value) || 1))}
          style={inputBase}
          min={1}
          max={500}
          onFocus={event => event.currentTarget.style.borderColor = '#2db8b0'}
          onBlur={event => event.currentTarget.style.borderColor = '#e2e8f0'}
        />
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
          Number of agents spawned per simulation (1-500).
        </span>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={labelStyle}>Simulation speed (ms per step)</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <input type="range" min={50} max={500} step={10} value={simSpeed} onChange={event => setSimSpeed(parseInt(event.target.value))} style={{ flex: 1, accentColor: '#2db8b0' }} />
          <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', minWidth: '48px', textAlign: 'right' }}>
            {simSpeed}ms
          </span>
        </div>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
          Lower values run faster. Default: 200ms.
        </span>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={labelStyle}>Default disaster type</label>
        <div style={{ display: 'flex', gap: '8px' }}>
          {(['fire', 'earthquake'] as const).map(type => (
            <button
              key={type}
              onClick={() => setDefaultDisaster(type)}
              style={{
                flex: 1,
                padding: '10px 16px',
                border: '1px solid',
                borderColor: defaultDisaster === type ? (type === 'fire' ? '#ff6b35' : '#f59e0b') : '#e2e8f0',
                borderRadius: '8px',
                background: defaultDisaster === type ? (type === 'fire' ? 'rgba(255,107,53,0.06)' : 'rgba(245,158,11,0.06)') : '#fff',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '500',
                color: defaultDisaster === type ? (type === 'fire' ? '#c2410c' : '#92400e') : 'var(--text-secondary)',
              }}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <hr style={divider} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <div style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-primary)', marginBottom: '2px' }}>Auto-save results</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Automatically save simulation results to the database when a run completes.
          </div>
        </div>
        <button
          onClick={() => setAutoSave(!autoSave)}
          style={{
            width: '44px',
            height: '24px',
            borderRadius: '12px',
            border: 'none',
            background: autoSave ? '#2db8b0' : '#e2e8f0',
            position: 'relative',
            cursor: 'pointer',
            flexShrink: 0,
            transition: 'background 0.2s',
          }}
        >
          <div style={{
            width: '18px',
            height: '18px',
            borderRadius: '50%',
            background: '#fff',
            position: 'absolute',
            top: '3px',
            left: autoSave ? '23px' : '3px',
            transition: 'left 0.2s',
            boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
          }} />
        </button>
      </div>

      {saved && (
        <div style={{ marginBottom: '12px', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#16a34a' }}>
          Simulation defaults saved.
        </div>
      )}
      <button onClick={handleSave} style={btnPrimary(true)}>Save defaults</button>
    </div>
  )
}

function AboutPanel() {
  const rows = [
    { label: 'Version', value: '1.0.0-beta' },
    { label: 'Campus', value: 'University of the Philippines Cebu' },
    { label: 'Framework', value: 'Next.js 16 + React 19' },
    { label: 'Database', value: 'Supabase (PostgreSQL)' },
    { label: 'Map Provider', value: 'Mapbox GL JS' },
  ]

  const features = [
    'Interactive campus map with 3D building visualization',
    'Agent-based pathfinding with exit selection and rerouting',
    'Fire and earthquake disaster scenario modeling',
    'Real-time simulation metrics and drill evaluation',
    'Campus readiness scoring and analytics dashboard',
  ]

  return (
    <div>
      <h2 style={sectionTitle}>About EVACSIM</h2>
      <p style={sectionDesc}>System information and project details.</p>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        padding: '20px',
        background: 'linear-gradient(135deg, rgba(45,184,176,0.08) 0%, rgba(45,184,176,0.02) 100%)',
        borderRadius: '12px',
        border: '1px solid rgba(45,184,176,0.15)',
        marginBottom: '24px',
      }}>
        <div style={{ width: '48px', height: '48px', borderRadius: '12px', flexShrink: 0, background: '#2db8b0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
        </div>
        <div>
          <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)' }}>EVACSIM</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>Agent-Based Crowd Evacuation Simulator</div>
        </div>
      </div>

      <div>
        {rows.map((row, index) => (
          <div key={row.label}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', gap: '16px' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{row.label}</span>
              <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)', textAlign: 'right' }}>{row.value}</span>
            </div>
            {index < rows.length - 1 && <hr style={{ ...divider, margin: '0' }} />}
          </div>
        ))}
      </div>

      <hr style={divider} />

      <h3 style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>
        Project Description
      </h3>
      <p style={{ margin: '0 0 16px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
        EVACSIM is an agent-based crowd evacuation simulator designed for the University of the Philippines Cebu campus.
        It enables administrators to model disaster scenarios, simulate crowd evacuation behavior across campus buildings,
        and evaluate emergency preparedness through data-driven analysis.
      </p>

      <h3 style={{ margin: '0 0 10px', fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>
        Key Features
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
        {features.map(feature => (
          <div key={feature} style={{ padding: '8px 12px', background: '#f8fafc', borderRadius: '8px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
            {feature}
          </div>
        ))}
      </div>

      <div style={{ padding: '14px 16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', lineHeight: '1.6' }}>
        Built for academic research at UP Cebu.
        <br />
        For questions or feedback, contact your system administrator.
      </div>
    </div>
  )
}
