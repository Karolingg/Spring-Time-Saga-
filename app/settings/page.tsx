'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/src/hooks/useAuth'
import { updateUserEmail, updateUserPassword } from '@/src/services/user.service'

const TABS = [
  { id: 'profile', label: 'Profile' },
  { id: 'security', label: 'Security' },
] as const

type TabId = (typeof TABS)[number]['id']

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  background: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  fontSize: '14px',
  color: '#1a2332',
  outline: 'none',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '11px',
  fontWeight: '600',
  letterSpacing: '0.08em',
  color: '#64748b',
  textTransform: 'uppercase',
  marginBottom: '6px',
}

export default function SettingsPage() {
  const { isAuthenticated, isLoading: isAuthLoading, user, handleLogout } = useAuth()
  const [activeTab, setActiveTab] = useState<TabId>('profile')

  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      window.location.href = '/auth'
    }
  }, [isAuthLoading, isAuthenticated])

  if (isAuthLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Loading...</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  const userEmail = user?.email ?? ''

  return (
    <div style={{ minHeight: '100vh', padding: '88px 40px 56px', maxWidth: '900px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '32px' }}>
        <div style={{
          width: '44px', height: '44px', borderRadius: '12px',
          background: 'rgba(45,184,176,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2db8b0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: '26px', fontWeight: '700', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Settings</h1>
          <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>Manage your account and security preferences</p>
        </div>
      </div>

      {/* Card */}
      <div style={{
        background: '#ffffff',
        border: '1px solid var(--border)',
        borderRadius: '14px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        overflow: 'hidden',
      }}>
        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 32px' }}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '14px 16px',
                background: 'none',
                border: 'none',
                borderBottom: `2px solid ${activeTab === tab.id ? '#2db8b0' : 'transparent'}`,
                color: activeTab === tab.id ? '#2db8b0' : 'var(--text-secondary)',
                fontSize: '14px',
                fontWeight: activeTab === tab.id ? '600' : '400',
                cursor: 'pointer',
                marginBottom: '-1px',
                transition: 'color 0.15s',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Panel content */}
        <div style={{ padding: '36px 40px' }}>
          {activeTab === 'profile' && <ProfilePanel userEmail={userEmail} />}
          {activeTab === 'security' && <SecurityPanel handleLogout={handleLogout} />}
        </div>
      </div>
    </div>
  )
}

function ProfilePanel({ userEmail }: { userEmail: string }) {
  const [email, setEmail] = useState(userEmail)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [isError, setIsError] = useState(false)

  async function handleSaveEmail(event: React.FormEvent) {
    event.preventDefault()
    setIsSubmitting(true)
    setStatusMessage('')
    setIsError(false)
    try {
      await updateUserEmail(email)
      setStatusMessage('Email update requested. Check your inbox to confirm.')
    } catch (err) {
      setIsError(true)
      setStatusMessage((err as Error).message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div>
      <h2 style={{ margin: '0 0 20px', fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>Profile Information</h2>
      <form onSubmit={handleSaveEmail}>
        <div style={{ marginBottom: '20px' }}>
          <label style={labelStyle}>Email Address</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} required />
        </div>
        {statusMessage && (
          <div style={{
            marginBottom: '16px',
            padding: '10px 14px',
            background: isError ? '#fef2f2' : '#f0fdf4',
            border: `1px solid ${isError ? '#fecaca' : '#bbf7d0'}`,
            borderRadius: '8px',
            color: isError ? '#dc2626' : '#16a34a',
            fontSize: '13px',
          }}>{statusMessage}</div>
        )}
        <button type="submit" disabled={isSubmitting} style={{
          padding: '10px 20px',
          background: isSubmitting ? '#94e0db' : '#2db8b0',
          border: 'none',
          borderRadius: '8px',
          color: '#ffffff',
          fontSize: '14px',
          fontWeight: '600',
          cursor: isSubmitting ? 'not-allowed' : 'pointer',
        }}>
          {isSubmitting ? 'Updating...' : 'Update Profile'}
        </button>
      </form>
    </div>
  )
}

function SecurityPanel({ handleLogout }: { handleLogout: () => Promise<void> }) {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [isError, setIsError] = useState(false)

  async function handleChangePassword(event: React.FormEvent) {
    event.preventDefault()
    setStatusMessage('')
    setIsError(false)
    if (newPassword !== confirmPassword) {
      setIsError(true)
      setStatusMessage('Passwords do not match.')
      return
    }
    if (newPassword.length < 6) {
      setIsError(true)
      setStatusMessage('Password must be at least 6 characters.')
      return
    }
    setIsSubmitting(true)
    try {
      await updateUserPassword(newPassword)
      setStatusMessage('Password updated successfully.')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setIsError(true)
      setStatusMessage((err as Error).message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div>
      <h2 style={{ margin: '0 0 20px', fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>Change Password</h2>
      <form onSubmit={handleChangePassword}>
        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>New Password</label>
          <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} style={inputStyle} required />
        </div>
        <div style={{ marginBottom: '20px' }}>
          <label style={labelStyle}>Confirm Password</label>
          <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} style={inputStyle} required />
        </div>
        {statusMessage && (
          <div style={{
            marginBottom: '16px',
            padding: '10px 14px',
            background: isError ? '#fef2f2' : '#f0fdf4',
            border: `1px solid ${isError ? '#fecaca' : '#bbf7d0'}`,
            borderRadius: '8px',
            color: isError ? '#dc2626' : '#16a34a',
            fontSize: '13px',
          }}>{statusMessage}</div>
        )}
        <button type="submit" disabled={isSubmitting} style={{
          padding: '10px 20px',
          background: isSubmitting ? '#94e0db' : '#2db8b0',
          border: 'none',
          borderRadius: '8px',
          color: '#ffffff',
          fontSize: '14px',
          fontWeight: '600',
          cursor: isSubmitting ? 'not-allowed' : 'pointer',
        }}>
          {isSubmitting ? 'Updating...' : 'Change Password'}
        </button>
      </form>

      <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid var(--border)' }}>
        <h2 style={{ margin: '0 0 6px', fontSize: '15px', fontWeight: '600', color: '#ef4444' }}>Session</h2>
        <p style={{ margin: '0 0 16px', fontSize: '13px', color: 'var(--text-secondary)' }}>
          End your current session and return to the sign-in screen.
        </p>
        <button
          type="button"
          onClick={handleLogout}
          style={{
            padding: '10px 20px',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            color: '#ef4444',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Sign Out
        </button>
      </div>
    </div>
  )
}
