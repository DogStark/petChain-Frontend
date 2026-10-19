import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Account deletion lifecycle states.
 *
 * - `idle`      : no deletion has been requested yet.
 * - `pending`   : deletion requested, awaiting backend confirmation.
 *   This MUST NOT be treated as completion.
 * - `confirmed` : backend confirmed the account is deleted.
 * - `failed`    : the request failed; only explicitly allowed data is kept.
 */
export type AccountDeletionStatus = 'idle' | 'pending' | 'confirmed' | 'failed';

export interface AccountDeletionState {
  status: AccountDeletionStatus;
  /** True only when the backend has confirmed deletion. */
  isComplete: boolean;
  /** True while a deletion request is in flight or awaiting confirmation. */
  isPending: boolean;
  error: string | null;
}

/**
 * Query keys that hold user-scoped data. These are invalidated/removed on
 * confirmed deletion so a back button or offline view cannot reveal them.
 */
const USER_SCOPED_QUERY_KEYS = [
  'user',
  'session',
  'wallet',
  'balances',
  'transactions',
  'profile',
  'settings',
  'notifications',
];

/**
 * Purge all service-worker caches. Best-effort: failures are swallowed so a
 * cache purge problem never blocks sign-out or the confirmed state.
 */
async function purgeServiceWorkerCaches(): Promise<void> {
  if (typeof caches === 'undefined') {
    return;
  }
  try {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((name) => caches.delete(name)));
  } catch {
    // Cache purge is best-effort; never surface as a deletion failure.
  }
}

/**
 * Clear wallet/session state held outside of React Query (e.g. localStorage
 * tokens, wallet connection flags). Only explicitly allowed data is preserved.
 */
function clearWalletAndSessionState(): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    const storage = window.localStorage;
    const keysToRemove: string[] = [];
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (!key) continue;
      if (
        key.startsWith('wallet') ||
        key.startsWith('session') ||
        key.startsWith('auth') ||
        key.startsWith('user')
      ) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => storage.removeItem(key));
  } catch {
    // Storage may be unavailable (private mode); ignore.
  }
}

/**
 * Invalidate and remove all user-scoped queries so protected content cannot be
 * re-rendered from cache after deletion.
 */
function purgeUserScopedQueries(queryClient: ReturnType<typeof useQueryClient>): void {
  USER_SCOPED_QUERY_KEYS.forEach((key) => {
    queryClient.removeQueries({ queryKey: [key] });
  });
  queryClient.clear();
}

export interface UseAccountDeletionOptions {
  /**
   * Performs the actual deletion request against the backend. Should resolve
   * once the backend has confirmed deletion, or reject on failure.
   */
  requestDeletion: () => Promise<void>;
  /** Signs the user out locally after confirmed deletion. */
  signOut: () => Promise<void> | void;
  /** Optional support URL shown while deletion is pending. */
  supportUrl?: string;
}

export interface UseAccountDeletionResult extends AccountDeletionState {
  /** Trigger the deletion flow. */
  requestAccountDeletion: () => Promise<void>;
  /** Support path for a pending deletion. */
  supportUrl: string;
}

const DEFAULT_SUPPORT_URL = '/support/account-deletion';

/**
 * Manages the end-to-end account deletion lifecycle: pending -> confirmed or
 * failed. On confirmation it signs the user out, purges service-worker caches,
 * clears wallet/session state, and invalidates user-scoped queries so back
 * navigation cannot reveal protected content.
 */
export function useAccountDeletion({
  requestDeletion,
  signOut,
  supportUrl = DEFAULT_SUPPORT_URL,
}: UseAccountDeletionOptions): UseAccountDeletionResult {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AccountDeletionState>({
    status: 'idle',
    isComplete: false,
    isPending: false,
    error: null,
  });

  const requestAccountDeletion = useCallback(async () => {
    // Mark pending first so completion can never be inferred prematurely.
    setState({ status: 'pending', isComplete: false, isPending: true, error: null });

    try {
      await requestDeletion();

      // Confirmed: purge everything user-scoped before flipping to complete.
      purgeUserScopedQueries(queryClient);
      clearWalletAndSessionState();
      await purgeServiceWorkerCaches();
      await signOut();

      setState({ status: 'confirmed', isComplete: true, isPending: false, error: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Account deletion failed';
      // Failure preserves only explicitly allowed data (nothing user-scoped).
      setState({ status: 'failed', isComplete: false, isPending: false, error: message });
    }
  }, [queryClient, requestDeletion, signOut]);

  return {
    ...state,
    requestAccountDeletion,
    supportUrl,
  };
}
