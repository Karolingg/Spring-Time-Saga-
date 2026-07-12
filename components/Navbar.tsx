'use client'

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/src/hooks/useAuth'
import { useIsMobile } from '@/src/hooks/useIsMobile'
import { useTheme, Theme } from '@/src/context/ThemeContext'
import { useFocusTrap } from '@/src/hooks/useFocusTrap'
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
        href: '/help',
        title: 'Help & Guide',
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="16" x2="12" y2="12"/>
            <line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
        ),
      },
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
export const SIDEBAR_WIDTH = 317
export const COLLAPSED_SIDEBAR_WIDTH = 76

/** Height of the mobile top bar — used by providers.tsx so pages can leave
 *  space for it via `paddingTop`. */
export const MOBILE_TOPBAR_HEIGHT = 56

export function Navbar({
  isCollapsed = false,
  onToggleCollapse,
}: {
  isCollapsed?: boolean
  onToggleCollapse?: () => void
}) {
  const { user, isAuthenticated, isLoading, handleLogout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const pathname = usePathname()
  const isMobile = useIsMobile()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const drawerRef = useRef<HTMLElement>(null)

  // Keyboard support for the drawer: trap Tab inside, close on Escape,
  // restore focus to the hamburger when it closes.
  useFocusTrap(drawerRef, isMobile && drawerOpen, () => setDrawerOpen(false))

  // Close the drawer on every route change so navigating away dismisses it.
  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDrawerOpen(false), 0)
    return () => window.clearTimeout(timeoutId)
  }, [pathname])

  // Lock body scroll while the mobile drawer is open so background pages
  // don't scroll under the overlay.
  useEffect(() => {
    if (!drawerOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [drawerOpen])

  if (isLoading || !isAuthenticated) return null

  function isActive(item: NavItem) {
    const match = item.matchPath ?? item.href
    return pathname === match || pathname.startsWith(match + '?') || (match !== '/' && pathname.startsWith(match))
  }

  const initials = user?.email ? user.email.charAt(0).toUpperCase() : 'U'
  const username = user?.email?.split('@')[0] ?? 'Account'

  // ── Mobile: top bar with hamburger trigger + slide-in drawer ───────────
  if (isMobile) {
    return (
      <>
        <header style={{
          position: 'fixed',
          top: 0, left: 0, right: 0,
          height: `${MOBILE_TOPBAR_HEIGHT}px`,
          background: 'var(--sidebar-bg)',
          borderBottom: '1px solid var(--sidebar-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 14px',
          zIndex: 100,
          boxShadow: '0 2px 12px -6px rgba(15, 23, 42, 0.12)',
        }}>
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            aria-expanded={drawerOpen}
            style={{
              width: '40px', height: '40px', borderRadius: '10px',
              background: 'var(--nav-active-bg)', border: '1px solid var(--border)',
              cursor: 'pointer', color: 'var(--text-primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6"/>
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>

          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
            <div style={{
              width: '30px', height: '30px', borderRadius: '9px',
              background: 'linear-gradient(135deg, #2db8b0 0%, #1f9189 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 3px 8px -3px rgba(45, 184, 176, 0.4)',
            }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
            </div>
            <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
              EVAC<span style={{ color: '#2db8b0' }}>SIM</span>
            </span>
          </Link>

          <div style={{
            width: '32px', height: '32px', borderRadius: '50%',
            background: 'linear-gradient(135deg, #2db8b0 0%, #1f9189 100%)',
            color: '#ffffff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '12px', fontWeight: 800,
            boxShadow: '0 2px 6px -1px rgba(45, 184, 176, 0.4)',
          }}>
            {initials}
          </div>
        </header>

        {drawerOpen && (
          <div
            onClick={() => setDrawerOpen(false)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.5)',
              backdropFilter: 'blur(2px)', zIndex: 200,
              animation: 'fadeIn 0.18s ease-out',
            }}
          />
        )}

        <nav
          ref={drawerRef}
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
          aria-hidden={!drawerOpen}
          style={{
            position: 'fixed',
            top: 0, left: 0, bottom: 0,
            width: '260px',
            background: 'var(--sidebar-bg)',
            backgroundColor: 'var(--bg)',
            borderRight: '1px solid var(--sidebar-border)',
            display: 'flex', flexDirection: 'column',
            zIndex: 201,
            boxShadow: '2px 0 16px -8px rgba(15, 23, 42, 0.18)',
            transform: drawerOpen ? 'translateX(0)' : 'translateX(-100%)',
            // `visibility` keeps the closed drawer out of the tab order and
            // invisible to screen readers; it flips at the end of the slide-out.
            visibility: drawerOpen ? 'visible' : 'hidden',
            transition: 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1), visibility 220ms',
          }}>
          {renderNavContent({ drawerOpen, setDrawerOpen, initials, username, isActive, handleLogout, showCloseButton: true, theme, toggleTheme })}
        </nav>
      </>
    )
  }

  // ── Desktop: fixed sidebar ─────────────────────────────────────────────
  return (
    <nav aria-label="Main navigation" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      bottom: 0,
      width: `${isCollapsed ? COLLAPSED_SIDEBAR_WIDTH : SIDEBAR_WIDTH}px`,
      // Layered background: a soft teal halo near the brand at the top,
      // sitting on top of a cool diagonal gradient for depth without
      // looking flat or washed-out. Both layers come from the theme.
      background: 'var(--sidebar-bg)',
      borderRight: '1px solid var(--sidebar-border)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 100,
      boxShadow: '2px 0 16px -8px rgba(15, 23, 42, 0.10)',
      transition: 'width var(--transition, 200ms)',
    }}>
      {renderNavContent({
        drawerOpen: false,
        setDrawerOpen,
        initials,
        username,
        isActive,
        handleLogout,
        showCloseButton: false,
        isCollapsed,
        onToggleCollapse,
        theme,
        toggleTheme,
      })}
    </nav>
  )
}

