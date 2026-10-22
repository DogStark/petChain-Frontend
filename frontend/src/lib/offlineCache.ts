// User-managed offline availability for selected pets.
//
// Pinned pet summaries and recent records are stored in localStorage under a
// per-account namespace so that clearing one pet's cache never touches other
// accounts (or other pets). Authorization and consent decisions remain owned by
// the backend; this module only persists data the caller already fetched.

export interface OfflinePetSummary {
  id: string;
  name: string;
  species?: string;
  breed?: string;
  updatedAt?: string;
}

export interface OfflinePetRecord {
  id: string;
  petId: string;
  kind: string;
  occurredAt?: string;
  summary?: string;
}

export interface OfflinePetEntry {
  petId: string;
  summary: OfflinePetSummary | null;
  records: OfflinePetRecord[];
  pinnedAt: string;
}

export interface OfflineStorageEstimate {
  petId: string;
  bytes: number;
  recordCount: number;
}

const STORAGE_PREFIX = 'petchain.offline.v1';
const MAX_RECENT_RECORDS = 25;

function storageKey(accountId: string, petId: string): string {
  return `${STORAGE_PREFIX}:${accountId}:${petId}`;
}

function accountPrefix(accountId: string): string {
  return `${STORAGE_PREFIX}:${accountId}:`;
}

function getStorage(): Storage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return null;
    }
    return window.localStorage;
  } catch {
    return null;
  }
}

function byteLength(value: string): number {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(value).length;
  }
  return value.length;
}

function isOfflinePetEntry(value: unknown): value is OfflinePetEntry {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const entry = value as Partial<OfflinePetEntry>;
  return (
    typeof entry.petId === 'string' &&
    Array.isArray(entry.records) &&
    typeof entry.pinnedAt === 'string'
  );
}

/**
 * Pin a pet for offline use. Only the summary and the most recent records are
 * kept, capped at MAX_RECENT_RECORDS to bound storage growth.
 */
export function pinPetForOffline(
  accountId: string,
  petId: string,
  summary: OfflinePetSummary | null,
  records: OfflinePetRecord[] = [],
): OfflinePetEntry | null {
  const storage = getStorage();
  if (!storage || !accountId || !petId) {
    return null;
  }

  const entry: OfflinePetEntry = {
    petId,
    summary,
    records: records.slice(0, MAX_RECENT_RECORDS),
    pinnedAt: new Date().toISOString(),
  };

  try {
    storage.setItem(storageKey(accountId, petId), JSON.stringify(entry));
    return entry;
  } catch {
    // Quota exceeded or storage disabled: fail closed without throwing.
    return null;
  }
}

/** Read a pinned pet entry, or null when it is not available offline. */
export function getOfflinePet(
  accountId: string,
  petId: string,
): OfflinePetEntry | null {
  const storage = getStorage();
  if (!storage || !accountId || !petId) {
    return null;
  }

  try {
    const raw = storage.getItem(storageKey(accountId, petId));
    if (!raw) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    return isOfflinePetEntry(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** List all pets pinned for offline use for a single account. */
export function listOfflinePets(accountId: string): OfflinePetEntry[] {
  const storage = getStorage();
  if (!storage || !accountId) {
    return [];
  }

  const prefix = accountPrefix(accountId);
  const entries: OfflinePetEntry[] = [];

  try {
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (!key || !key.startsWith(prefix)) {
        continue;
      }
      const raw = storage.getItem(key);
      if (!raw) {
        continue;
      }
      try {
        const parsed: unknown = JSON.parse(raw);
        if (isOfflinePetEntry(parsed)) {
          entries.push(parsed);
        }
      } catch {
        // Skip corrupt entries rather than failing the whole listing.
      }
    }
  } catch {
    return entries;
  }

  return entries.sort((a, b) => a.pinnedAt.localeCompare(b.pinnedAt));
}

/**
 * Estimate the storage cost of a pet's offline cache. Returns zeroed values
 * when the pet is not pinned.
 */
export function estimateOfflineStorage(
  accountId: string,
  petId: string,
): OfflineStorageEstimate {
  const storage = getStorage();
  const empty: OfflineStorageEstimate = { petId, bytes: 0, recordCount: 0 };
  if (!storage || !accountId || !petId) {
    return empty;
  }

  try {
    const raw = storage.getItem(storageKey(accountId, petId));
    if (!raw) {
      return empty;
    }
    const parsed: unknown = JSON.parse(raw);
    const recordCount = isOfflinePetEntry(parsed) ? parsed.records.length : 0;
    return { petId, bytes: byteLength(raw), recordCount };
  } catch {
    return empty;
  }
}

/**
 * Clear a single pet's offline cache for one account. Other pets and other
 * accounts are left untouched. Returns true when an entry was removed.
 */
export function clearOfflinePet(accountId: string, petId: string): boolean {
  const storage = getStorage();
  if (!storage || !accountId || !petId) {
    return false;
  }

  try {
    const key = storageKey(accountId, petId);
    if (storage.getItem(key) === null) {
      return false;
    }
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

/** Human-readable storage size for display next to the pin toggle. */
export function formatStorageBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B';
  }
  if (bytes < 1024) {
    return `${Math.round(bytes)} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
