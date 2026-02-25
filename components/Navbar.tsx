'use client'

import { useState } from 'react'
import { useAuth } from '@/src/hooks/useAuth'
import '@/styles/navbar.css'

const NAV_LINKS = [
  { label: 'Dashboard', href: '/', icon: '◉' },
  { label: 'Fire Simulation', href: '/simulate?disaster=fire', icon: '🔥' },
  { label: 'Earthquake Simulation', href: '/simulate?disaster=earthquake', icon: '🌎' },
  { label: 'Congestion Analysis', href: '/analysis', icon: '📊' },
]

export function Navbar() {
  const { isAuthenticated, isLoading, user, handleLogout } = useAuth()
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  if (isLoading || !isAuthenticated) {
    return null
  }

  const userEmail = (user as { email?: string } | null)?.email ?? 'Unknown'

  function handleToggleMenu() {
    setIsMenuOpen(prev => !prev)
  }

  function handleCloseMenu() {
    setIsMenuOpen(false)
  }

  function handleNavigate(href: string) {
    handleCloseMenu()
    window.location.href = href
  }

  function handleLogoutClick() {
    handleCloseMenu()
    handleLogout()
  }

  return (
    <nav className="navbar">
      <div className="navbar__left">
        <div className="navbar__indicator" />
        <a href="/" className="navbar__brand">EVAC-SIM v1.0</a>
      </div>

      <div className="navbar__center">
        {NAV_LINKS.map(link => (
          <a
            key={link.href}
            href={link.href}
            className="navbar__link"
          >
            <span className="navbar__link-icon">{link.icon}</span>
            <span className="navbar__link-label">{link.label}</span>
          </a>
        ))}
      </div>

      <div className="navbar__right">
        <button
          className="navbar__user-button"
          onClick={handleToggleMenu}
          type="button"
        >
          <span className="navbar__user-email">{userEmail}</span>
          <span className="navbar__user-chevron">{isMenuOpen ? '▲' : '▼'}</span>
        </button>

        {isMenuOpen && (
          <>
            <div className="navbar__overlay" onClick={handleCloseMenu} />
            <div className="navbar__dropdown">
              <button
                className="navbar__dropdown-item"
                onClick={() => handleNavigate('/settings')}
                type="button"
              >
                <span className="navbar__dropdown-icon">⚙</span>
                Settings
              </button>
              <div className="navbar__dropdown-divider" />
              <button
                className="navbar__dropdown-item navbar__dropdown-item--danger"
                onClick={handleLogoutClick}
                type="button"
              >
                <span className="navbar__dropdown-icon">⏻</span>
                Logout
              </button>
            </div>
          </>
        )}
      </div>
    </nav>
  )
}
