/**
 * Sync Queue Manager
 * Processes pending offline actions when the application comes back online.
 * Includes conflict resolution logic.
 */

import {
  getPendingSyncActions,
  removeSyncAction,
  incrementRetry,
  SyncQueueItem,
} from './indexedDB';

const SYNC_API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api/v1';

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error' | 'conflict';
export type SyncEventCallback = (status: SyncStatus, details?: string) => void;

interface SyncManagerConfig {
  onStatusChange?: SyncEventCallback;
  maxConcurrent?: number;
  retryDelay?: number;
}

class SyncManager {
  private isSyncing = false;
  private status: SyncStatus = 'idle';
  private listeners: Set<SyncEventCallback> = new Set();
  private config: Required<SyncManagerConfig>;

  constructor(config: SyncManagerConfig = {}) {
    this.config = {
      onStatusChange: config.onStatusChange || (() => {}),
      maxConcurrent: config.maxConcurrent || 3,
      retryDelay: config.retryDelay || 2000,
    };
    if (this.config.onStatusChange) {
      this.listeners.add(this.config.onStatusChange);
    }
  }

  subscribe(callback: SyncEventCallback): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notify(status: SyncStatus, details?: string) {
    this.status = status;
    this.listeners.forEach((cb) => cb(status, details));
  }

  getStatus(): SyncStatus {
    return this.status;
  }

  /**
   * Process all pending sync queue items.
   */
  async processQueue(): Promise<{ synced: number; failed: number; conflicts: number }> {
    if (this.isSyncing) return { synced: 0, failed: 0, conflicts: 0 };
    this.isSyncing = true;
    this.notify('syncing');

    const pending = await getPendingSyncActions();
    let synced = 0;
    let failed = 0;
    let conflicts = 0;

    // Process in batches to avoid overwhelming the server
    const batches: SyncQueueItem[][] = [];
    for (let i = 0; i < pending.length; i += this.config.maxConcurrent) {
      batches.push(pending.slice(i, i + this.config.maxConcurrent));
    }

    for (const batch of batches) {
      const results = await Promise.allSettled(
        batch.map((item) => this.executeSync(item))
      );

      for (const result of results) {
        if (result.status === 'fulfilled') {
          if (result.value === 'synced') synced++;
          else if (result.value === 'conflict') conflicts++;
          else failed++;
        } else {
          failed++;
        }
      }
    }

    this.isSyncing = false;

    if (conflicts > 0) {
      this.notify('conflict', `${conflicts} item(s) have conflicts`);
    } else if (failed > 0) {
      this.notify('error', `${failed} item(s) failed to sync`);
    } else if (synced > 0) {
      this.notify('success', `${synced} item(s) synced successfully`);
    } else {
      this.notify('idle');
    }

    return { synced, failed, conflicts };
  }

  /**
   * Execute a single sync action with conflict resolution.
   */
  private async executeSync(item: SyncQueueItem): Promise<'synced' | 'conflict' | 'failed'> {
    try {
      const { id, action, endpoint, payload, idempotencyKey, maxRetries, retryCount } = item;

      if (retryCount >= maxRetries) {
        // Remove from queue after max retries
        if (id !== undefined) await removeSyncAction(id);
        return 'failed';
      }

      const url = `${SYNC_API_BASE}${endpoint}`;
      const response = await fetch(url, {
        method: action === 'delete' ? 'DELETE' : action === 'create' ? 'POST' : 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': idempotencyKey,
          'X-Sync-Mode': 'offline',
        },
        body: action !== 'delete' ? JSON.stringify(payload) : undefined,
      });

      if (response.ok) {
        if (id !== undefined) await removeSyncAction(id);
        return 'synced';
      }

      // Handle conflict (409) - apply conflict resolution strategy
      if (response.status === 409) {
        const serverData = await response.json().catch(() => ({}));
        const resolved = await this.resolveConflict(item, serverData);

        if (resolved) {
          // Send resolved data
          const resolveResponse = await fetch(url, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'X-Idempotency-Key': `${idempotencyKey}-resolved`,
              'X-Conflict-Resolution': 'true',
            },
            body: JSON.stringify(resolved),
          });

          if (resolveResponse.ok) {
            if (id !== undefined) await removeSyncAction(id);
            return 'conflict';
          }
        }

        if (id !== undefined) await incrementRetry(id);
        return 'conflict';
      }

      // Other errors: retry later
      if (id !== undefined) await incrementRetry(id);
      return 'failed';
    } catch (error) {
      // Network or other error: will retry
      if (item.id !== undefined) await incrementRetry(item.id);
      return 'failed';
    }
  }

  /**
   * Conflict resolution strategy:
   * - For medical records: last-write-wins based on timestamp
   * - For appointments: server version wins
   * - For general data: merge with server data keeping latest values
   */
  private async resolveConflict(
    localItem: SyncQueueItem,
    serverData: Record<string, unknown>
  ): Promise<Record<string, unknown> | null> {
    const localPayload = localItem.payload as Record<string, unknown>;

    if (!localPayload || !serverData) return null;

    // For endpoints containing 'appointment', server wins
    if (localItem.endpoint.includes('appointment')) {
      return null; // Skip, server data takes precedence
    }

    // For medical records, last-write-wins based on timestamp
    const localTimestamp = (localPayload.updatedAt || localPayload.createdAt || localItem.createdAt) as number;
    const serverTimestamp = (serverData.updatedAt || serverData.createdAt || 0) as number;

    if (localTimestamp >= serverTimestamp) {
      // Local changes are newer, send them
      return { ...localPayload, conflictResolvedAt: Date.now() } as Record<string, unknown>;
    }

    // Server data is newer; merge non-conflicting fields
    const merged = { ...serverData };
    for (const [key, value] of Object.entries(localPayload)) {
      // Only merge if server doesn't have the field or if it's a local-only field
      if (!(key in serverData) || key.startsWith('local_')) {
        merged[key] = value;
      }
    }
    return merged as Record<string, unknown>;
  }
}

// Singleton instance
export const syncManager = new SyncManager();

export default SyncManager;
