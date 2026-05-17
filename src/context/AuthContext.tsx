'use client'

import { createContext, useCallback, useEffect, useRef, useState, ReactNode } from 'react'
import { SessionTimeoutModal } from '@/components/SessionTimeoutModal'
import {
  SESSION_IDLE_TIMEOUT_MS,
  SESSION_LAST_ACTIVITY_KEY,
  SESSION_TIMEOUT_NOTICE_KEY,
  SESSION_TIMEOUT_NOTICE_VALUE,
  SESSION_WARNING_MS,
} from '@/src/config/session-timeout'
import { onAuthStateChange, getCurrentUser, logout } from '@/src/services/auth.service'
import type { User } from '@supabase/supabase-js'

export interface AuthContextValue {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  handleLogout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  handleLogout: async () => {},
})

function isAuthRoute() {
  return typeof window !== 'undefined' && window.location.pathname.startsWith('/auth')
}

function getLastActivityAt() {
  if (typeof window === 'undefined') return Date.now()

  const raw = window.localStorage.getItem(SESSION_LAST_ACTIVITY_KEY)
  const parsed = raw ? Number(raw) : NaN
  return Number.isFinite(parsed) ? parsed : Date.now()
}

function setLastActivityAt(value: number) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(SESSION_LAST_ACTIVITY_KEY, String(value))
}

function clearTimeoutStorage() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(SESSION_LAST_ACTIVITY_KEY)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSessionWarningOpen, setIsSessionWarningOpen] = useState(false)
  const [secondsRemaining, setSecondsRemaining] = useState(Math.ceil(SESSION_WARNING_MS / 1000))
  const isSessionWarningOpenRef = useRef(false)
  const isSigningOutRef = useRef(false)
  const lastActivityWriteAtRef = useRef(0)

  const setSessionWarningOpen = useCallback((isOpen: boolean) => {
    isSessionWarningOpenRef.current = isOpen
    setIsSessionWarningOpen(isOpen)
  }, [])

  useEffect(() => {
    getCurrentUser().then(currentUser => {
      setUser(currentUser)
      setIsLoading(false)
    })

    const { data: listener } = onAuthStateChange((event, session) => {
      const sessionUser = (session as { user?: User } | null)?.user ?? null
      if (sessionUser && event === 'SIGNED_IN') {
        setLastActivityAt(Date.now())
      }
      setUser(sessionUser)
      setIsLoading(false)
    })

    return () => {
      listener.subscription.unsubscribe()
    }
  }, [])

  const finishLogout = useCallback(async (timedOut: boolean) => {
    if (isSigningOutRef.current) return

    isSigningOutRef.current = true
    setSessionWarningOpen(false)

    if (timedOut && typeof window !== 'undefined') {
      window.localStorage.setItem(SESSION_TIMEOUT_NOTICE_KEY, SESSION_TIMEOUT_NOTICE_VALUE)
    }

    try {
      await logout()
    } finally {
      clearTimeoutStorage()
      setUser(null)
      isSigningOutRef.current = false

      if (typeof window !== 'undefined' && !isAuthRoute()) {
        window.location.assign('/auth')
      }
    }
  }, [setSessionWarningOpen])

  const refreshActivity = useCallback((force = false) => {
    if (!force && isSessionWarningOpenRef.current) return

    const now = Date.now()
    if (!force && now - lastActivityWriteAtRef.current < 1000) return

    lastActivityWriteAtRef.current = now
    setLastActivityAt(now)
    setSecondsRemaining(Math.ceil(SESSION_WARNING_MS / 1000))
    setSessionWarningOpen(false)
  }, [setSessionWarningOpen])

  useEffect(() => {
    if (isLoading || !user) {
      setSessionWarningOpen(false)
      return
    }

    if (!window.localStorage.getItem(SESSION_LAST_ACTIVITY_KEY)) {
      setLastActivityAt(Date.now())
    }

    function checkSessionTimeout() {
      const now = Date.now()
      const idleMs = now - getLastActivityAt()
      const remainingMs = SESSION_IDLE_TIMEOUT_MS - idleMs

      if (remainingMs <= 0) {
        void finishLogout(true)
        return
      }

      if (remainingMs <= SESSION_WARNING_MS) {
        setSecondsRemaining(Math.max(0, Math.ceil(remainingMs / 1000)))
        setSessionWarningOpen(true)
        return
      }

      if (isSessionWarningOpenRef.current) {
        setSessionWarningOpen(false)
        setSecondsRemaining(Math.ceil(SESSION_WARNING_MS / 1000))
      }
    }

    function handleActivity() {
      refreshActivity(false)
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        refreshActivity(false)
      }
    }

    function handleStorage(event: StorageEvent) {
      if (event.key === SESSION_LAST_ACTIVITY_KEY) {
        checkSessionTimeout()
      }
    }

    const activityEvents: Array<keyof WindowEventMap> = [
      'mousemove',
      'mousedown',
      'keydown',
      'scroll',
      'touchstart',
      'focus',
    ]

    activityEvents.forEach(eventName => {
      window.addEventListener(eventName, handleActivity, { passive: true })
    })
    document.addEventListener('visibilitychange', handleVisibilityChange)

    window.addEventListener('storage', handleStorage)
    const intervalId = window.setInterval(checkSessionTimeout, 1000)
    checkSessionTimeout()

    return () => {
      window.clearInterval(intervalId)
      activityEvents.forEach(eventName => {
        window.removeEventListener(eventName, handleActivity)
      })
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('storage', handleStorage)
    }
  }, [finishLogout, isLoading, refreshActivity, setSessionWarningOpen, user])

  async function handleLogout() {
    await finishLogout(false)
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, isAuthenticated: !!user, handleLogout }}>
      {children}
      <SessionTimeoutModal
        isOpen={isSessionWarningOpen && !!user && !isAuthRoute()}
        secondsRemaining={secondsRemaining}
        onStaySignedIn={() => refreshActivity(true)}
        onSignOut={() => void finishLogout(false)}
      />
    </AuthContext.Provider>
  )
}
