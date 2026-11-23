import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  CursorPage,
  CursorPageInfo,
  CursorPaginationParams,
} from '@/lib/api/transactionAPI';

export interface UseCursorPaginationOptions {
  /** Page size requested from the API. */
  limit?: number;
  /** Initial cursor (e.g. read from the URL). */
  initialCursor?: string | null;
  /** Called whenever the active cursor changes so callers can sync the URL. */
  onCursorChange?: (cursor: string | null) => void;
}

export interface UseCursorPaginationResult<T> {
  items: T[];
  pageInfo: CursorPageInfo;
  cursor: string | null;
  loading: boolean;
  error: string | null;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  goNext: () => void;
  goPrevious: () => void;
  reset: () => void;
  refresh: () => void;
}

const EMPTY_PAGE_INFO: CursorPageInfo = {
  nextCursor: null,
  prevCursor: null,
  hasNextPage: false,
  hasPreviousPage: false,
};

/**
 * Cursor-based pagination over a fetcher that returns a `CursorPage`.
 *
 * Keeps a stack of visited cursors so "previous" can be resolved without
 * relying on the server returning a `prevCursor`. Items are de-duplicated by
 * `getId` so overlapping pages never render duplicate rows.
 */
export function useCursorPagination<T>(
  fetcher: (params: CursorPaginationParams) => Promise<CursorPage<T>>,
  options: UseCursorPaginationOptions = {},
  getId: (item: T) => string = (item) => (item as { id?: string }).id ?? ''
): UseCursorPaginationResult<T> {
  const { limit, initialCursor = null, onCursorChange } = options;

  const [items, setItems] = useState<T[]>([]);
  const [pageInfo, setPageInfo] = useState<CursorPageInfo>(EMPTY_PAGE_INFO);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  // Cursors of previously visited pages, used to walk backwards.
  const historyRef = useRef<string[]>([]);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const onCursorChangeRef = useRef(onCursorChange);
  onCursorChangeRef.current = onCursorChange;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetcherRef
      .current({ cursor: cursor ?? undefined, limit })
      .then((page) => {
        if (cancelled) return;
        setItems((prev) => {
          const seen = new Set<string>();
          return page.items.filter((item) => {
            const id = getId(item);
            if (seen.has(id)) return false;
            seen.add(id);
            return true;
          });
        });
        setPageInfo(page.pageInfo);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load page');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // `getId` is intentionally excluded: it is a stable identity helper.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor, limit, reloadToken]);

  const changeCursor = useCallback((next: string | null) => {
    setCursor(next);
    onCursorChangeRef.current?.(next);
  }, []);

  const goNext = useCallback(() => {
    if (!pageInfo.nextCursor) return;
    historyRef.current.push(cursor ?? '');
    changeCursor(pageInfo.nextCursor);
  }, [changeCursor, cursor, pageInfo.nextCursor]);

  const goPrevious = useCallback(() => {
    if (historyRef.current.length === 0) return;
    const previous = historyRef.current.pop() ?? '';
    changeCursor(previous === '' ? null : previous);
  }, [changeCursor]);

  const reset = useCallback(() => {
    historyRef.current = [];
    changeCursor(null);
  }, [changeCursor]);

  const refresh = useCallback(() => setReloadToken((token) => token + 1), []);

  return {
    items,
    pageInfo,
    cursor,
    loading,
    error,
    hasNextPage: pageInfo.hasNextPage,
    hasPreviousPage: historyRef.current.length > 0 || pageInfo.hasPreviousPage,
    goNext,
    goPrevious,
    reset,
    refresh,
  };
}

export default useCursorPagination;
