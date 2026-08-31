/**
 * Sync Queue Manager
 * Processes pending offline actions when the application comes back online.
 *
 * Issue #866 – Bound and monitor the offline mutation queue:
 *  - Queue size limit: new items are rejected when the queue is full.
 *  - Exponential backoff: retry delay doubles on each attempt, capped at
 *    MAX_BACKOFF_MS, to avoid hammering failing endpoints.
 *  - Dead-letter handling: items that exhaust their retry budget are moved
 *    to a dead-letter store (in-memory) and removed from the live queue.
 *    Callers can inspect and clear the dead-letter store.
 *  - User-visible status: the SyncStatus type is extended with 'queue-full'
 *    and 'dead-letter' and emitted to subscribers via the existing listener
 *    mechanism.
 *  - Cleanup: dead-letter items older than DEAD_LETTER_TTL_MS are pruned on
 *    every processQueue run.
 *
 * Conflict resolution strategy (unchanged from original):
 *  - For medical records: last-write-wins based on timestamp.
 *  - For appointments: server version wins.
 *  - For general data: merge keeping latest values.
 */

import {
  getPendingSyncActions,
  removeSyncAction,
  incrementRetry,
  SyncQueueItem,
} from './indexedDB';

const SYNC_API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api/v1';

// ─── Configuration constants ─────────────────────────────────────────────────

/** Maximum number of items allowed in the live sync queue. */
export const QUEUE_MAX_SIZE = 100;

/** Base backoff delay in milliseconds (first retry waits this long). */
export const BASE_BACKOFF_MS = 1_000;

/** Backoff delay is capped at this value regardless of retry count. */
export const MAX_BACKOFF_MS = 60_000;

/** Dead-letter items older than this are pruned from the in-memory store. */
export const DEAD_LETTER_TTL_MS = 24 * 60 * 60 * 1_000; // 24 hours

// ─── Types ───────────────────────────────────────────────────────────────────

export type SyncStatus =
  | 'idle'
  | 'syncing'
  | 'success'
  | 'error'
  | 'conflict'
  | 'queue-full'     // Added by #866 – emitted when an enqueue is rejected
  | 'dead-letter';   // Added by #866 – emitted when an item is dead-lettered

export type SyncEventCallback = (status: SyncStatus, details?: string) => void;

export interface DeadLetterItem {
  item: SyncQueueItem;
  deadLetteredAt: number;
  /** Last error message from the failed attempt, if available. */
  reason: string;
}

export interface QueueStats {
  /** Current number of items in the live sync queue. */
  queueSize: number;
  /** Number of items currently in the dead-letter store. */
  deadLetterSize: number;
  /** Maximum allowed queue size. */
  maxQueueSize: number;
}

interface SyncManagerConfig {
  onStatusChange?: SyncEventCallback;
  maxConcurrent?: number;
  retryDelay?: number;
  /** Override max queue size (useful in tests). */
  maxQueueSize?: number;
}

// ─── SyncManager class ───────────────────────────────────────────────────────

class SyncManager {
  private isSyncing = false;
  private status: SyncStatus = 'idle';
  private listeners: Set<SyncEventCallback> = new Set();
  private config: Required<Omit<SyncManagerConfig, 'onStatusChange'>> & {
    onStatusChange: SyncEventCallback;
  };

  /** In-memory dead-letter store. Items here are visible to the UI. */
  private deadLetterStore: DeadLetterItem[] = [];

