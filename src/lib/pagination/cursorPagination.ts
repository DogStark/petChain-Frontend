/**
 * @file cursorPagination.ts
 * Issue #964 — API pagination consistency checks.
 *
 * ## Problem
 * Lists (notifications, medical records, clinics) can silently skip or
 * duplicate entries when new data arrives during pagination if the client
 * uses naive offset arithmetic instead of the backend's cursor semantics.
 *
 * ## This module provides
 * - `createCursor` — encodes a query + last-seen-id into an opaque cursor
 *   string that is scoped to a specific query/filter configuration.
 * - `validateCursor` — decodes and verifies a cursor is compatible with the
 *   current query before the client sends it to the backend.  Incompatible
 *   reuse (e.g. reusing a notification-category cursor after the filter changes)
 *   is **rejected** to prevent silent skip/duplicate bugs.
 * - `mergePages` — appends a new page of items to an existing list,
 *   deduplicating by `id` and preserving stable ordering.
 * - `deduplicateItems` — helper for concurrent-insert scenarios where the same
 *   item may arrive via a WebSocket push and a paginated response simultaneously.
 *
 * ## Cursor semantics
 * Each cursor encodes:
 *   - `scopeKey`  — a deterministic hash of the query parameters (filter,
 *                   sort field, etc.).  The cursor is only valid when the
 *                   current query produces the same scope key.
 *   - `lastId`    — the backend-assigned ID of the last item in the previous
 *                   page (used as the `after` parameter).
 *   - `issuedAt`  — ISO timestamp for optional freshness enforcement.
 *
 * Cursors are base64-encoded JSON; they are opaque to UI code but inspectable
 * in developer tools.  Do NOT use them to store sensitive data.
 *
 * ## Thread safety
 * All functions are pure (no shared mutable state) so they can be called from
 * any React render, effect, or callback without race conditions.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * The subset of query parameters that determine cursor scope.
 * Extend as needed when additional filter dimensions are added to list APIs.
 */
export interface PaginationQueryParams {
  /** Entity being paginated, e.g. "notifications", "clinics", "medical-records". */
  entity: string;
  /** Optional category/filter filter value. */
  filter?: string;
  /** Optional sort field. */
  sort?: string;
  /** Optional sort direction. */
  direction?: 'asc' | 'desc';
  /** Any additional query parameters that affect the result set. */
  extra?: Record<string, string | number | boolean>;
}

/** Internal cursor payload — not exposed to calling code. */
interface CursorPayload {
  /** Deterministic scope identifier derived from `PaginationQueryParams`. */
  scopeKey: string;
  /** ID of the last item returned by the previous page. */
  lastId: string;
  /** ISO timestamp when the cursor was created. */
  issuedAt: string;
}

/** An opaque, base64-encoded cursor string. */
export type Cursor = string & { readonly __brand: 'Cursor' };

export interface CursorPage<T extends { id: string }> {
  /** Current items in the list (accumulated across pages). */
  items: T[];
  /**
   * Cursor to pass when fetching the next page.
   * `null` when the backend indicated this is the final page.
   */
  nextCursor: Cursor | null;
  /** Whether the backend indicated there are more items to load. */
  hasMore: boolean;
}

export type CursorValidationResult =
  | { valid: true; payload: CursorPayload }
  | { valid: false; reason: 'scope_mismatch' | 'malformed' | 'expired'; message: string };

// ─── Scope key ────────────────────────────────────────────────────────────────

/**
 * Produce a stable, deterministic scope key from query parameters.
 *
 * The key is a sorted JSON string (not cryptographically secure, just stable).
 * Two query configs produce the same scope key if and only if they would
 * return the same ordered result set from the backend.
 */
export function buildScopeKey(params: PaginationQueryParams): string {
  const normalized: Record<string, unknown> = {
    entity: params.entity,
    filter: params.filter ?? null,
    sort: params.sort ?? null,
    direction: params.direction ?? null,
  };

  // Merge and sort extra params for determinism
  if (params.extra) {
    const extraSorted = Object.keys(params.extra)
      .sort()
      .reduce<Record<string, unknown>>((acc, k) => {
        acc[k] = params.extra![k];
        return acc;
      }, {});
    Object.assign(normalized, extraSorted);
  }

  // Sort top-level keys for stability
  const sorted = Object.keys(normalized)
    .sort()
    .reduce<Record<string, unknown>>((acc, k) => {
      acc[k] = normalized[k];
      return acc;
    }, {});

  return btoa(JSON.stringify(sorted));
}

// ─── Cursor creation ──────────────────────────────────────────────────────────

/**
 * Create a new cursor after receiving a page of results.
 *
 * @param params   The query parameters used to fetch the page.
 * @param lastId   The `id` of the last item in the received page.
 * @returns        An opaque cursor string.
 */
export function createCursor(params: PaginationQueryParams, lastId: string): Cursor {
  const payload: CursorPayload = {
    scopeKey: buildScopeKey(params),
    lastId,
    issuedAt: new Date().toISOString(),
  };
  return btoa(JSON.stringify(payload)) as Cursor;
}

