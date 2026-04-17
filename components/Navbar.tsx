'use client'

import { useAuth } from '@/src/hooks/useAuth'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

const NAV_ITEMS = [
  {
    href: '/',
    title: 'Dashboard',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
        <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
      </svg>
    ),
  },
  {
    href: '/simulate',
    matchPath: '/simulate',
    title: 'Simulation',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="5 3 19 12 5 21 5 3"/>
      </svg>
    ),
  },
  {
    href: '/map',
    title: 'Campus Map',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
      </svg>
    ),
  },
  {
    href: '/analysis',
    title: 'Heatmap',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v18h18"/><path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"/>
      </svg>
    ),
  },
  {
    href: '/settings',
    title: 'Settings',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
    ),
  },
]

export function Navbar() {
  const { user, isAuthenticated, isLoading, handleLogout } = useAuth()
  const pathname = usePathname()

  if (isLoading || !isAuthenticated) return null

  function isActive(item: typeof NAV_ITEMS[0]) {
    const match = (item as { matchPath?: string }).matchPath ?? item.href
    return pathname === match || pathname.startsWith(match + '?') || (match !== '/' && pathname.startsWith(match))
  }

  const initials = user?.email ? user.email.charAt(0).toUpperCase() : 'U'

  return (
    <nav style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      height: '60px',
      background: '#ffffff',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 24px',
      zIndex: 100,
      gap: '4px',
      boxShadow: 'var(--shadow-xs)',
    }}>
      {/* Logo */}
      <Link href="/" style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        textDecoration: 'none',
        marginRight: '20px',
      }}>
        <div style={{
          width: '36px',
          height: '36px',
          borderRadius: '10px',
          background: 'var(--teal)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
          </svg>
        </div>
        <span style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
          EVAC<span style={{ color: 'var(--teal)' }}>SIM</span>
        </span>
      </Link>

      {/* Divider */}
      <div style={{ width: '1px', height: '24px', background: 'var(--border)', marginRight: '8px' }} />

      {/* Nav items */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flex: 1 }}>
        {NAV_ITEMS.map(item => {
          const active = isActive(item)
          return (
            <a
              key={item.href}
              href={item.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
                padding: '7px 14px',
                borderRadius: 'var(--radius-sm)',
                background: active ? 'var(--teal-light)' : 'transparent',
                color: active ? 'var(--teal-dark)' : 'var(--text-secondary)',
                textDecoration: 'none',
                fontSize: '13px',
                fontWeight: active ? '600' : '500',
                transition: 'all var(--transition)',
                letterSpacing: '-0.01em',
              }}
              onMouseEnter={e => {
                if (!active) {
                  e.currentTarget.style.background = 'var(--bg-subtle)'
                  e.currentTarget.style.color = 'var(--text-primary)'
                }
              }}
              onMouseLeave={e => {
                if (!active) {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = 'var(--text-secondary)'
                }
              }}
            >
              {item.icon}
              <span>{item.title}</span>
            </a>
          )
        })}
      </div>

      {/* Right side: user avatar + logout */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {/* User avatar */}
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          background: 'var(--teal-light)',
          color: 'var(--teal)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '13px',
          fontWeight: '700',
          flexShrink: 0,
          border: '2px solid var(--bg)',
          boxShadow: 'var(--shadow-xs)',
        }}>
          {initials}
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          title="Sign out"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '34px',
            height: '34px',
            borderRadius: 'var(--radius-sm)',
            background: 'transparent',
            color: 'var(--text-muted)',
            border: 'none',
            cursor: 'pointer',
            transition: 'all var(--transition)',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = '#fef2f2'
            e.currentTarget.style.color = '#ef4444'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = 'var(--text-muted)'
          }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </button>
      </div>
    </nav>
  )
}
