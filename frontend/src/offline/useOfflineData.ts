import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * Centralized stale-data policy for offline pet views.
 *
 * Thresholds are expressed in milliseconds and are the single source of truth
 * for how long cached data of a given type is considered "current" before it
 * is surfaced as "stale". Keep this table in sync with the offline UX docs.
 *
 * - medical:   clinical records change slowly, but should be re-verified daily.
 * - emergency: emergency contacts / critical info must be fresh; short window.
 * - profile:   basic pet profile data is stable; long window.
 * - default:   fallback for any unclassified offline data type.
 */
export const STALE_THRESHOLDS_MS: Record<OfflineDataType, number> = {
  medical: 24 * 60 * 60 * 1000, // 24h
  emergency: 6 * 60 * 60 * 1000, // 6h
  profile: 7 * 24 * 60 * 60 * 1000, // 7d
  default: 24 * 60 * 60 * 1000, // 24h
};

/**
 * Clock skew tolerance: if a cached timestamp is in the future by more than
 * this amount we treat the clock as skewed and fall back to "stale" rather
 * than trusting a bogus "fresh" reading.
 */
export const CLOCK_SKEW_TOLERANCE_MS = 5 * 60 * 1000; // 5m

export type OfflineDataType = 'medical' | 'emergency' | 'profile' | 'default';

/**
 * Lifecycle state of an offline-capable view.
 * - no-cache: nothing cached locally yet.
 * - cached:   served from cache, age unknown or not yet evaluated.
 * - syncing:  a refresh is in flight.
 * - current:  cached data is within its stale threshold.
 * - stale:    cached data is older than its threshold (or clock is skewed).
 * - error:    the last refresh attempt failed.
 */
export type OfflineDataState =
  | 'no-cache'
  | 'cached'
  | 'syncing'
  | 'current'
  | 'stale'
  | 'error';

export interface OfflineDataSnapshot<T> {
  data: T | null;
  /** Epoch ms of the last successful sync, or null when never synced. */
  lastSyncedAt: number | null;
  /** Epoch ms of the last verification (e.g. emergency data confirmation). */
  lastVerifiedAt: number | null;
  /** Local revision counter used to detect newer local edits. */
  localRevision: number;
}

export interface OfflineDataResult<T> {
  data: T | null;
  state: OfflineDataState;
  /** Age of the cached data in ms, or null when there is no cache. */
  ageMs: number | null;
  lastSyncedAt: number | null;
  lastVerifiedAt: number | null;
  /** True when the cached data is older than its type threshold. */
  isStale: boolean;
  /** True when a refresh is currently in flight. */
  isSyncing: boolean;
  /** True when the last refresh failed. */
  isError: boolean;
  /** Human-readable, non-sensitive status label for the view. */
  statusLabel: string;
  /**
   * Trigger a refresh. Cancellable via the returned abort handle and safe
   * against overwriting newer local edits (revision is checked on resolve).
   */
  refresh: () => RefreshHandle;
}

export interface RefreshHandle {
  /** Abort the in-flight refresh; resolves the promise as cancelled. */
  cancel: () => void;
  /** Resolves true when applied, false when cancelled or superseded. */
  done: Promise<boolean>;
}

export interface UseOfflineDataOptions<T> {
  type: OfflineDataType;
  /** Reads the current cached snapshot (may be async). */
  readCache: () => Promise<OfflineDataSnapshot<T>> | OfflineDataSnapshot<T>;
  /** Fetches fresh data from the network. */
  fetchRemote: (signal: AbortSignal) => Promise<T>;
  /** Persists freshly fetched data to the cache. */
  writeCache: (data: T, syncedAt: number) => Promise<void> | void;
  /** Optional clock injection for tests / clock-skew handling. */
  now?: () => number;
}

function resolveThreshold(type: OfflineDataType): number {
  return STALE_THRESHOLDS_MS[type] ?? STALE_THRESHOLDS_MS.default;
}

/**
 * Compute the age of cached data, guarding against clock skew. A timestamp in
 * the future beyond the tolerance is treated as unknown (null) so callers mark
 * the data stale instead of trusting a bogus fresh reading.
 */
export function computeAgeMs(
  lastSyncedAt: number | null,
  now: number,
): number | null {
  if (lastSyncedAt == null) return null;
  const age = now - lastSyncedAt;
  if (age < -CLOCK_SKEW_TOLERANCE_MS) return null; // future timestamp: skewed
  return Math.max(0, age);
}

