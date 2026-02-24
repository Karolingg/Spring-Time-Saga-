'use client';

import { createContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChange, getCurrentUser, logout } from '../services/auth.service';

export interface AuthContextValue {
  user: unknown;
  isLoading: boolean;
  isAuthenticated: boolean;
  handleLogout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  handleLogout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<unknown>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getCurrentUser().then((currentUser) => {
      setUser(currentUser);
      setIsLoading(false);
    });

    const { data: listener } = onAuthStateChange((_event, session) => {
      const sessionUser = (session as { user?: unknown } | null)?.user ?? null;
      setUser(sessionUser);
      setIsLoading(false);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  async function handleLogout() {
    await logout();
    setUser(null);
  }

  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider value={{ user, isLoading, isAuthenticated, handleLogout }}>
      {children}
    </AuthContext.Provider>
  );
}
