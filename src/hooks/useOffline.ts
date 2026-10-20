/**
 * useOffline hook
 * Provides offline status, sync capabilities, and cached data access.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { syncManager, type SyncStatus } from '@/lib/offline/syncManager';
import {
  cacheData,
  clearExpiredCache,
  enqueueSyncAction,
  getCachedData,
  getPendingSyncActions,
} from '@/lib/offline/indexedDB';

interface OfflineState {
  isOnline: boolean;
  syncStatus: SyncStatus;
  pendingSyncCount: number;
  unresolvedConflictIds: string[];
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
  const { user, tokens } = useAuth();
  const ownerId = user?.id;
  const accessToken = tokens?.accessToken;
  const [state, setState] = useState<OfflineState>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    syncStatus: 'idle',
    pendingSyncCount: 0,
    unresolvedConflictIds: [],
    lastSyncTime: null,
  });
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const refreshCounts = useCallback(async () => {
    const [allPending, conflicts] = await Promise.all([
      getPendingSyncActions(),
      syncManager.getUnresolvedConflicts(),
    ]);
    const pending =
      ownerId == null
        ? []
        : allPending.filter((item) => item.ownerId == null || item.ownerId === ownerId);
    const ownedConflicts = conflicts.filter(
      (conflict) => ownerId != null && conflict.ownerId === ownerId,
    );
    setState((prev) => ({
      ...prev,
      pendingSyncCount: pending.length,
      unresolvedConflictIds: ownedConflicts.map((conflict) => conflict.conflictId),
      syncStatus:
        ownedConflicts.length > 0
          ? 'conflict'
          : prev.syncStatus === 'conflict'
            ? 'idle'
            : prev.syncStatus,
      syncDetails:
        ownedConflicts.length > 0
          ? `${ownedConflicts.length} unresolved conflict(s)`
          : prev.syncStatus === 'conflict'
            ? undefined
            : prev.syncDetails,
    }));
  }, [ownerId]);

  useEffect(() => {
    void refreshCounts().catch(() => {
      setState((prev) => ({
        ...prev,
        syncStatus: 'error',
        syncDetails: 'Unable to load sync conflict status',
      }));
    });

    // Subscribe to sync status changes
    unsubscribeRef.current = syncManager.subscribe((status, details) => {
      setState((prev) => ({
        ...prev,
        syncStatus: status,
        syncDetails: details,
        lastSyncTime: status === 'success' || status === 'conflict' ? new Date() : prev.lastSyncTime,
      }));
      if (status !== 'syncing') {
        void refreshCounts().catch(() => {
          setState((prev) => ({
            ...prev,
            syncStatus: 'error',
            syncDetails: 'Unable to load sync conflict status',
          }));
        });
      }
    });

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [refreshCounts]);

  useEffect(() => {
    const handleOnline = () => {
      setState((prev) => ({ ...prev, isOnline: true }));
      // Auto-sync when coming back online
      if (ownerId == null) return;
      syncManager
        .processQueue(ownerId, accessToken)
        .then(async (result) => {
          setState((prev) => ({
            ...prev,
            syncStatus:
              result.conflicts > 0 ? 'conflict' : result.failed > 0 ? 'error' : 'idle',
          }));
          return refreshCounts();
        })
        .catch(() => {
          setState((prev) => ({
            ...prev,
            syncStatus: 'error',
            syncDetails: 'Unable to complete sync',
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
  }, [accessToken, ownerId, refreshCounts]);

  const triggerSync = useCallback(async () => {
    if (!navigator.onLine || ownerId == null) return;
    const result = await syncManager.processQueue(ownerId, accessToken);
    setState((prev) => ({
      ...prev,
      syncStatus: result.conflicts > 0 ? 'conflict' : result.failed > 0 ? 'error' : 'idle',
      lastSyncTime: new Date(),
    }));
    await refreshCounts();
  }, [accessToken, ownerId, refreshCounts]);

  const getCached = useCallback(async <T>(key: string): Promise<T | null> => {
    return getCachedData<T>(key);
  }, []);

  const setCached = useCallback(async <T>(key: string, data: T, ttl?: number): Promise<void> => {
    return cacheData<T>(key, data, ttl);
  }, []);

  const queueAction = useCallback(
    async (action: 'create' | 'update' | 'delete', endpoint: string, payload: unknown, idempotencyKey?: string): Promise<number> => {
      const key = idempotencyKey || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const id = await enqueueSyncAction(action, endpoint, payload, key, undefined, ownerId);
      setState((prev) => ({ ...prev, pendingSyncCount: prev.pendingSyncCount + 1 }));
      await refreshCounts();

      // If online, process immediately
      if (navigator.onLine && ownerId) {
        syncManager.processQueue(ownerId, accessToken).catch(() => {
          setState((prev) => ({
            ...prev,
            syncStatus: 'error',
            syncDetails: 'Unable to complete sync',
          }));
        });
      }

      return id;
    },
    [accessToken, ownerId, refreshCounts]
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
