import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Clinic } from "@/types/clinic";
import { clinicsAPI } from "@/lib/api/clinicsAPI";
import { debounce } from "@/utils/debounce";

/** Minimum number of non-whitespace characters required before a query is applied. */
export const MIN_CLINIC_SEARCH_LENGTH = 2;

/** How long typing must pause before a query is applied. */
export const CLINIC_SEARCH_DEBOUNCE_MS = 300;

/**
 * True when a clinic matches the search term by name, city or service.
 *
 * The vet-clinics API (`GET /vet-clinics`) only exposes a `city` filter and has
 * no free-text search parameter, so the directory performs matching client-side
 * over the already-loaded list.
 */
export function matchesClinicQuery(clinic: Clinic, query: string): boolean {
  const term = query.trim().toLowerCase();
  if (!term) return true;

  return (
    clinic.name.toLowerCase().includes(term) ||
    clinic.locations.some((location) =>
      location.city.toLowerCase().includes(term),
    ) ||
    clinic.services.some((service) => service.name.toLowerCase().includes(term))
  );
}

/**
 * Applies the minimum-query-length policy and returns the matching subset.
 * Queries shorter than `minQueryLength` — including the empty query — return the
 * full list and are never treated as an active search.
 */
export function filterClinics(
  clinics: Clinic[],
  query: string,
  minQueryLength: number = MIN_CLINIC_SEARCH_LENGTH,
): Clinic[] {
  if (query.trim().length < minQueryLength) return clinics;
  return clinics.filter((clinic) => matchesClinicQuery(clinic, query));
}

export interface UseClinicSearchOptions {
  /** Debounce window in milliseconds. Defaults to {@link CLINIC_SEARCH_DEBOUNCE_MS}. */
  debounceMs?: number;
  /**
   * Minimum query length before a search is applied.
   * Defaults to {@link MIN_CLINIC_SEARCH_LENGTH}.
   */
  minQueryLength?: number;
}

export interface UseClinicSearchResult {
  /** Every clinic returned by the API, unaffected by the search query. */
  clinics: Clinic[];
  /** Clinics matching the committed query (text search only). */
  results: Clinic[];
  /** Raw input value, kept in state so it survives renders. */
  query: string;
  setQuery: (value: string) => void;
  /**
   * Apply the latest query immediately, skipping the debounce.
   * Wired to the Search button and the Enter key.
   */
  submit: () => void;
  /** Reset the query, cancelling any pending debounced search. Wired to Escape. */
  clear: () => void;
  /**
   * Initial/refreshed clinic load in progress. Distinct from
   * {@link UseClinicSearchResult.isSearching} so "loading" and "searching" never
   * collapse into one state.
   */
  loading: boolean;
  error: string | null;
  /** Re-run the clinic load, cancelling any request already in flight. */
  reload: () => void;
  /** A query of sufficient length has been typed but not applied yet. */
  isSearching: boolean;
  /** The committed query is long enough to filter the list. */
  isQueryActive: boolean;
  minQueryLength: number;
}

function isAbortError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const candidate = error as { name?: string; code?: string };
  return (
    candidate.name === "AbortError" ||
    candidate.name === "CanceledError" ||
    candidate.code === "ERR_CANCELED"
  );
}

/**
 * Owns the clinic directory's data loading and search state.
 *
 * - Loads the clinic list once and cancels/ignores stale in-flight requests via
 *   an `AbortController` plus a monotonically increasing request sequence.
 * - Debounces the query so typing does not recompute results on every keystroke.
 * - Enforces a minimum query length: empty/short queries reset to the full list
 *   immediately and never trigger a search (or an API call).
 * - Keeps `loading` (data fetch) and `isSearching` (debounce pending) distinct.
 */
export function useClinicSearch(
  options: UseClinicSearchOptions = {},
): UseClinicSearchResult {
  const {
    debounceMs = CLINIC_SEARCH_DEBOUNCE_MS,
    minQueryLength = MIN_CLINIC_SEARCH_LENGTH,
  } = options;

  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQueryState] = useState("");
  const [committedQuery, setCommittedQuery] = useState("");

  const mountedRef = useRef(true);
  const latestQueryRef = useRef("");
  // Monotonic sequence: only the newest request may commit its response.
  const requestSequenceRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const loadClinics = useCallback(async () => {
    // Cancel the previous load so an older response can never win the race.
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const sequence = ++requestSequenceRef.current;

    setLoading(true);
    setError(null);

    try {
      const data = await clinicsAPI.getClinics(undefined, controller.signal);
      // Ignore this response if it has been superseded by a newer request.
      if (!mountedRef.current || sequence !== requestSequenceRef.current) return;
      setClinics(data);
    } catch (loadError) {
      if (!mountedRef.current || sequence !== requestSequenceRef.current) return;
      if (isAbortError(loadError)) return;
      setError("Failed to load clinics.");
    } finally {
      // Only the request that is still current may clear the loading state.
      if (mountedRef.current && sequence === requestSequenceRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    loadClinics();

    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, [loadClinics]);

  const commitDebouncedQuery = useMemo(
    () =>
      debounce((next: unknown) => {
        const value = typeof next === "string" ? next : "";
        // A newer keystroke, submit or clear has superseded this callback.
        if (value !== latestQueryRef.current) return;
        setCommittedQuery(value);
      }, debounceMs),
    [debounceMs],
  );

  // Cancel a pending debounce on unmount to avoid updating state after teardown.
  useEffect(() => {
    return () => commitDebouncedQuery.cancel();
  }, [commitDebouncedQuery]);

  const setQuery = useCallback(
    (value: string) => {
      latestQueryRef.current = value;
      setQueryState(value);

      // Empty/short queries are applied immediately: there is nothing to
      // debounce, and holding on to the previous results would be stale.
      if (value.trim().length < minQueryLength) {
        commitDebouncedQuery.cancel();
        setCommittedQuery(value);
        return;
      }

      commitDebouncedQuery(value);
    },
    [commitDebouncedQuery, minQueryLength],
  );

  const submit = useCallback(() => {
    commitDebouncedQuery.cancel();
    setCommittedQuery(latestQueryRef.current);
  }, [commitDebouncedQuery]);

  const clear = useCallback(() => {
    latestQueryRef.current = "";
    setQueryState("");
    commitDebouncedQuery.cancel();
    setCommittedQuery("");
  }, [commitDebouncedQuery]);

  const isQueryActive = committedQuery.trim().length >= minQueryLength;

  const results = useMemo(
    () => filterClinics(clinics, committedQuery, minQueryLength),
    [clinics, committedQuery, minQueryLength],
  );

  const isSearching =
    query.trim().length >= minQueryLength && query !== committedQuery;

  return {
    clinics,
    results,
    query,
    setQuery,
    submit,
    clear,
    loading,
    error,
    reload: loadClinics,
    isSearching,
    isQueryActive,
    minQueryLength,
  };
}
