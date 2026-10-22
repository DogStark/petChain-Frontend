import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  cleanupCategory,
  getStorageBreakdown,
  type CleanupResult,
  type StorageBreakdown,
  type StorageCategoryId,
} from '@/lib/offline/storageUsage';

export type StorageBreakdownStatus = 'loading' | 'ready' | 'error' | 'unauthenticated';

export interface UseStorageBreakdown {
  status: StorageBreakdownStatus;
  breakdown: StorageBreakdown | null;
  cleaningId: StorageCategoryId | null;
  cleanupError: string | null;
  refresh: () => Promise<void>;
  /** Clears one category; resolves to null when the cleanup failed. */
  cleanup: (id: StorageCategoryId) => Promise<CleanupResult | null>;
}

/** Reads offline storage usage for the signed-in account and exposes per-category cleanup. */
export function useStorageBreakdown(): UseStorageBreakdown {
  const { user } = useAuth();
  const ownerId = user?.id;
  const [status, setStatus] = useState<StorageBreakdownStatus>('loading');
  const [breakdown, setBreakdown] = useState<StorageBreakdown | null>(null);
  const [cleaningId, setCleaningId] = useState<StorageCategoryId | null>(null);
  const [cleanupError, setCleanupError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!ownerId) {
      setBreakdown(null);
      setStatus('unauthenticated');
      return;
    }
    try {
      setBreakdown(await getStorageBreakdown(ownerId));
      setStatus('ready');
    } catch {
      setBreakdown(null);
      setStatus('error');
    }
  }, [ownerId]);

  useEffect(() => {
    setStatus('loading');
    void refresh();
  }, [refresh]);

  const cleanup = useCallback(
    async (id: StorageCategoryId) => {
      if (!ownerId) return null;
      setCleaningId(id);
      setCleanupError(null);
      try {
        const result = await cleanupCategory(id, ownerId);
        await refresh();
        return result;
      } catch {
        setCleanupError('This storage could not be cleared. Your data was not changed.');
        return null;
      } finally {
        setCleaningId(null);
      }
    },
    [ownerId, refresh]
  );

  return { status, breakdown, cleaningId, cleanupError, refresh, cleanup };
}