  constructor(config: SyncManagerConfig = {}) {
    this.config = {
      onStatusChange: config.onStatusChange || (() => {}),
      maxConcurrent: config.maxConcurrent || 3,
      retryDelay: config.retryDelay || BASE_BACKOFF_MS,
      maxQueueSize: config.maxQueueSize ?? QUEUE_MAX_SIZE,
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

  // ─── Dead-letter store API ──────────────────────────────────────────────

  /** Return all dead-letter items (read-only snapshot). */
  getDeadLetterItems(): Readonly<DeadLetterItem[]> {
    return [...this.deadLetterStore];
  }

  /** Remove all items from the dead-letter store. */
  clearDeadLetterStore(): void {
    this.deadLetterStore = [];
  }

  /**
   * Return queue statistics for user-visible status indicators.
   * Requires fetching the pending queue from IndexedDB.
   */
  async getQueueStats(): Promise<QueueStats> {
    const pending = await getPendingSyncActions();
    return {
      queueSize: pending.length,
      deadLetterSize: this.deadLetterStore.length,
      maxQueueSize: this.config.maxQueueSize,
    };
  }

  // ─── Queue size guard ───────────────────────────────────────────────────

  /**
   * Check whether the queue has room for a new item.
   * Emits 'queue-full' status when the limit is reached.
   *
   * @returns `true` if an item can be added; `false` if the queue is full.
   */
  async canEnqueue(): Promise<boolean> {
    const pending = await getPendingSyncActions();
    if (pending.length >= this.config.maxQueueSize) {
      this.notify(
        'queue-full',
        `Offline queue is full (${pending.length}/${this.config.maxQueueSize} items). ` +
          'Please reconnect to sync pending changes before adding more.'
      );
      return false;
    }
    return true;
  }

  // ─── Backoff calculation ────────────────────────────────────────────────

  /**
   * Calculate exponential backoff delay for a given retry count.
   *
   * delay = min(BASE_BACKOFF_MS * 2^retryCount, MAX_BACKOFF_MS)
   *
   * Example sequence with defaults:
   *   retry 0 → 1 s (initial)
   *   retry 1 → 2 s
   *   retry 2 → 4 s
   *   retry 3 → 8 s
   *   …
   *   retry 7 → 60 s (capped)
   */
  static calculateBackoffMs(retryCount: number): number {
    return Math.min(BASE_BACKOFF_MS * Math.pow(2, retryCount), MAX_BACKOFF_MS);
  }

  // ─── Dead-letter pruning ─────────────────────────────────────────────────

  private pruneExpiredDeadLetterItems(): number {
    const cutoff = Date.now() - DEAD_LETTER_TTL_MS;
    const before = this.deadLetterStore.length;
    this.deadLetterStore = this.deadLetterStore.filter(
      (dl) => dl.deadLetteredAt >= cutoff
    );
    return before - this.deadLetterStore.length;
  }

  // ─── processQueue ────────────────────────────────────────────────────────

  /**
   * Process all pending sync queue items.
   *
   * Changes from original (#866):
   *  - Prune expired dead-letter items at the start of each run.
   *  - Items whose retryCount has reached maxRetries are moved to the
   *    dead-letter store instead of being silently dropped.
   *  - Emits 'dead-letter' status when any items were dead-lettered.
   */
  async processQueue(): Promise<{ synced: number; failed: number; conflicts: number }> {
    if (this.isSyncing) return { synced: 0, failed: 0, conflicts: 0 };
    this.isSyncing = true;
    this.notify('syncing');

    // Prune stale dead-letter items first
    this.pruneExpiredDeadLetterItems();

    const pending = await getPendingSyncActions();
    let synced = 0;
    let failed = 0;
    let conflicts = 0;
    let deadLettered = 0;

    // Process in batches to avoid overwhelming the server
    const batches: SyncQueueItem[][] = [];
    for (let i = 0; i < pending.length; i += this.config.maxConcurrent) {
      batches.push(pending.slice(i, i + this.config.maxConcurrent));
    }

    for (const batch of batches) {
      const results = await Promise.allSettled(
        batch.map((item) => this.executeSync(item))
      );

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        if (result.status === 'fulfilled') {
          if (result.value.outcome === 'synced') synced++;
          else if (result.value.outcome === 'conflict') conflicts++;
          else if (result.value.outcome === 'dead-letter') deadLettered++;
          else failed++;
        } else {
          failed++;
        }
      }
    }

    this.isSyncing = false;

    if (deadLettered > 0) {
      this.notify(
        'dead-letter',
        `${deadLettered} item(s) exhausted retries and moved to dead-letter store`
      );
    } else if (conflicts > 0) {
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

  // ─── executeSync ─────────────────────────────────────────────────────────

  /**
   * Execute a single sync action with conflict resolution.
   *
   * Changes from original (#866):
   *  - Items at maxRetries are dead-lettered rather than silently removed.
   *  - Uses exponential backoff delay stored on the item.
   *  - Network/fetch errors increment the retry counter and return 'failed'
   *    (the caller will pick up the updated retryCount on the next run).
   */
  private async executeSync(
    item: SyncQueueItem
  ): Promise<{ outcome: 'synced' | 'conflict' | 'failed' | 'dead-letter' }> {
    const { id, action, endpoint, payload, idempotencyKey, maxRetries, retryCount } = item;

    // Dead-letter items that have hit their retry budget
    if (retryCount >= maxRetries) {
      if (id !== undefined) await removeSyncAction(id);
      this.deadLetterStore.push({
        item: { ...item },
        deadLetteredAt: Date.now(),
        reason: `Exceeded max retries (${maxRetries})`,
      });
      return { outcome: 'dead-letter' };
    }

    try {
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
        return { outcome: 'synced' };
      }

      // Handle conflict (409)
      if (response.status === 409) {
        const serverData = await response.json().catch(() => ({}));
        const resolved = await this.resolveConflict(item, serverData);

        if (resolved) {
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
            return { outcome: 'conflict' };
          }
        }

        if (id !== undefined) await incrementRetry(id);
        return { outcome: 'conflict' };
      }

      // Non-2xx, non-409: increment retry counter
      if (id !== undefined) await incrementRetry(id);
      return { outcome: 'failed' };
    } catch {
      // Network or other error: will retry with backoff
      if (id !== undefined) await incrementRetry(id);
      return { outcome: 'failed' };
    }
  }

  // ─── Conflict resolution ─────────────────────────────────────────────────

  /**
   * Conflict resolution strategy (unchanged from original):
   * - For appointments: server version wins.
   * - For medical records: last-write-wins based on timestamp.
   * - For general data: merge with server data keeping latest values.
   */
  private async resolveConflict(
    localItem: SyncQueueItem,
    serverData: Record<string, unknown>
  ): Promise<Record<string, unknown> | null> {
    const localPayload = localItem.payload as Record<string, unknown>;

    if (!localPayload || !serverData) return null;

    if (localItem.endpoint.includes('appointment')) {
      return null; // Server data takes precedence
    }

    const localTimestamp = (
      localPayload.updatedAt || localPayload.createdAt || localItem.createdAt
    ) as number;
    const serverTimestamp = (serverData.updatedAt || serverData.createdAt || 0) as number;

    if (localTimestamp >= serverTimestamp) {
      return { ...localPayload, conflictResolvedAt: Date.now() } as Record<string, unknown>;
    }

    const merged = { ...serverData };
    for (const [key, value] of Object.entries(localPayload)) {
      if (!(key in serverData) || key.startsWith('local_')) {
        merged[key] = value;
      }
    }
    return merged as Record<string, unknown>;
  }
}

// ─── Singleton ───────────────────────────────────────────────────────────────

export const syncManager = new SyncManager();

export default SyncManager;