// ─── Cursor validation ────────────────────────────────────────────────────────

/**
 * Validate a cursor against the current query context.
 *
 * Returns `{ valid: false, reason: 'scope_mismatch' }` when the cursor was
 * created for a different filter/sort configuration than `currentParams`.
 * This is the primary guard against the silent skip/duplicate bug.
 *
 * @param cursor        Cursor to validate.
 * @param currentParams Current query parameters.
 * @param maxAgeMs      Optional: reject cursors older than this many milliseconds.
 */
export function validateCursor(
  cursor: Cursor,
  currentParams: PaginationQueryParams,
  maxAgeMs?: number
): CursorValidationResult {
  let payload: CursorPayload;
  try {
    payload = JSON.parse(atob(cursor)) as CursorPayload;
  } catch {
    return { valid: false, reason: 'malformed', message: 'Cursor is not valid base64 JSON.' };
  }

  if (
    typeof payload.scopeKey !== 'string' ||
    typeof payload.lastId !== 'string' ||
    typeof payload.issuedAt !== 'string'
  ) {
    return { valid: false, reason: 'malformed', message: 'Cursor payload is missing required fields.' };
  }

  // Scope check — the cursor must have been created with the same query config
  const expectedScopeKey = buildScopeKey(currentParams);
  if (payload.scopeKey !== expectedScopeKey) {
    return {
      valid: false,
      reason: 'scope_mismatch',
      message:
        'Cursor scope does not match the current query. ' +
        'The filter or sort configuration changed — start a new cursor.',
    };
  }

  // Optional freshness check
  if (maxAgeMs !== undefined) {
    const age = Date.now() - new Date(payload.issuedAt).getTime();
    if (age > maxAgeMs) {
      return {
        valid: false,
        reason: 'expired',
        message: `Cursor expired (age: ${Math.round(age / 1000)}s, max: ${Math.round(maxAgeMs / 1000)}s).`,
      };
    }
  }

  return { valid: true, payload };
}

/**
 * Extract the `lastId` from a valid cursor.
 * Returns `null` if the cursor is invalid or null.
 */
export function extractLastId(cursor: Cursor | null, params: PaginationQueryParams): string | null {
  if (!cursor) return null;
  const result = validateCursor(cursor, params);
  return result.valid ? result.payload.lastId : null;
}

// ─── Page merging / deduplication ────────────────────────────────────────────

/**
 * Merge a newly-fetched page of items into an existing list.
 *
 * - Deduplicates by `id` (the first occurrence wins — stable ordering is
 *   preserved by keeping the item in its original position).
 * - Appends new items that are not already present.
 * - If `newItems` is empty, `hasMore` is set to `false` (empty page = last page).
 *
 * @param existing  Current accumulated items.
 * @param newItems  Items returned by the latest page fetch.
 * @param params    Current query params (used to create the next cursor).
 * @param hasMoreFromBackend  Whether the backend indicated more pages exist.
 */
export function mergePages<T extends { id: string }>(
  existing: T[],
  newItems: T[],
  params: PaginationQueryParams,
  hasMoreFromBackend: boolean
): CursorPage<T> {
  if (newItems.length === 0) {
    return {
      items: existing,
      nextCursor: null,
      hasMore: false,
    };
  }

  // Build a set of existing IDs for O(1) dedup checks
  const existingIds = new Set(existing.map((item) => item.id));

  // Append only genuinely new items
  const deduped = newItems.filter((item) => !existingIds.has(item.id));
  const merged = [...existing, ...deduped];

  const lastItem = newItems[newItems.length - 1];
  const nextCursor = hasMoreFromBackend
    ? createCursor(params, lastItem.id)
    : null;

  return {
    items: merged,
    nextCursor,
    hasMore: hasMoreFromBackend,
  };
}

/**
 * Deduplicate a flat list of items by `id`, preserving insertion order
 * (first occurrence wins).  Use this when merging live push updates with
 * paginated data to prevent concurrent-insert duplicates.
 */
export function deduplicateItems<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

/**
 * Prepend a single live item (e.g. from a WebSocket push) to an existing
 * list, skipping it if it is already present.
 *
 * This preserves stable ordering: live items appear at the top, and the
 * paginated tail is unchanged.
 */
export function prependItem<T extends { id: string }>(existing: T[], item: T): T[] {
  if (existing.some((e) => e.id === item.id)) return existing;
  return [item, ...existing];
}

/**
 * Remove an item from the list and return the updated list.
 * Safe to call even if the item is not present.
 */
export function removeItem<T extends { id: string }>(existing: T[], id: string): T[] {
  return existing.filter((item) => item.id !== id);
}

/**
 * Reset pagination state for a new query (e.g. filter changed).
 * Returns an empty `CursorPage` with no cursor.
 */
export function resetPagination<T extends { id: string }>(): CursorPage<T> {
  return { items: [], nextCursor: null, hasMore: true };
}
