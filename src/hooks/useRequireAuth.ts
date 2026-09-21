'use client'

import { useEffect } from 'react'
import { useAuth } from '@/src/hooks/useAuth'

/**
 * Auth state for a protected page, plus the redirect that sends a signed-out
 * visitor to /auth.
 *
 * Pages keep their own render guards — what each shows while loading differs,
 * and several gate on their own data loading too — but the redirect itself
 * lives here so there is one place to change how a missing session is handled.
 */
export function useRequireAuth() {
  const auth = useAuth()
  const { isAuthenticated, isLoading } = auth

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      window.location.href = '/auth'
    }
  }, [isLoading, isAuthenticated])

  return auth
}
