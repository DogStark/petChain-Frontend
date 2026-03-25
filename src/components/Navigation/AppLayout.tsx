import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import MobileHeader from './MobileHeader';
import Breadcrumbs from './Breadcrumbs';

// Pages that render their own full-screen layout (no shell)
const NO_SHELL_ROUTES = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/verify-account',
  '/two-factor',
  '/onboarding',
  '/',
];

// Pages deep enough to show breadcrumbs
function shouldShowBreadcrumbs(pathname: string) {
  const depth = pathname.split('/').filter(Boolean).length;
  return depth >= 1 && !NO_SHELL_ROUTES.includes(pathname);
}

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const { pathname } = useRouter();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Persist sidebar state
  useEffect(() => {
    const stored = localStorage.getItem('sidebar-collapsed');
    if (stored !== null) setSidebarCollapsed(stored === 'true');
  }, []);

  const toggleSidebar = () => {
    setSidebarCollapsed(prev => {
      localStorage.setItem('sidebar-collapsed', String(!prev));
      return !prev;
    });
  };

  const isNoShell = NO_SHELL_ROUTES.includes(pathname);

  if (isNoShell) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen bg-bg">
      {/* Desktop sidebar */}
      <Sidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} />

      {/* Main content area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Mobile top header */}
        <MobileHeader />

        {/* Breadcrumbs for deep pages */}
        {shouldShowBreadcrumbs(pathname) && (
          <div className="border-b border-gray-100 bg-white">
            <Breadcrumbs />
          </div>
        )}

        {/* Page content */}
        <main id="main-content" className="flex-1 pb-20 lg:pb-0" tabIndex={-1}>
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <BottomNav />
    </div>
  );
}
