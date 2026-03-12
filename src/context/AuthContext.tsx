'use client'

import { createContext, useEffect, useState, ReactNode } from 'react'
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    getCurrentUser().then(currentUser => {
      setUser(currentUser)
      setIsLoading(false)
    })

    const { data: listener } = onAuthStateChange((_event, session) => {
      const sessionUser = (session as { user?: User } | null)?.user ?? null
      setUser(sessionUser)
      setIsLoading(false)
    })

    return () => {
      listener.subscription.unsubscribe()
    }
  }, [])

  async function handleLogout() {
    await logout()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, isAuthenticated: !!user, handleLogout }}>
      {children}
    </AuthContext.Provider>
  )
}
