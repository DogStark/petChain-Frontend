import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

/**
 * Account deletion lifecycle state.
 *
 * - `pending`: deletion requested but not yet confirmed by the backend. This
 *   MUST NOT be treated as completion; the user is still signed in and their
 *   data may still exist server-side.
 * - `confirmed`: deletion has been confirmed. All user-scoped state must be
 *   purged and the user signed out.
 * - `failed`: deletion could not be completed. Only explicitly allowed data
 *   (e.g. the request itself) is preserved so the user can retry.
 */
export type AccountDeletionStatus = 'pending' | 'confirmed' | 'failed';

export interface AccountDeletionState {
  status: AccountDeletionStatus;
  /** Set when the deletion request was accepted but not yet confirmed. */
  requestedAt?: string;
  /** Set when the backend confirmed the deletion. */
  confirmedAt?: string;
  /** Set when the deletion attempt failed. */
  error?: string;
}

export const initialAccountDeletionState: AccountDeletionState = {
  status: 'pending',
};

/**
 * Returns true only when deletion has been explicitly confirmed. Pending and
 * failed states are never considered complete.
 */
export function isAccountDeletionComplete(
  state: AccountDeletionState | null | undefined,
): boolean {
  return state?.status === 'confirmed';
}

/**
 * Purge all user-scoped caches after a confirmed deletion so that back
 * navigation or an offline view cannot reveal protected content.
 *
 * - Clears the in-memory React Query cache.
 * - Removes persisted query cache entries from localStorage/sessionStorage.
 * - Deletes Cache Storage entries used by the service worker.
 */
export async function purgeUserScopedCaches(): Promise<void> {
  queryClient.clear();

  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.removeItem('react-query-cache');
    window.sessionStorage.removeItem('react-query-cache');
  } catch {
    // Storage may be unavailable (private mode, quota); ignore.
  }

  if (typeof caches !== 'undefined') {
    try {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((name) => caches.delete(name)));
    } catch {
      // Cache Storage may be unavailable; ignore.
    }
  }
}
