'use client'

import { useState } from 'react'
import { useAuth } from '@/src/hooks/useAuth'
import { updateUserEmail, updateUserPassword } from '@/src/services/user.service'
import { GridBackground } from '@/components/GridBackground'
import { BlinkingCursor } from '@/components/Cursor'
import '@/styles/settings.css'

const TABS = [
  { id: 'profile', label: 'Profile' },
  { id: 'security', label: 'Security' },
] as const

type TabId = (typeof TABS)[number]['id']

export default function SettingsPage() {
  const { isAuthenticated, isLoading: isAuthLoading, user, handleLogout } = useAuth()
  const [activeTab, setActiveTab] = useState<TabId>('profile')

  if (isAuthLoading) {
    return (
      <div className="settings__loading">
        <div className="settings__loading-text">LOADING...</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    if (typeof window !== 'undefined') {
      window.location.href = '/auth'
    }
    return null
  }

  const userEmail = (user as { email?: string } | null)?.email ?? ''

  function handleTabChange(tabId: TabId) {
    setActiveTab(tabId)
  }

  return (
    <div className="settings">
      <GridBackground />

      <div className="settings__container">
        <div className="settings__header">
          <div className="settings__label">
            <div className="settings__label-line" />
            <span className="settings__label-text">System Configuration</span>
          </div>
          <h1 className="settings__title">
            SETTINGS<BlinkingCursor />
          </h1>
          <p className="settings__subtitle">
            Manage your account profile and security preferences.
          </p>
        </div>

        <div className="settings__tabs">
          {TABS.map(tab => (
            <button
              key={tab.id}
              className={`settings__tab ${activeTab === tab.id ? 'settings__tab--active' : ''}`}
              onClick={() => handleTabChange(tab.id)}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="settings__content">
          {activeTab === 'profile' && <ProfilePanel userEmail={userEmail} />}
          {activeTab === 'security' && (
            <SecurityPanel handleLogout={handleLogout} />
          )}
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
    <div className="settings__panel">
      <h2 className="settings__panel-title">Profile Information</h2>
      <form onSubmit={handleSaveEmail} className="settings__form">
        <div className="settings__field">
          <label htmlFor="PROFILE_EMAIL" className="settings__field-label">
            Email Address
          </label>
          <input
            id="PROFILE_EMAIL"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="settings__input"
            required
          />
        </div>

        {statusMessage && (
          <div className={`settings__message ${isError ? 'settings__message--error' : 'settings__message--success'}`}>
            {statusMessage}
          </div>
        )}

        <button
          type="submit"
          className="settings__submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'UPDATING...' : 'UPDATE PROFILE'}
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

  function handleLogoutClick() {
    handleLogout()
  }

  return (
    <div className="settings__panel">
      <h2 className="settings__panel-title">Change Password</h2>
      <form onSubmit={handleChangePassword} className="settings__form">
        <div className="settings__field">
          <label htmlFor="NEW_PASSWORD" className="settings__field-label">
            New Password
          </label>
          <input
            id="NEW_PASSWORD"
            type="password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            className="settings__input"
            required
          />
        </div>
        <div className="settings__field">
          <label htmlFor="CONFIRM_PASSWORD" className="settings__field-label">
            Confirm Password
          </label>
          <input
            id="CONFIRM_PASSWORD"
            type="password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            className="settings__input"
            required
          />
        </div>

        {statusMessage && (
          <div className={`settings__message ${isError ? 'settings__message--error' : 'settings__message--success'}`}>
            {statusMessage}
          </div>
        )}

        <button
          type="submit"
          className="settings__submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'UPDATING...' : 'CHANGE PASSWORD'}
        </button>
      </form>

      <div className="settings__danger-zone">
        <h2 className="settings__panel-title settings__panel-title--danger">
          Session
        </h2>
        <p className="settings__danger-text">
          End your current session and return to the login screen.
        </p>
        <button
          type="button"
          className="settings__logout-button"
          onClick={handleLogoutClick}
        >
          LOGOUT
        </button>
      </div>
    </div>
  )
}
