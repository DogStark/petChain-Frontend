/**
 * Storage quota estimation and eviction handling for offline-first features.
 *
 * Queued mutations (the sync queue) are treated as essential and are NEVER
 * evicted. Non-essential cached data (cache store first, then offline record
 * snapshots) is evicted oldest-first when a write hits a quota error, and a
 * storage-pressure event is surfaced so the UI can offer a recovery path.
 */

export type StoragePressureEvent =
  | { type: 'quota-exceeded'; store: 'cache' | 'records' | 'syncQueue'; message: string }
  | { type: 'evicted'; store: 'cache' | 'records'; removed: number }
  | { type: 'quota-ok' };

export type StorageEventListener = (event: StoragePressureEvent) => void;

export interface StorageUsageEstimate {
  usage: number;
  quota: number;
  percentUsed: number;
}

const listeners = new Set<StorageEventListener>();

/** Subscribes to storage-pressure events. Returns an unsubscribe function. */
export function subscribeToStorageEvents(listener: StorageEventListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit(event: StoragePressureEvent): void {
  listeners.forEach((listener) => listener(event));
}

/** Publishes a storage-pressure event to all subscribers. */
export function reportStorageEvent(event: StoragePressureEvent): void {
  emit(event);
}

/**
 * Estimates current storage usage via the Storage API.
 * Returns null when the API is unavailable (e.g. non-secure context or older
 * browsers) so callers can degrade gracefully.
 */
export async function estimateStorageUsage(): Promise<StorageUsageEstimate | null> {
  try {
    const nav = navigator as Navigator & {
      storage?: { estimate?: () => Promise<{ usage?: number; quota?: number }> };
    };
    if (!nav.storage?.estimate) return null;
    const { usage = 0, quota = 0 } = await nav.storage.estimate();
    return {
      usage,
      quota,
      percentUsed: quota > 0 ? (usage / quota) * 100 : 0,
    };
  } catch {
    return null;
  }
}

/**
 * Returns true when an error represents a browser storage-quota violation,
 * regardless of the browser's error naming (Chrome vs Firefox variants).
 */
export function isQuotaExceededError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED')
  );
}

/** Emits a quota-ok event; useful after a successful recovery action. */
export function notifyQuotaOk(): void {
  emit({ type: 'quota-ok' });
}
