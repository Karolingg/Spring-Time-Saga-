'use client'

import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react'

export type Theme = 'light' | 'dark'

/** localStorage key — also read by the anti-FOUC inline script in app/layout.tsx. */
export const THEME_STORAGE_KEY = 'evacsim-theme'

interface ThemeContextValue {
  theme: Theme
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  toggleTheme: () => {},
  setTheme: () => {},
})

function readStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'light'
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
  return stored === 'dark' ? 'dark' : 'light'
}

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme)
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Initialize from storage on the client. The inline script in layout.tsx has
  // already stamped data-theme before hydration, so there is no flash; this
  // just brings React state in line with the DOM.
  const [theme, setThemeState] = useState<Theme>(readStoredTheme)

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next)
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      // Storage unavailable (private mode) — theme still applies for the session.
    }
  }, [])

  const toggleTheme = useCallback(() => {
    setThemeState(prev => {
      const next = prev === 'dark' ? 'light' : 'dark'
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, next)
      } catch {
        // Storage unavailable — non-fatal.
      }
      return next
    })
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
