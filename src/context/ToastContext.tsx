'use client'

import { createContext, useCallback, useContext, useRef, useState, ReactNode } from 'react'

export type ToastType = 'success' | 'error' | 'info'

interface ToastItem {
  id: number
  type: ToastType
  message: string
  leaving: boolean
}

interface ToastContextValue {
  /** Show a toast. Errors stay a little longer than successes. */
  showToast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} })

const AUTO_DISMISS_MS: Record<ToastType, number> = {
  success: 4000,
  info: 4000,
  error: 6000,
}
const LEAVE_ANIMATION_MS = 180
const MAX_VISIBLE = 4

const TOAST_ICONS: Record<ToastType, ReactNode> = {
  success: (
    <svg className="toast__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <polyline points="8 12.5 11 15.5 16 9.5" />
    </svg>
  ),
  error: (
    <svg className="toast__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="13" />
      <line x1="12" y1="16.5" x2="12.01" y2="16.5" />
    </svg>
  ),
  info: (
    <svg className="toast__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="11" x2="12" y2="16" />
      <line x1="12" y1="7.5" x2="12.01" y2="7.5" />
    </svg>
  ),
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(1)
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>())

  const removeToast = useCallback((id: number) => {
    const pending = timers.current.get(id)
    if (pending) {
      clearTimeout(pending)
      timers.current.delete(id)
    }
    // Two-phase removal: mark as leaving so the exit animation plays, then drop.
    setToasts(current => current.map(t => (t.id === id ? { ...t, leaving: true } : t)))
    setTimeout(() => {
      setToasts(current => current.filter(t => t.id !== id))
    }, LEAVE_ANIMATION_MS)
  }, [])

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = nextId.current++
    setToasts(current => {
      const next = [...current, { id, type, message, leaving: false }]
      // Cap the stack; evict the oldest immediately (no exit animation needed).
      return next.length > MAX_VISIBLE ? next.slice(next.length - MAX_VISIBLE) : next
    })
    timers.current.set(id, setTimeout(() => removeToast(id), AUTO_DISMISS_MS[type]))
  }, [removeToast])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* aria-live region: polite so announcements don't interrupt; errors
          additionally carry role="alert" for immediate announcement. */}
      <div className="toast-viewport" aria-live="polite" aria-label="Notifications">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`toast toast--${toast.type}${toast.leaving ? ' toast--leaving' : ''}`}
            role={toast.type === 'error' ? 'alert' : 'status'}
          >
            {TOAST_ICONS[toast.type]}
            <div className="toast__message">{toast.message}</div>
            <button
              type="button"
              className="toast__close"
              aria-label="Dismiss notification"
              onClick={() => removeToast(toast.id)}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