/**
 * Shared hook backing every offline-capable pet view. It exposes the cached
 * data together with an explicit lifecycle state so views can render cached /
 * syncing / current / stale indicators consistently.
 */
export function useOfflineData<T>(
  options: UseOfflineDataOptions<T>,
): OfflineDataResult<T> {
  const { type, readCache, fetchRemote, writeCache } = options;
  const now = options.now ?? Date.now;

  const [snapshot, setSnapshot] = useState<OfflineDataSnapshot<T> | null>(null);
  const [state, setState] = useState<OfflineDataState>('no-cache');
  const [ageMs, setAgeMs] = useState<number | null>(null);

  // Track the latest local revision so a slow refresh cannot clobber newer
  // local edits made while the request was in flight.
  const revisionRef = useRef(0);
  const activeRefreshRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  const evaluate = useCallback(
    (snap: OfflineDataSnapshot<T> | null): { state: OfflineDataState; ageMs: number | null } => {
      if (!snap || snap.data == null) {
        return { state: 'no-cache', ageMs: null };
      }
      const age = computeAgeMs(snap.lastSyncedAt, now());
      if (age == null) {
        // Unknown age (never synced or skewed clock) => treat as stale.
        return { state: 'stale', ageMs: null };
      }
      const threshold = resolveThreshold(type);
      return { state: age > threshold ? 'stale' : 'current', ageMs: age };
    },
    [now, type],
  );

  const loadCache = useCallback(async () => {
    const snap = await readCache();
    if (!mountedRef.current) return;
    revisionRef.current = snap.localRevision;
    setSnapshot(snap);
    const evaluated = evaluate(snap);
    setState(evaluated.state);
    setAgeMs(evaluated.ageMs);
  }, [evaluate, readCache]);

  useEffect(() => {
    mountedRef.current = true;
    void loadCache();
    return () => {
      mountedRef.current = false;
      activeRefreshRef.current?.abort();
    };
  }, [loadCache]);

  const refresh = useCallback((): RefreshHandle => {
    // Cancel any in-flight refresh before starting a new one.
    activeRefreshRef.current?.abort();
    const controller = new AbortController();
    activeRefreshRef.current = controller;

    const revisionAtStart = revisionRef.current;
    setState('syncing');

    const done = (async (): Promise<boolean> => {
      try {
        const fresh = await fetchRemote(controller.signal);
        if (controller.signal.aborted || !mountedRef.current) return false;

        // Do not overwrite newer local edits made during the request.
        if (revisionRef.current !== revisionAtStart) {
          setState('stale');
          return false;
        }

        const syncedAt = now();
        await writeCache(fresh, syncedAt);
        if (controller.signal.aborted || !mountedRef.current) return false;

        const next: OfflineDataSnapshot<T> = {
          data: fresh,
          lastSyncedAt: syncedAt,
          lastVerifiedAt: snapshot?.lastVerifiedAt ?? null,
          localRevision: revisionRef.current,
        };
        setSnapshot(next);
        const evaluated = evaluate(next);
        setState(evaluated.state);
        setAgeMs(evaluated.ageMs);
        return true;
      } catch (err) {
        if (controller.signal.aborted || !mountedRef.current) return false;
        setState('error');
        return false;
      } finally {
        if (activeRefreshRef.current === controller) {
          activeRefreshRef.current = null;
        }
      }
    })();

    return {
      cancel: () => controller.abort(),
      done,
    };
  }, [evaluate, fetchRemote, now, snapshot?.lastVerifiedAt, writeCache]);

  const isStale = state === 'stale';
  const isSyncing = state === 'syncing';
  const isError = state === 'error';

  const statusLabel = useMemo(() => {
    switch (state) {
      case 'no-cache':
        return 'No offline data';
      case 'cached':
        return 'Cached';
      case 'syncing':
        return 'Syncing…';
      case 'current':
        return 'Up to date';
      case 'stale':
        return 'Stale — refresh recommended';
      case 'error':
        return 'Refresh failed — retry';
      default:
        return 'Unknown';
    }
  }, [state]);

  return {
    data: snapshot?.data ?? null,
    state,
    ageMs,
    lastSyncedAt: snapshot?.lastSyncedAt ?? null,
    lastVerifiedAt: snapshot?.lastVerifiedAt ?? null,
    isStale,
    isSyncing,
    isError,
    statusLabel,
    refresh,
  };
}
