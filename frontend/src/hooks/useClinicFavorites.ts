import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface ClinicFavorite {
  clinicId: string;
  favorited: boolean;
  /** Monotonic client-side version used for deterministic conflict resolution. */
  updatedAt: number;
}

export interface ClinicFavoritesClient {
  /** Fetch the authoritative favorites for the signed-in user. */
  list: () => Promise<ClinicFavorite[]>;
  /** Persist a single favorite change. Backend owns authorization/consent. */
  setFavorite: (favorite: ClinicFavorite) => Promise<ClinicFavorite>;
}

export interface UseClinicFavoritesOptions {
  client: ClinicFavoritesClient;
  /** Whether the user is signed in. When false, no network calls are made. */
  enabled?: boolean;
  /** Optional local persistence for offline changes. */
  storage?: Pick<Storage, 'getItem' | 'setItem'>;
  storageKey?: string;
}

export interface UseClinicFavoritesResult {
  favorites: Record<string, boolean>;
  isLoading: boolean;
  isSyncing: boolean;
  error: string | null;
  isFavorite: (clinicId: string) => boolean;
  toggleFavorite: (clinicId: string) => void;
  sync: () => Promise<void>;
}

const DEFAULT_STORAGE_KEY = 'petchain:clinic-favorites';

/**
 * Deterministic conflict resolution: the entry with the greater `updatedAt`
 * wins. Ties are broken by preferring the local (pending) change so an
 * offline toggle is never silently dropped.
 */
export function resolveFavorite(
  local: ClinicFavorite | undefined,
  remote: ClinicFavorite | undefined,
): ClinicFavorite | undefined {
  if (!local) return remote;
  if (!remote) return local;
  if (local.updatedAt === remote.updatedAt) return local;
  return local.updatedAt > remote.updatedAt ? local : remote;
}

function readStored(storage: UseClinicFavoritesOptions['storage'], key: string): Record<string, ClinicFavorite> {
  if (!storage) return {};
  try {
    const raw = storage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, ClinicFavorite>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeStored(
  storage: UseClinicFavoritesOptions['storage'],
  key: string,
  value: Record<string, ClinicFavorite>,
): void {
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore quota/serialization failures; in-memory state remains authoritative.
  }
}

export function useClinicFavorites({
  client,
  enabled = true,
  storage,
  storageKey = DEFAULT_STORAGE_KEY,
}: UseClinicFavoritesOptions): UseClinicFavoritesResult {
  const [entries, setEntries] = useState<Record<string, ClinicFavorite>>(() =>
    readStored(storage, storageKey),
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const persist = useCallback(
    (next: Record<string, ClinicFavorite>) => {
      setEntries(next);
      writeStored(storage, storageKey, next);
    },
    [storage, storageKey],
  );

  const sync = useCallback(async () => {
    if (!enabled) return;
    setIsSyncing(true);
    setError(null);
    try {
      const remoteList = await client.list();
      const remoteMap: Record<string, ClinicFavorite> = {};
      for (const item of remoteList) remoteMap[item.clinicId] = item;

      setEntries((current) => {
        const merged: Record<string, ClinicFavorite> = { ...remoteMap };
        for (const [clinicId, local] of Object.entries(current)) {
          const resolved = resolveFavorite(local, remoteMap[clinicId]);
          if (resolved) merged[clinicId] = resolved;
        }
        writeStored(storage, storageKey, merged);
        return merged;
      });

      // Push any local changes that won conflict resolution.
      const pending = Object.values(readStored(storage, storageKey)).filter((local) => {
        const remote = remoteMap[local.clinicId];
        return !remote || local.updatedAt > remote.updatedAt;
      });
      for (const favorite of pending) {
        await client.setFavorite(favorite);
      }
    } catch (err) {
      if (mounted.current) {
        setError(err instanceof Error ? err.message : 'Unable to sync clinic favorites.');
      }
    } finally {
      if (mounted.current) setIsSyncing(false);
    }
  }, [client, enabled, storage, storageKey]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setIsLoading(true);
    client
      .list()
      .then((remoteList) => {
        if (cancelled) return;
        const remoteMap: Record<string, ClinicFavorite> = {};
        for (const item of remoteList) remoteMap[item.clinicId] = item;
        setEntries((current) => {
          const merged: Record<string, ClinicFavorite> = { ...remoteMap };
          for (const [clinicId, local] of Object.entries(current)) {
            const resolved = resolveFavorite(local, remoteMap[clinicId]);
            if (resolved) merged[clinicId] = resolved;
          }
          writeStored(storage, storageKey, merged);
          return merged;
        });
      })
      .catch((err) => {
        if (!cancelled && mounted.current) {
          setError(err instanceof Error ? err.message : 'Unable to load clinic favorites.');
        }
      })
      .finally(() => {
        if (!cancelled && mounted.current) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [client, enabled, storage, storageKey]);

  const toggleFavorite = useCallback(
    (clinicId: string) => {
      const current = entries[clinicId];
      const next: ClinicFavorite = {
        clinicId,
        favorited: !(current?.favorited ?? false),
        updatedAt: Date.now(),
      };
      const nextEntries = { ...entries, [clinicId]: next };
      persist(nextEntries);

      if (!enabled) return;
      client.setFavorite(next).catch((err) => {
        if (mounted.current) {
          setError(err instanceof Error ? err.message : 'Unable to save clinic favorite.');
        }
      });
    },
    [client, enabled, entries, persist],
  );

  const favorites = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const [clinicId, entry] of Object.entries(entries)) {
      map[clinicId] = entry.favorited;
    }
    return map;
  }, [entries]);

  const isFavorite = useCallback((clinicId: string) => favorites[clinicId] ?? false, [favorites]);

  return { favorites, isLoading, isSyncing, error, isFavorite, toggleFavorite, sync };
}