/** Shared inner content for both the mobile drawer and the desktop
 *  sidebar — keeps the sections, account card, and active-link logic
 *  in one place so the two layouts can't drift apart. */
function renderNavContent({
  setDrawerOpen,
  initials,
  username,
  isActive,
  handleLogout,
  showCloseButton,
  isCollapsed = false,
  onToggleCollapse,
  theme,
  toggleTheme,
}: {
  drawerOpen: boolean
  setDrawerOpen: (open: boolean) => void
  initials: string
  username: string
  isActive: (item: NavItem) => boolean
  handleLogout: () => void
  showCloseButton: boolean
  isCollapsed?: boolean
  onToggleCollapse?: () => void
  theme: Theme
  toggleTheme: () => void
}) {
  return (
    <>
      {/* Brand header */}
      <div style={{
        padding: isCollapsed ? '16px 10px' : '20px 18px 16px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: isCollapsed ? 'center' : 'space-between', gap: '8px',
      }}>
        {!isCollapsed && <Link href="/" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '11px',
          textDecoration: 'none',
          flex: 1, minWidth: 0,
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
            <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', lineHeight: 1 }}>
              EVAC<span style={{ color: '#2db8b0' }}>SIM</span>
            </div>
            <div style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.04em', marginTop: '3px', textTransform: 'uppercase' }}>
              Campus Evacuation
            </div>
          </div>
        </Link>}
        {showCloseButton && (
          <button
            onClick={() => setDrawerOpen(false)}
            aria-label="Close menu"
            style={{
              width: '32px', height: '32px', borderRadius: '8px',
              background: 'var(--nav-hover-bg)', border: '1px solid var(--border)',
              cursor: 'pointer', color: 'var(--text-secondary)', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        )}
        {!showCloseButton && onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            style={{
              width: '32px', height: '32px', borderRadius: '8px',
              background: 'var(--nav-hover-bg)', border: '1px solid var(--border)',
              cursor: 'pointer', color: 'var(--text-secondary)', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transform: isCollapsed ? 'rotate(180deg)' : 'none',
              transition: 'background 140ms, color 140ms, transform 200ms',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
        )}
      </div>

      {/* Nav sections */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: isCollapsed ? '14px 10px 12px' : '14px 12px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
      }}>
        {NAV_SECTIONS.map((section) => (
          <div key={section.label} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {!isCollapsed && <div style={{
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
              padding: '0 12px 6px',
            }}>
              {section.label}
            </div>}
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
                    justifyContent: isCollapsed ? 'center' : 'flex-start',
                    gap: isCollapsed ? 0 : '12px',
                    padding: isCollapsed ? '10px' : '9px 12px',
                    borderRadius: '10px',
                    background: active ? 'var(--nav-active-bg)' : 'transparent',
                    color: active ? 'var(--nav-active-text)' : 'var(--text-secondary)',
                    boxShadow: active ? '0 1px 3px rgba(15, 23, 42, 0.06), 0 0 0 1px rgba(45, 184, 176, 0.18)' : 'none',
                    textDecoration: 'none',
                    fontSize: '13px',
                    fontWeight: active ? 700 : 500,
                    transition: 'background 140ms, color 140ms',
                    letterSpacing: '-0.005em',
                    minHeight: '40px',
                  }}
                  title={isCollapsed ? item.title : undefined}
                  aria-current={active ? 'page' : undefined}
                  onMouseEnter={e => {
                    if (!active) {
                      e.currentTarget.style.background = 'var(--nav-hover-bg)'
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
                    color: active ? 'var(--nav-active-text)' : 'var(--text-muted)',
                    flexShrink: 0,
                  }}>
                    {item.icon}
                  </span>
                  {!isCollapsed && <span style={{ flex: 1 }}>{item.title}</span>}
                </a>
              )
            })}
          </div>
        ))}
      </div>

      {/* Footer: theme toggle + account card */}
      <div style={{
        padding: isCollapsed ? '12px 10px' : '12px',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}>
        <button
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: isCollapsed ? 'center' : 'flex-start',
            gap: isCollapsed ? 0 : '10px',
            width: '100%',
            padding: isCollapsed ? '10px' : '9px 12px',
            borderRadius: '10px',
            background: 'transparent',
            border: '1px solid var(--border)',
            color: 'var(--text-secondary)',
            fontSize: '12.5px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'background 140ms, color 140ms',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'var(--nav-hover-bg)'
            e.currentTarget.style.color = 'var(--text-primary)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = 'var(--text-secondary)'
          }}
        >
          <span style={{ display: 'inline-flex', width: '20px', height: '20px', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {theme === 'dark' ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </span>
          {!isCollapsed && (theme === 'dark' ? 'Light mode' : 'Dark mode')}
        </button>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: isCollapsed ? 'center' : 'flex-start',
          gap: isCollapsed ? 0 : '10px',
          padding: isCollapsed ? '10px' : '10px 12px',
          borderRadius: '12px',
          background: 'var(--account-card-bg)',
          border: '1px solid var(--border)',
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
          {!isCollapsed && <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: '12.5px',
              fontWeight: 700,
              color: 'var(--text-primary)',
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
              color: 'var(--text-muted)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              marginTop: '1px',
            }}>
              Signed in
            </div>
          </div>}
          {!isCollapsed && <button
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
              color: 'var(--text-muted)',
              border: 'none',
              cursor: 'pointer',
              flexShrink: 0,
              transition: 'background 140ms, color 140ms',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.12)'
              e.currentTarget.style.color = '#ef4444'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = 'var(--text-muted)'
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>}
        </div>
      </div>
    </>
  )
}
