import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export type SearchStatus = 'idle' | 'loading' | 'success' | 'empty' | 'error';

export interface UseSearchOptions<T> {
  /** Debounce delay in ms before a query is dispatched. */
  debounceMs?: number;
  /** Minimum query length required before searching. */
  minLength?: number;
  /** Fetcher receives the query and an AbortSignal for cancellation. */
  fetcher: (query: string, signal: AbortSignal) => Promise<T[]>;
}

export interface UseSearchResult<T> {
  query: string;
  setQuery: (value: string) => void;
  results: T[];
  status: SearchStatus;
  error: Error | null;
  /** Human-readable status message suitable for an aria-live region. */
  statusMessage: string;
  /** Index of the keyboard-active result, or -1 when none. */
  activeIndex: number;
  setActiveIndex: (index: number) => void;
  /** Move the active result by delta, wrapping at the ends. */
  moveActive: (delta: number) => void;
  /** Id for the active option, for aria-activedescendant. */
  activeDescendantId: string | null;
  /** Stable id helper for a result at the given index. */
  getOptionId: (index: number) => string;
  /** Retry the current query after an error. */
  retry: () => void;
  /** Clear the query and results. */
  reset: () => void;
}

const DEFAULT_DEBOUNCE_MS = 300;
const DEFAULT_MIN_LENGTH = 1;

/**
 * Shared search hook providing debounced, cancellable queries plus the
 * accessibility contract (status announcements, keyboard navigation and
 * empty/error semantics) used by pet and clinic search pages.
 */
export function useSearch<T>({
  debounceMs = DEFAULT_DEBOUNCE_MS,
  minLength = DEFAULT_MIN_LENGTH,
  fetcher,
}: UseSearchOptions<T>): UseSearchResult<T> {
  const [query, setQueryState] = useState('');
  const [results, setResults] = useState<T[]>([]);
  const [status, setStatus] = useState<SearchStatus>('idle');
  const [error, setError] = useState<Error | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [retryToken, setRetryToken] = useState(0);

  const idRef = useRef(`search-${Math.random().toString(36).slice(2, 9)}`);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const setQuery = useCallback((value: string) => {
    setQueryState(value);
    setActiveIndex(-1);
  }, []);

  const reset = useCallback(() => {
    setQueryState('');
    setResults([]);
    setStatus('idle');
    setError(null);
    setActiveIndex(-1);
  }, []);

  const retry = useCallback(() => {
    setRetryToken((token) => token + 1);
  }, []);

  useEffect(() => {
    const trimmed = query.trim();

    if (trimmed.length < minLength) {
      setResults([]);
      setError(null);
      setStatus('idle');
      return;
    }

    const controller = new AbortController();
    setStatus('loading');
    setError(null);

    const timer = setTimeout(() => {
      fetcherRef
        .current(trimmed, controller.signal)
        .then((next) => {
          if (controller.signal.aborted) return;
          setResults(next);
          setStatus(next.length === 0 ? 'empty' : 'success');
          setActiveIndex(-1);
        })
        .catch((cause: unknown) => {
          if (controller.signal.aborted) return;
          setResults([]);
          setError(cause instanceof Error ? cause : new Error(String(cause)));
          setStatus('error');
          setActiveIndex(-1);
        });
    }, debounceMs);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, debounceMs, minLength, retryToken]);

  const moveActive = useCallback(
    (delta: number) => {
      setActiveIndex((current) => {
        if (results.length === 0) return -1;
        if (current < 0) return delta > 0 ? 0 : results.length - 1;
        const next = current + delta;
        if (next < 0) return results.length - 1;
        if (next >= results.length) return 0;
        return next;
      });
    },
    [results.length],
  );

  const getOptionId = useCallback(
    (index: number) => `${idRef.current}-option-${index}`,
    [],
  );

  const activeDescendantId =
    activeIndex >= 0 && activeIndex < results.length
      ? getOptionId(activeIndex)
      : null;

  const statusMessage = useMemo(() => {
    switch (status) {
      case 'loading':
        return 'Searching…';
      case 'success':
        return `${results.length} result${results.length === 1 ? '' : 's'} found.`;
      case 'empty':
        return `No results for “${query.trim()}”. Try adjusting your search terms.`;
      case 'error':
        return `Search failed for “${query.trim()}”. Check your connection and retry.`;
      default:
        return '';
    }
  }, [status, results.length, query]);

  return {
    query,
    setQuery,
    results,
    status,
    error,
    statusMessage,
    activeIndex,
    setActiveIndex,
    moveActive,
    activeDescendantId,
    getOptionId,
    retry,
    reset,
  };
}
