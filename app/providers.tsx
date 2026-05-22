'use client';

import { ReactNode, useState } from 'react';
import { usePathname } from 'next/navigation';
import { AuthProvider } from '@/src/context/AuthContext';
import { OnboardingProvider } from '@/src/context/OnboardingContext';
import { useAuth } from '@/src/hooks/useAuth';
import { useIsMobile } from '@/src/hooks/useIsMobile';
import { Navbar, SIDEBAR_WIDTH, COLLAPSED_SIDEBAR_WIDTH, MOBILE_TOPBAR_HEIGHT } from '@/components/Navbar';

/**
 * Inner shell that knows whether the user is authenticated. The sidebar only
 * renders for signed-in users, so we mirror that condition here when deciding
 * whether to indent the page content. Public pages (auth, landing) render at
 * full width with no sidebar offset.
 *
 * On mobile the sidebar becomes a top bar with a drawer, so we trade the
 * desktop `marginLeft` for a `paddingTop` to clear the fixed top bar.
 */
function AppShell({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const isAuthRoute = pathname?.startsWith('/auth');
  const showSidebar = isAuthenticated && !isLoading && !isAuthRoute;
  const sidebarOffset = isSidebarCollapsed ? COLLAPSED_SIDEBAR_WIDTH : SIDEBAR_WIDTH;

  return (
    <div className="app-ui-scale-shell">
      <Navbar
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(value => !value)}
      />
      <div
        style={{
          minHeight: '100vh',
          marginLeft: showSidebar && !isMobile ? `${sidebarOffset}px` : 0,
          paddingTop: showSidebar && isMobile ? `${MOBILE_TOPBAR_HEIGHT}px` : 0,
          transition: 'margin-left var(--transition, 200ms)',
        }}
      >
        {children}
      </div>
    </div>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <OnboardingProvider>
        <AppShell>{children}</AppShell>
      </OnboardingProvider>
    </AuthProvider>
  );
}
