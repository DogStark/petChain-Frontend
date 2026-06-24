/**
 * useOffline hook
 * Provides offline status, sync capabilities, and cached data access.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { syncManager, SyncStatus } from '@/lib/offline/syncManager';
import { getCachedData, cacheData, enqueueSyncAction, clearExpiredCache } from '@/lib/offline/indexedDB';

interface OfflineState {
  isOnline: boolean;
  syncStatus: SyncStatus;
  pendingSyncCount: number;
  lastSyncTime: Date | null;
  syncDetails?: string;
}

interface OfflineActions {
  triggerSync: () => Promise<void>;
  getCached: <T>(key: string) => Promise<T | null>;
  setCached: <T>(key: string, data: T, ttl?: number) => Promise<void>;
  queueAction: (action: 'create' | 'update' | 'delete', endpoint: string, payload: unknown, idempotencyKey?: string) => Promise<number>;
  clearOldCache: () => Promise<number>;
}

export function useOffline(): OfflineState & OfflineActions {
  const [state, setState] = useState<OfflineState>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    syncStatus: 'idle',
    pendingSyncCount: 0,
    lastSyncTime: null,
  });
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // Subscribe to sync status changes
    unsubscribeRef.current = syncManager.subscribe((status, details) => {
      setState((prev) => ({
        ...prev,
        syncStatus: status,
        syncDetails: details,
        lastSyncTime: status === 'success' || status === 'conflict' ? new Date() : prev.lastSyncTime,
      }));
    });

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setState((prev) => ({ ...prev, isOnline: true }));
      // Auto-sync when coming back online
      syncManager.processQueue().then((result) => {
        setState((prev) => ({
          ...prev,
          pendingSyncCount: 0,
          syncStatus: result.conflicts > 0 ? 'conflict' : result.failed > 0 ? 'error' : 'idle',
        }));
      });
    };

    const handleOffline = () => {
      setState((prev) => ({ ...prev, isOnline: false, syncStatus: 'idle' }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const triggerSync = useCallback(async () => {
    if (!navigator.onLine) return;
    const result = await syncManager.processQueue();
    setState((prev) => ({
      ...prev,
      pendingSyncCount: 0,
      syncStatus: result.conflicts > 0 ? 'conflict' : result.failed > 0 ? 'error' : 'idle',
      lastSyncTime: new Date(),
    }));
  }, []);

  const getCached = useCallback(async <T>(key: string): Promise<T | null> => {
    return getCachedData<T>(key);
  }, []);

  const setCached = useCallback(async <T>(key: string, data: T, ttl?: number): Promise<void> => {
    return cacheData<T>(key, data, ttl);
  }, []);

  const queueAction = useCallback(
    async (action: 'create' | 'update' | 'delete', endpoint: string, payload: unknown, idempotencyKey?: string): Promise<number> => {
      const key = idempotencyKey || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const id = await enqueueSyncAction(action, endpoint, payload, key);
      setState((prev) => ({ ...prev, pendingSyncCount: prev.pendingSyncCount + 1 }));

      // If online, process immediately
      if (navigator.onLine) {
        syncManager.processQueue().catch(() => {});
      }

      return id;
    },
    []
  );

  const clearOldCache = useCallback(async (): Promise<number> => {
    return clearExpiredCache();
  }, []);

  return {
    ...state,
    triggerSync,
    getCached,
    setCached,
    queueAction,
    clearOldCache,
  };
}
