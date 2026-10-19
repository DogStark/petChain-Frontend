/**
 * IndexedDB helper for offline-first data storage.
 *
 * Storage-quota safety:
 * - Queued mutations (syncQueue) are essential and are never evicted.
 * - When a write fails with a quota error, non-essential data is evicted
 *   oldest-first (cache store first, then offline record snapshots) and the
 *   write is retried once.
 * - If eviction cannot free enough space, a `quota-exceeded` storage event is
 *   published so the UI can surface an actionable recovery path.
 */

import { isQuotaExceededError, reportStorageEvent } from './storageManager';

const DB_NAME = 'petchain-offline';
const DB_VERSION = 1;

/** How many entries to evict per recovery pass (oldest first). */
const EVICTION_BATCH = 20;

export interface OfflineCacheEntry<T = unknown> {
  key: string;
  data: T;
  timestamp: number;
  ttl?: number;
}

export interface SyncQueueItem {
  id?: number;
  action: 'create' | 'update' | 'delete';
  endpoint: string;
  payload: unknown;
  createdAt: number;
  retryCount: number;
  maxRetries: number;
  idempotencyKey: string;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('cache')) {
        const cacheStore = db.createObjectStore('cache', { keyPath: 'key' });
        cacheStore.createIndex('timestamp', 'timestamp', { unique: false });
        cacheStore.createIndex('ttl', 'ttl', { unique: false });
      }
      if (!db.objectStoreNames.contains('syncQueue')) {
        const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
        syncStore.createIndex('createdAt', 'createdAt', { unique: false });
        syncStore.createIndex('idempotencyKey', 'idempotencyKey', { unique: true });
        syncStore.createIndex('retryCount', 'retryCount', { unique: false });
      }
      if (!db.objectStoreNames.contains('records')) {
        const recordsStore = db.createObjectStore('records', { keyPath: 'key' });
        recordsStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
    request.onsuccess = (event) => resolve((event.target as IDBOpenDBRequest).result);
    request.onerror = (event) => reject((event.target as IDBOpenDBRequest).error);
  });
}

export async function cacheData<T>(key: string, data: T, ttl?: number): Promise<void> {
  const write = async (): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('cache', 'readwrite');
      const store = tx.objectStore('cache');
      const entry: OfflineCacheEntry<T> = { key, data, timestamp: Date.now(), ...(ttl !== undefined ? { ttl } : {}) };
      const request = store.put(entry);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      tx.oncomplete = () => db.close();
    });
  };
  return withQuotaRecovery('cache', write);
}

export async function getCachedData<T>(key: string): Promise<T | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('cache', 'readonly');
    const store = tx.objectStore('cache');
    const request = store.get(key);
    request.onsuccess = () => {
      const entry = request.result as OfflineCacheEntry<T> | undefined;
      if (!entry) { db.close(); resolve(null); return; }
      if (entry.ttl && Date.now() - entry.timestamp > entry.ttl) {
        const deleteTx = db.transaction('cache', 'readwrite');
        deleteTx.objectStore('cache').delete(key);
        deleteTx.oncomplete = () => db.close();
        resolve(null);
        return;
      }
      db.close();
      resolve(entry.data);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function removeCachedData(key: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('cache', 'readwrite');
    const request = tx.objectStore('cache').delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

export async function clearExpiredCache(): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('cache', 'readwrite');
    const store = tx.objectStore('cache');
    const index = store.index('ttl');
    const range = IDBKeyRange.lowerBound(0);
    const request = index.openCursor(range);
    let cleared = 0;
    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        const entry = cursor.value as OfflineCacheEntry;
        if (entry.ttl && Date.now() - entry.timestamp > entry.ttl) {
          cursor.delete();
          cleared++;
        }
        cursor.continue();
      } else {
        resolve(cleared);
      }
    };
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

/**
 * Evicts the oldest `limit` entries from the cache store (least-essential data).
 * Returns the number of entries removed.
 */
export async function evictCacheEntries(limit = EVICTION_BATCH): Promise<number> {
  return evictOldestEntries('cache', limit);
}

/**
 * Evicts the oldest `limit` entries from the offline records store. Records can
 * be re-fetched from the backend, so they are evicted only after the cache
 * store has been exhausted. The sync queue is never touched.
 */
export async function evictRecordEntries(limit = EVICTION_BATCH): Promise<number> {
  return evictOldestEntries('records', limit);
}

