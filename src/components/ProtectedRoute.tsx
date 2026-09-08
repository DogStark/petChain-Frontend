import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  requireAdmin?: boolean;
  redirectTo?: string;
}

export default function ProtectedRoute({
  children,
  requireAuth = true,
  requireAdmin = false,
  redirectTo = '/login',
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (isLoading) return;
    if (requireAuth && !isAuthenticated) {
      router.push(`${redirectTo}?next=${encodeURIComponent(router.asPath)}`);
      return;
    }
    if (requireAdmin && !isAdmin) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, isLoading, isAdmin, requireAuth, requireAdmin, redirectTo, router]);

  if (isLoading) {
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

  if (requireAuth && !isAuthenticated) return null;
  if (requireAdmin && !isAdmin) return null;

  return <>{children}</>;
}
