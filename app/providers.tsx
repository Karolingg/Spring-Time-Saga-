'use client';

import { ReactNode } from 'react';
import { AuthProvider } from '@/src/context/AuthContext';
import { Navbar } from '@/components/Navbar';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <Navbar />
      {children}
    </AuthProvider>
  );
}
