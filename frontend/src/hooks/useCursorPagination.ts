import { useCallback, useEffect, useRef, useState } from 'react';

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

export interface UseCursorPaginationOptions<T> {
  /** Fetches a page. Receives the cursor (null for the first page) and an AbortSignal. */
  fetchPage: (cursor: string | null, signal: AbortSignal) => Promise<CursorPage<T>>;
  /** Returns the canonical id used to deduplicate items across pages. */
  getId: (item: T) => string;
  /** Whether to load the first page on mount. Defaults to true. */
  enabled?: boolean;
}

export interface UseCursorPaginationResult<T> {
  items: T[];
  /** True while the first page is loading and no items are loaded yet. */
  isLoading: boolean;
  /** True while a subsequent page is loading. */
  isLoadingMore: boolean;
  /** True when a next-page fetch failed; the last good page is preserved. */
  isError: boolean;
  /** True when the list is exhausted (a page returned no next cursor). */
  isEnd: boolean;
  /** True when the first page loaded successfully but returned no items. */
  isEmpty: boolean;
  /** Loads the next page. No-op while loading, at the end, or after a failure until retried. */
  loadMore: () => void;
  /** Retries the failed next-page fetch. */
  retry: () => void;
  /** Resets the cursor and reloads the first page, cancelling any in-flight request. */
  refresh: () => void;
}

/**
 * Centralized cursor pagination with deduplication, request cancellation,
 * last-good-page preservation, and retry at the point of failure.
 */
export function useCursorPagination<T>({
  fetchPage,
  getId,
  enabled = true,
}: UseCursorPaginationOptions<T>): UseCursorPaginationResult<T> {
  const [items, setItems] = useState<T[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(enabled);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isError, setIsError] = useState(false);
  const [isEnd, setIsEnd] = useState(false);
  const [isEmpty, setIsEmpty] = useState(false);

  const fetchPageRef = useRef(fetchPage);
  const getIdRef = useRef(getId);
  const controllerRef = useRef<AbortController | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const cursorRef = useRef<string | null>(null);
  const isEndRef = useRef(false);
  const isErrorRef = useRef(false);
  const isLoadingRef = useRef(false);
  const requestIdRef = useRef(0);

  useEffect(() => {
    fetchPageRef.current = fetchPage;
  }, [fetchPage]);

  useEffect(() => {
    getIdRef.current = getId;
  }, [getId]);

  const cancelInFlight = useCallback(() => {
    if (controllerRef.current) {
      controllerRef.current.abort();
      controllerRef.current = null;
    }
  }, []);

  const runFetch = useCallback(
    async (nextCursor: string | null, isFirstPage: boolean) => {
      cancelInFlight();
      const controller = new AbortController();
      controllerRef.current = controller;
      const requestId = ++requestIdRef.current;

      isLoadingRef.current = true;
      if (isFirstPage) {
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }
      setIsError(false);
      isErrorRef.current = false;

      try {
        const page = await fetchPageRef.current(nextCursor, controller.signal);
        if (requestId !== requestIdRef.current) return;

        const seen = seenIdsRef.current;
        const fresh: T[] = [];
        for (const item of page.items) {
          const id = getIdRef.current(item);
          if (seen.has(id)) continue;
          seen.add(id);
          fresh.push(item);
        }

        setItems((prev) => (isFirstPage ? fresh : [...prev, ...fresh]));

        const next = page.nextCursor;
        cursorRef.current = next;
        setCursor(next);

        const end = next === null;
        isEndRef.current = end;
        setIsEnd(end);
        setIsEmpty(isFirstPage && fresh.length === 0);
      } catch (error) {
        if (requestId !== requestIdRef.current) return;
        if (controller.signal.aborted) return;
        // Preserve the last good page; surface a recoverable error.
        isErrorRef.current = true;
        setIsError(true);
      } finally {
        if (requestId === requestIdRef.current) {
          isLoadingRef.current = false;
          setIsLoading(false);
          setIsLoadingMore(false);
        }
      }
    },
    [cancelInFlight],
  );

  const loadMore = useCallback(() => {
    if (isLoadingRef.current || isEndRef.current || isErrorRef.current) return;
    void runFetch(cursorRef.current, false);
  }, [runFetch]);

  const retry = useCallback(() => {
    if (isLoadingRef.current || isEndRef.current) return;
    void runFetch(cursorRef.current, false);
  }, [runFetch]);

  const refresh = useCallback(() => {
    cancelInFlight();
    requestIdRef.current += 1;
    seenIdsRef.current = new Set();
    cursorRef.current = null;
    isEndRef.current = false;
    isErrorRef.current = false;
    isLoadingRef.current = false;
    setItems([]);
    setCursor(null);
    setIsEnd(false);
    setIsEmpty(false);
    setIsError(false);
    setIsLoadingMore(false);
    void runFetch(null, true);
  }, [cancelInFlight, runFetch]);

  useEffect(() => {
    if (!enabled) return;
    void runFetch(null, true);
    return () => {
      cancelInFlight();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return {
    items,
    isLoading,
    isLoadingMore,
    isError,
    isEnd,
    isEmpty,
    loadMore,
    retry,
    refresh,
  };
}
