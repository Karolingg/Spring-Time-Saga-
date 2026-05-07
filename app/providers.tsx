'use client';

import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { AuthProvider } from '@/src/context/AuthContext';
import { useAuth } from '@/src/hooks/useAuth';
import { Navbar, SIDEBAR_WIDTH } from '@/components/Navbar';

/**
 * Inner shell that knows whether the user is authenticated. The sidebar only
 * renders for signed-in users, so we mirror that condition here when deciding
 * whether to indent the page content. Public pages (auth, landing) render at
 * full width with no sidebar offset.
 */
function AppShell({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const pathname = usePathname();
  const isAuthRoute = pathname?.startsWith('/auth');
  const showSidebar = isAuthenticated && !isLoading && !isAuthRoute;

  return (
    <>
      <Navbar />
      <div
        style={{
          minHeight: '100vh',
          marginLeft: showSidebar ? `${SIDEBAR_WIDTH}px` : 0,
          transition: 'margin-left var(--transition, 200ms)',
        }}
      >
        {children}
      </div>
    </>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <AppShell>{children}</AppShell>
    </AuthProvider>
  );
}
