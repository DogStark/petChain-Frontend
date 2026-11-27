/**
 * useSyncReview hook
 *
 * Exposes the pending sync queue items, unresolved conflict IDs, online status,
 * and a per-item cancellation action for the sync review screen (issue #1142).
 *
 * Privacy: only items that belong to the currently authenticated user are
 * returned. Items with no ownerId are treated as belonging to the current
 * user (legacy queue items created before per-user tagging was added).
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  getPendingSyncActions,
  removeSyncAction,
  type SyncQueueItem,
} from '@/lib/offline/indexedDB';
import { syncManager } from '@/lib/offline/syncManager';
import type { ConflictResolutionStrategy } from '@/lib/offline/syncManager';
import type { SyncConflictSnapshot } from '@/lib/offline/indexedDB';

export interface SyncReviewState {
  /** Pending queue items that belong to the current user. */
  pendingItems: SyncQueueItem[];
  /** Unresolved sync conflicts for the current user. */
  conflicts: SyncConflictSnapshot[];
  /** Current device online status. */
  isOnline: boolean;
  /** True while the initial load is in progress. */
  isLoading: boolean;
  /** Non-null when loading or a cancellation fails. */
  error: string | null;
}

export interface SyncReviewActions {
  /**
   * Cancel (remove) a queued item by its IndexedDB id.
   * Silently ignores items whose id is undefined (not yet committed).
   */
  cancelItem: (id: number) => Promise<void>;
  /** Refresh counts from IndexedDB (useful after external mutations). */
  refresh: () => Promise<void>;
  /**
   * Resolve a conflict with the chosen strategy and refresh the list.
   * `merge` uses the per-field selections; `local`/`server` take that snapshot.
   */
  resolveConflict: (
    conflictId: string,
    strategy: ConflictResolutionStrategy,
    fieldChoices?: Record<string, 'local' | 'server'>,
  ) => Promise<void>;
}

export type UseSyncReviewResult = SyncReviewState & SyncReviewActions;

export function useSyncReview(): UseSyncReviewResult {
  const { user, tokens } = useAuth();
  const ownerId = user?.id ?? null;
  const [state, setState] = useState<SyncReviewState>({
    pendingItems: [],
    conflicts: [],
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    isLoading: true,
    error: null,
  });

  const load = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const [allPending, allConflicts] = await Promise.all([
        getPendingSyncActions(),
        syncManager.getUnresolvedConflicts(),
      ]);

      // Only surface items for the current user; items without an ownerId
      // are treated as owned by the current user (backward-compatible).
      const ownedPending = allPending.filter(
        (item) => ownerId == null || item.ownerId == null || item.ownerId === ownerId,
      );
      const ownedConflicts = allConflicts.filter(
        (conflict) => ownerId != null && conflict.ownerId === ownerId,
      );

      setState((prev) => ({
        ...prev,
        pendingItems: ownedPending,
        conflicts: ownedConflicts,
        isLoading: false,
        error: null,
      }));
    } catch {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: 'Unable to load pending sync changes.',
      }));
    }
  }, [ownerId]);

  // Initial load
  useEffect(() => {
    void load();
  }, [load]);

  // Track online/offline transitions
  useEffect(() => {
    const handleOnline = () => setState((prev) => ({ ...prev, isOnline: true }));
    const handleOffline = () => setState((prev) => ({ ...prev, isOnline: false }));

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const cancelItem = useCallback(
    async (id: number) => {
      try {
        await removeSyncAction(id);
        setState((prev) => ({
          ...prev,
          pendingItems: prev.pendingItems.filter((item) => item.id !== id),
        }));
      } catch {
        setState((prev) => ({
          ...prev,
          error: 'Unable to cancel this change. Please try again.',
        }));
      }
    },
    [],
  );

  const resolveConflict = useCallback(
    async (
      conflictId: string,
      strategy: ConflictResolutionStrategy,
      fieldChoices: Record<string, 'local' | 'server'> = {},
    ) => {
      const conflict = state.conflicts.find((item) => item.conflictId === conflictId);
      if (!conflict) {
        throw new Error('This conflict is no longer available.');
      }

      const resolvedData: Record<string, unknown> = {};
      if (strategy === 'local') {
        Object.assign(resolvedData, conflict.localData);
      } else if (strategy === 'server') {
        Object.assign(resolvedData, conflict.serverData);
      } else {
        const fields = new Set([
          ...Object.keys(conflict.localData),
          ...Object.keys(conflict.serverData),
        ]);
        for (const field of fields) {
          const source = fieldChoices[field] ?? 'server';
          const value =
            source === 'local' ? conflict.localData[field] : conflict.serverData[field];
          if (value !== undefined) resolvedData[field] = value;
        }
      }

      await syncManager.resolveConflict(
        conflictId,
        resolvedData,
        ownerId ?? undefined,
        tokens?.accessToken,
        strategy,
      );
      setState((prev) => ({
        ...prev,
        conflicts: prev.conflicts.filter((item) => item.conflictId !== conflictId),
      }));
    },
    [state.conflicts, ownerId, tokens?.accessToken],
  );

  return {
    ...state,
    cancelItem,
    refresh: load,
    resolveConflict,
  };
}
