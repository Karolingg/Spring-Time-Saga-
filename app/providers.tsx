'use client';

import { ReactNode } from 'react';
import { AuthProvider } from '@/src/context/AuthContext';
import { AuthBar } from '@/components/auth/AuthBar';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <AuthBar />
      {children}
    </AuthProvider>
  );
}
