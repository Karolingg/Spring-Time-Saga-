'use client';

import { ReactNode } from 'react';
import { AuthProvider } from '../src/context/auth-context';
import { AuthBar } from '../components/auth/auth-bar';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <AuthBar />
      {children}
    </AuthProvider>
  );
}
