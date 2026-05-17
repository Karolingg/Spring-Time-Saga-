'use client'

import { useAuth } from '@/src/hooks/useAuth'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

interface NavItem {
  href: string
  matchPath?: string
  title: string
  icon: React.ReactNode
}

const NAV_SECTIONS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Main',
    items: [
      {
        href: '/',
        title: 'Dashboard',
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1.2"/><rect x="14" y="3" width="7" height="7" rx="1.2"/>
            <rect x="14" y="14" width="7" height="7" rx="1.2"/><rect x="3" y="14" width="7" height="7" rx="1.2"/>
          </svg>
        ),
      },
      {
        href: '/map',
        matchPath: '/map',
        title: 'Simulation',
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
          </svg>
        ),
      },
    ],
  },
  {
    label: 'Insights',
    items: [
      {
        href: '/analysis',
        title: 'Heatmap',
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3v18h18"/><path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"/>
          </svg>
        ),
      },
    ],
  },
  {
    label: 'Account',
    items: [
      {
        href: '/settings',
        title: 'Settings',
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        ),
      },
      {
        href: '/about',
        title: 'About',
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="16" x2="12" y2="12"/>
            <line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
        ),
      },
    ],
  },
]

/** Width reserved for the sidebar. Pages get a matching `marginLeft` via the
 *  layout wrapper in `providers.tsx` so content never sits underneath it. */
export const SIDEBAR_WIDTH = 244

export function Navbar() {
  const { user, isAuthenticated, isLoading, handleLogout } = useAuth()
  const pathname = usePathname()

  if (isLoading || !isAuthenticated) return null

  function isActive(item: NavItem) {
    const match = item.matchPath ?? item.href
    return pathname === match || pathname.startsWith(match + '?') || (match !== '/' && pathname.startsWith(match))
  }

  const initials = user?.email ? user.email.charAt(0).toUpperCase() : 'U'
  const username = user?.email?.split('@')[0] ?? 'Account'

  return (
    <nav style={{
      position: 'fixed',
      top: 0,
      left: 0,
      bottom: 0,
      width: `${SIDEBAR_WIDTH}px`,
      // Layered background: a soft teal halo near the brand at the top,
      // sitting on top of a cool diagonal gradient for depth without
      // looking flat or washed-out.
      background:
        'radial-gradient(circle at 20% 0%, rgba(45, 184, 176, 0.10) 0%, transparent 38%),' +
        'linear-gradient(180deg, #f7fafc 0%, #eef2f7 100%)',
      borderRight: '1px solid #dbe2ea',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 100,
      boxShadow: '2px 0 16px -8px rgba(15, 23, 42, 0.10)',
    }}>
      {/* Brand header */}
      <div style={{
        padding: '20px 18px 16px',
        borderBottom: '1px solid rgba(15, 23, 42, 0.06)',
      }}>
        <Link href="/" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '11px',
          textDecoration: 'none',
        }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '11px',
            background: 'linear-gradient(135deg, #2db8b0 0%, #1f9189 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            boxShadow: '0 4px 10px -3px rgba(45, 184, 176, 0.4)',
          }}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.03em', lineHeight: 1 }}>
              EVAC<span style={{ color: '#2db8b0' }}>SIM</span>
            </div>
            <div style={{ fontSize: '10.5px', fontWeight: 600, color: '#94a3b8', letterSpacing: '0.04em', marginTop: '3px', textTransform: 'uppercase' }}>
              Campus Evacuation
            </div>
          </div>
        </Link>
      </div>

      {/* Nav sections */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '14px 12px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
      }}>
        {NAV_SECTIONS.map((section) => (
          <div key={section.label} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <div style={{
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: '#94a3b8',
              padding: '0 12px 6px',
            }}>
              {section.label}
            </div>
            {section.items.map((item) => {
              const active = isActive(item)
              return (
                <a
                  key={item.href}
                  href={item.href}
                  style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '9px 12px',
                    borderRadius: '10px',
                    background: active ? 'rgba(255, 255, 255, 0.85)' : 'transparent',
                    color: active ? '#1f9189' : '#475569',
                    boxShadow: active ? '0 1px 3px rgba(15, 23, 42, 0.06), 0 0 0 1px rgba(45, 184, 176, 0.18)' : 'none',
                    textDecoration: 'none',
                    fontSize: '13px',
                    fontWeight: active ? 700 : 500,
                    transition: 'background 140ms, color 140ms',
                    letterSpacing: '-0.005em',
                  }}
                  onMouseEnter={e => {
                    if (!active) {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.6)'
                      e.currentTarget.style.color = '#0f172a'
                    }
                  }}
                  onMouseLeave={e => {
                    if (!active) {
                      e.currentTarget.style.background = 'transparent'
                      e.currentTarget.style.color = '#475569'
                    }
                  }}
                >
                  {/* Active accent bar on the left edge */}
                  {active && (
                    <span style={{
                      position: 'absolute',
                      left: '-12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: '3px',
                      height: '20px',
                      borderRadius: '0 3px 3px 0',
                      background: '#2db8b0',
                    }} />
                  )}
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '20px',
                    height: '20px',
                    color: active ? '#1f9189' : '#64748b',
                    flexShrink: 0,
                  }}>
                    {item.icon}
                  </span>
                  <span style={{ flex: 1 }}>{item.title}</span>
                </a>
              )
            })}
          </div>
        ))}
      </div>

      {/* Footer: account card */}
      <div style={{
        padding: '12px',
        borderTop: '1px solid rgba(15, 23, 42, 0.06)',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '10px 12px',
          borderRadius: '12px',
          background: 'rgba(255, 255, 255, 0.85)',
          border: '1px solid rgba(15, 23, 42, 0.06)',
          backdropFilter: 'blur(6px)',
          boxShadow: '0 2px 6px -2px rgba(15, 23, 42, 0.08)',
        }}>
          <div style={{
            width: '34px',
            height: '34px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #2db8b0 0%, #1f9189 100%)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '13px',
            fontWeight: 800,
            flexShrink: 0,
            boxShadow: '0 2px 6px -1px rgba(45, 184, 176, 0.4)',
          }}>
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: '12.5px',
              fontWeight: 700,
              color: '#0f172a',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              letterSpacing: '-0.005em',
            }}>
              {username}
            </div>
            <div style={{
              fontSize: '10.5px',
              fontWeight: 500,
              color: '#94a3b8',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              marginTop: '1px',
            }}>
              Signed in
            </div>
          </div>
          <button
            onClick={handleLogout}
            title="Sign out"
            aria-label="Sign out"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '30px',
              height: '30px',
              borderRadius: '8px',
              background: 'transparent',
              color: '#94a3b8',
              border: 'none',
              cursor: 'pointer',
              flexShrink: 0,
              transition: 'background 140ms, color 140ms',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = '#fef2f2'
              e.currentTarget.style.color = '#ef4444'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = '#94a3b8'
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>
      </div>
    </nav>
  )
}