function evictOldestEntries(
  storeName: 'cache' | 'records',
  limit: number
): Promise<number> {
  const dbPromise = openDB();
  return dbPromise.then((db) =>
    new Promise<number>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const index = store.index('timestamp');
      const request = index.openCursor();
      let removed = 0;
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor && removed < limit) {
          cursor.delete();
          removed++;
          cursor.continue();
        } else if (!cursor) {
          resolve(removed);
        }
      };
      request.onerror = () => reject(request.error);
      tx.oncomplete = () => db.close();
    })
  );
}

/**
 * Runs a readwrite operation with quota-error recovery: on QuotaExceededError,
 * evicts non-essential data (cache first, then offline records), retries the
 * operation once, and publishes storage-pressure events. The sync queue is
 * never evicted.
 */
async function withQuotaRecovery<T>(
  store: 'cache' | 'records' | 'syncQueue',
  operation: () => Promise<T>
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!isQuotaExceededError(error)) throw error;

    const evictedCache = await evictCacheEntries();
    const evictedRecords = await evictRecordEntries();
    const evictedTotal = evictedCache + evictedRecords;

    if (evictedTotal > 0) {
      reportStorageEvent({
        type: 'evicted',
        store: store === 'syncQueue' ? 'cache' : store,
        removed: evictedTotal,
      });

      try {
        return await operation();
      } catch (retryError) {
        if (isQuotaExceededError(retryError)) {
          reportStorageEvent({
            type: 'quota-exceeded',
            store,
            message:
              'Storage is full and cached data could not be freed. ' +
              'Your queued offline changes are safe. Free up space to continue using offline features.',
          });
        }
        throw retryError;
      }
    }

    reportStorageEvent({
      type: 'quota-exceeded',
      store,
      message:
        'Storage is full. Your queued offline changes are safe, but new offline ' +
        'data cannot be saved until space is freed.',
    });
    throw error;
  }
}

export async function enqueueSyncAction(
  action: SyncQueueItem['action'],
  endpoint: string,
  payload: unknown,
  idempotencyKey: string,
  maxRetries = 3
): Promise<number> {
  const write = async (): Promise<number> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('syncQueue', 'readwrite');
      const store = tx.objectStore('syncQueue');
      const item: Omit<SyncQueueItem, 'id'> = { action, endpoint, payload, createdAt: Date.now(), retryCount: 0, maxRetries, idempotencyKey };
      const request = store.add(item);
      request.onsuccess = () => resolve(request.result as number);
      request.onerror = () => reject(request.error);
      tx.oncomplete = () => db.close();
    });
  };
  // Queued mutations are essential — they are never evicted. If the write still
  // fails after evicting non-essential data, the error is surfaced with a
  // recovery message while the caller retains the action to enqueue later.
  return withQuotaRecovery('syncQueue', write);
}

export async function getPendingSyncActions(): Promise<SyncQueueItem[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('syncQueue', 'readonly');
    const store = tx.objectStore('syncQueue');
    const index = store.index('createdAt');
    const request = index.getAll();
    request.onsuccess = () => { db.close(); resolve(request.result as SyncQueueItem[]); };
    request.onerror = () => reject(request.error);
  });
}

export async function removeSyncAction(id: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('syncQueue', 'readwrite');
    const request = tx.objectStore('syncQueue').delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

export async function incrementRetry(id: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('syncQueue', 'readwrite');
    const store = tx.objectStore('syncQueue');
    const getRequest = store.get(id);
    getRequest.onsuccess = () => {
      const item = getRequest.result as SyncQueueItem | undefined;
      if (item) { item.retryCount += 1; store.put(item); }
    };
    getRequest.onerror = () => reject(getRequest.error);
    tx.oncomplete = () => db.close();
    resolve();
  });
}

export async function storeOfflineRecord<T>(key: string, data: T): Promise<void> {
  const write = async (): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('records', 'readwrite');
      const store = tx.objectStore('records');
      const entry: OfflineCacheEntry<T> = { key, data, timestamp: Date.now() };
      const request = store.put(entry);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      tx.oncomplete = () => db.close();
    });
  };
  return withQuotaRecovery('records', write);
}

export async function getOfflineRecord<T>(key: string): Promise<T | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('records', 'readonly');
    const store = tx.objectStore('records');
    const request = store.get(key);
    request.onsuccess = () => { db.close(); const entry = request.result as OfflineCacheEntry<T> | undefined; resolve(entry ? entry.data : null); };
    request.onerror = () => reject(request.error);
  });
}

export async function getAllOfflineRecordKeys(): Promise<string[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('records', 'readonly');
    const store = tx.objectStore('records');
    const request = store.getAllKeys();
    request.onsuccess = () => { db.close(); resolve(request.result as string[]); };
    request.onerror = () => reject(request.error);
  });
}
