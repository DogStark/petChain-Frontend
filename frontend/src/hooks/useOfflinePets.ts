import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface OfflinePetSummary {
  id: string;
  name: string;
  species?: string;
  breed?: string;
  [key: string]: unknown;
}

export interface OfflinePetRecord {
  id: string;
  petId: string;
  recordedAt?: string;
  [key: string]: unknown;
}

export interface OfflinePetEntry {
  pet: OfflinePetSummary;
  records: OfflinePetRecord[];
  pinnedAt: string;
  estimatedBytes: number;
}

export interface OfflinePetsState {
  entries: Record<string, OfflinePetEntry>;
  totalEstimatedBytes: number;
}

export interface UseOfflinePetsOptions {
  /** Account/owner scope so caches never leak across accounts. */
  accountId: string | null | undefined;
  /** Optional storage backend; defaults to window.localStorage. */
  storage?: Storage | null;
  /** Optional byte estimator; defaults to UTF-8 byte length of JSON. */
  estimateBytes?: (value: unknown) => number;
}

export interface UseOfflinePetsResult {
  entries: OfflinePetEntry[];
  isPinned: (petId: string) => boolean;
  pinPet: (pet: OfflinePetSummary, records?: OfflinePetRecord[]) => void;
  unpinPet: (petId: string) => void;
  clearPetCache: (petId: string) => void;
  clearAll: () => void;
  estimateStorageCost: (pet: OfflinePetSummary, records?: OfflinePetRecord[]) => number;
  totalEstimatedBytes: number;
  isAvailable: boolean;
}

const STORAGE_PREFIX = 'petchain.offlinePets.v1';

function defaultEstimateBytes(value: unknown): number {
  try {
    const json = JSON.stringify(value);
    if (typeof TextEncoder !== 'undefined') {
      return new TextEncoder().encode(json).length;
    }
    return json.length;
  } catch {
    return 0;
  }
}

function storageKeyFor(accountId: string): string {
  return `${STORAGE_PREFIX}:${accountId}`;
}

function resolveStorage(storage?: Storage | null): Storage | null {
  if (storage !== undefined) return storage;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    // Access to localStorage can throw in privacy-restricted contexts.
  }
  return null;
}

function readState(storage: Storage | null, accountId: string): OfflinePetsState {
  const empty: OfflinePetsState = { entries: {}, totalEstimatedBytes: 0 };
  if (!storage) return empty;
  try {
    const raw = storage.getItem(storageKeyFor(accountId));
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as OfflinePetsState;
    if (!parsed || typeof parsed !== 'object' || !parsed.entries) return empty;
    const entries: Record<string, OfflinePetEntry> = {};
    let total = 0;
    for (const [petId, entry] of Object.entries(parsed.entries)) {
      if (!entry || typeof entry !== 'object') continue;
      const estimatedBytes = typeof entry.estimatedBytes === 'number' ? entry.estimatedBytes : 0;
      entries[petId] = { ...entry, estimatedBytes };
      total += estimatedBytes;
    }
    return { entries, totalEstimatedBytes: total };
  } catch {
    return empty;
  }
}

function writeState(storage: Storage | null, accountId: string, state: OfflinePetsState): void {
  if (!storage) return;
  try {
    storage.setItem(storageKeyFor(accountId), JSON.stringify(state));
  } catch {
    // Quota or privacy errors should not break the UI.
  }
}

function recomputeTotal(entries: Record<string, OfflinePetEntry>): number {
  return Object.values(entries).reduce((sum, entry) => sum + entry.estimatedBytes, 0);
}

/**
 * Manages user-selected pets that should remain available offline.
 *
 * Pinned pet summaries and recent records are persisted per account so that
 * clearing one pet's cache (or another account's cache) never affects the
 * remaining pinned pets. Authorization and consent remain backend-owned; this
 * hook only stores data the caller has already been permitted to read.
 */
export function useOfflinePets(options: UseOfflinePetsOptions): UseOfflinePetsResult {
  const { accountId, storage, estimateBytes } = options;
  const resolvedStorage = useMemo(() => resolveStorage(storage), [storage]);
  const estimator = estimateBytes ?? defaultEstimateBytes;
  const estimatorRef = useRef(estimator);
  estimatorRef.current = estimator;

  const [state, setState] = useState<OfflinePetsState>(() =>
    accountId ? readState(resolvedStorage, accountId) : { entries: {}, totalEstimatedBytes: 0 },
  );

  useEffect(() => {
    setState(accountId ? readState(resolvedStorage, accountId) : { entries: {}, totalEstimatedBytes: 0 });
  }, [accountId, resolvedStorage]);

  const persist = useCallback(
    (next: OfflinePetsState) => {
      setState(next);
      if (accountId) writeState(resolvedStorage, accountId, next);
    },
    [accountId, resolvedStorage],
  );

  const estimateStorageCost = useCallback(
    (pet: OfflinePetSummary, records: OfflinePetRecord[] = []) =>
      estimatorRef.current({ pet, records }),
    [],
  );

  const pinPet = useCallback(
    (pet: OfflinePetSummary, records: OfflinePetRecord[] = []) => {
      if (!accountId || !pet || !pet.id) return;
      const estimatedBytes = estimatorRef.current({ pet, records });
      const entry: OfflinePetEntry = {
        pet,
        records,
        pinnedAt: new Date().toISOString(),
        estimatedBytes,
      };
      setState((prev) => {
        const entries = { ...prev.entries, [pet.id]: entry };
        const next = { entries, totalEstimatedBytes: recomputeTotal(entries) };
        writeState(resolvedStorage, accountId, next);
        return next;
      });
    },
    [accountId, resolvedStorage],
  );

  const unpinPet = useCallback(
    (petId: string) => {
      if (!accountId) return;
      setState((prev) => {
        if (!prev.entries[petId]) return prev;
        const entries = { ...prev.entries };
        delete entries[petId];
        const next = { entries, totalEstimatedBytes: recomputeTotal(entries) };
        writeState(resolvedStorage, accountId, next);
        return next;
      });
    },
    [accountId, resolvedStorage],
  );

  const clearPetCache = useCallback(
    (petId: string) => {
      if (!accountId) return;
      setState((prev) => {
        const existing = prev.entries[petId];
        if (!existing) return prev;
        const entries = {
          ...prev.entries,
          [petId]: { ...existing, records: [], estimatedBytes: estimatorRef.current({ pet: existing.pet, records: [] }) },
        };
        const next = { entries, totalEstimatedBytes: recomputeTotal(entries) };
        writeState(resolvedStorage, accountId, next);
        return next;
      });
    },
    [accountId, resolvedStorage],
  );

  const clearAll = useCallback(() => {
    if (!accountId) return;
    persist({ entries: {}, totalEstimatedBytes: 0 });
  }, [accountId, persist]);

  const isPinned = useCallback((petId: string) => Boolean(state.entries[petId]), [state.entries]);

  const entries = useMemo(() => Object.values(state.entries), [state.entries]);

  return {
    entries,
    isPinned,
    pinPet,
    unpinPet,
    clearPetCache,
    clearAll,
    estimateStorageCost,
    totalEstimatedBytes: state.totalEstimatedBytes,
    isAvailable: Boolean(accountId) && resolvedStorage !== null,
  };
}

export default useOfflinePets;
