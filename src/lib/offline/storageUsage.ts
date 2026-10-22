/**
 * Account-level offline storage usage and safe cleanup.
 *
 * Usage is reported per category (cache, queued changes, attachments) as counts
 * and approximate sizes only: keys, endpoints and payload contents are never
 * exposed. Authorization and consent decisions stay with the backend; this
 * module only scopes what it reads and removes to the signed-in account.
 *
 * Each category is a handler registered in CATEGORY_HANDLERS, so adding a new
 * category (e.g. persisted attachments) does not change the public functions.
 */

import {
  evictCacheEntries,
  evictRecordEntries,
  getAllCacheEntries,
  getAllRecordEntries,
  getPendingSyncActions,
  getUnresolvedSyncConflicts,
  removeSyncAction,
  type SyncQueueItem,
} from './indexedDB';
import { estimateStorageUsage, type StorageUsageEstimate } from './storageManager';

export type StorageCategoryId = 'cache' | 'queuedChanges' | 'attachments';

export interface CategoryUsage {
  id: StorageCategoryId;
  itemCount: number;
  /** Approximate size in bytes (serialized length). */
  bytes: number;
  /** Items that can be removed without losing unsynced user work. */
  cleanableCount: number;
}

export interface StorageBreakdown {
  categories: CategoryUsage[];
  totalBytes: number;
  /** Browser-wide estimate for the whole origin, when the Storage API exists. */
  browserEstimate: StorageUsageEstimate | null;
}

export interface CleanupResult {
  id: StorageCategoryId;
  removed: number;
}

type Measurement = Omit<CategoryUsage, 'id'>;

interface CategoryHandler {
  measure(ownerId: string): Promise<Measurement>;
  cleanup(ownerId: string): Promise<number>;
}

export const CATEGORY_ORDER: readonly StorageCategoryId[] = [
  'cache',
  'queuedChanges',
  'attachments',
];

/** Approximate serialized size of a value; 0 when it cannot be serialized. */
function sizeOf(value: unknown): number {
  try {
    return new Blob([JSON.stringify(value) ?? '']).size;
  } catch {
    return 0;
  }
}

const sumSizes = (values: unknown[]): number =>
  values.reduce<number>((total, v) => total + sizeOf(v), 0);

/** Same ownership rule as useOffline: unowned legacy items belong to the current user. */
const isOwnedItem = (item: SyncQueueItem, ownerId: string): boolean =>
  item.ownerId == null || item.ownerId === ownerId;

/** Items that used up every retry; the sync manager would dead-letter them next run. */
const isExhausted = (item: SyncQueueItem): boolean => item.retryCount >= item.maxRetries;

const cacheHandler: CategoryHandler = {
  async measure() {
    const entries = [...(await getAllCacheEntries()), ...(await getAllRecordEntries())];
    // Everything here can be re-downloaded, so all of it is safe to clear.
    return { itemCount: entries.length, bytes: sumSizes(entries), cleanableCount: entries.length };
  },
  async cleanup() {
    const cache = await evictCacheEntries(Infinity);
    const records = await evictRecordEntries(Infinity);
    return cache + records;
  },
};

const queuedChangesHandler: CategoryHandler = {
  async measure(ownerId) {
    const pending = (await getPendingSyncActions()).filter((item) => isOwnedItem(item, ownerId));
    const conflicts = (await getUnresolvedSyncConflicts()).filter((c) => c.ownerId === ownerId);
    return {
      itemCount: pending.length + conflicts.length,
      bytes: sumSizes([...pending, ...conflicts]),
      // Unresolved conflicts hold the user's local edits, so they are never cleanable.
      cleanableCount: pending.filter(isExhausted).length,
    };
  },
  async cleanup(ownerId) {
    const pending = await getPendingSyncActions();
    const removable = pending.filter(
      (item) => isOwnedItem(item, ownerId) && isExhausted(item) && item.id !== undefined
    );
    for (const item of removable) {
      await removeSyncAction(item.id as number);
    }
    return removable.length;
  },
};

// Attachments are not persisted offline yet. The handler exists so the category
// is reported (as empty) and can be filled in when an attachment store lands.
const attachmentsHandler: CategoryHandler = {
  async measure() {
    return { itemCount: 0, bytes: 0, cleanableCount: 0 };
  },
  async cleanup() {
    return 0;
  },
};

const CATEGORY_HANDLERS: Record<StorageCategoryId, CategoryHandler> = {
  cache: cacheHandler,
  queuedChanges: queuedChangesHandler,
  attachments: attachmentsHandler,
};

export async function getStorageBreakdown(ownerId: string): Promise<StorageBreakdown> {
  const [measurements, browserEstimate] = await Promise.all([
    Promise.all(CATEGORY_ORDER.map((id) => CATEGORY_HANDLERS[id].measure(ownerId))),
    estimateStorageUsage(),
  ]);

  const categories = CATEGORY_ORDER.map((id, index) => ({ id, ...measurements[index] }));
  return {
    categories,
    totalBytes: categories.reduce((total, c) => total + c.bytes, 0),
    browserEstimate,
  };
}

export async function cleanupCategory(
  id: StorageCategoryId,
  ownerId: string
): Promise<CleanupResult> {
  const removed = await CATEGORY_HANDLERS[id].cleanup(ownerId);
  return { id, removed };
}
