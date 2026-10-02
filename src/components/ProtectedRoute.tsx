import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  requireAdmin?: boolean;
  redirectTo?: string;
  /** Allow specific public routes (e.g., emergency) to bypass auth */
  allowPublic?: boolean;
}

/**
 * List of public route patterns that don't require authentication.
 * These routes follow a separate privacy policy and may remain in browser history.
 */
export const PUBLIC_ROUTE_PATTERNS = [
  /^\/pets\/[^/]+\/emergency$/, // Emergency pet records - public scanner preview
  /^\/login$/,
  /^\/register$/,
  /^\/forgot-password$/,
  /^\/reset-password/,
  /^\/verify-email/,
  /^\/verify-account/,
  /^\/two-factor/,
  /^\/$/, // Home page
  /^\/about$/,
  /^\/search$/,
  /^\/clinics/,
  /^\/rate$/,
  /^\/review$/,
  /^\/offline$/,
  /^\/scan/,
  /^\/qrcode/,
] as const;

/**
 * Checks if a route is a public route that doesn't require authentication.
 */
export function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTE_PATTERNS.some((pattern) => pattern.test(pathname));
}

export default function ProtectedRoute({
  children,
  requireAuth = true,
  requireAdmin = false,
  redirectTo = '/login',
  allowPublic = false,
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);

  const isAdmin = user?.role === 'admin';
  const pathname = router.asPath.split('?')[0];

  // Check if this is a public route that should bypass auth
  const isPublic = allowPublic && isPublicRoute(pathname);

  // Handle initial auth check and bfcache restoration
  useEffect(() => {
    const checkAuth = () => {
      if (isLoading) return;
      
      if (requireAuth && !isAuthenticated && !isPublic) {
        router.push(`${redirectTo}?next=${encodeURIComponent(router.asPath)}`);
        return;
      }
      if (requireAdmin && !isAdmin) {
        router.push('/dashboard');
        return;
      }
      setAuthChecked(true);
    };

    checkAuth();

    // Handle back/forward cache (bfcache) restoration
    // When a page is restored from bfcache, the `pageshow` event fires with `event.persisted === true`
    // We need to re-validate authentication state in this case
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        // Page was restored from bfcache - re-check auth
        setAuthChecked(false);
        // Force a re-check by triggering the effect again
        // We use a small timeout to allow React state to update
        setTimeout(checkAuth, 0);
      }
    };

    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, [
    isAuthenticated,
    isLoading,
    isAdmin,
    requireAuth,
    requireAdmin,
    redirectTo,
    router,
    isPublic,
    pathname,
  ]);

  // Show loading state while auth is being checked (including after bfcache restore)
  if (isLoading || !authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div role="status" aria-live="polite" className="mx-auto mb-4">
            <div className="animate-spin h-8 w-8 text-blue-600 mx-auto" aria-hidden="true">
              ⏳
            </div>
            <span className="sr-only">Loading</span>
          </div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // If auth is required but user is not authenticated and not a public route, don't render children
  if (requireAuth && !isAuthenticated && !isPublic) return null;
  if (requireAdmin && !isAdmin) return null;

  return <>{children}</>;
}