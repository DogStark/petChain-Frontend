/**
 * Tests for cursorPagination.ts — Issue #964
 *
 * Covers:
 *  - Append (load next page, no duplicates)
 *  - Deletion (item removed from list)
 *  - Filter change (cursor rejected with scope_mismatch)
 *  - Empty pages (hasMore set to false)
 *  - Concurrent inserts via WebSocket push
 *  - Cursor expiry (maxAgeMs enforcement)
 *  - Malformed cursor strings
 *  - Scope key determinism
 *  - resetPagination resets state cleanly
 */

import {
  createCursor,
  validateCursor,
  buildScopeKey,
  extractLastId,
  mergePages,
  deduplicateItems,
  prependItem,
  removeItem,
  resetPagination,
  PaginationQueryParams,
  CursorPage,
  Cursor,
} from '../cursorPagination';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

interface Item {
  id: string;
  name: string;
}

const NOTIFICATIONS_PARAMS: PaginationQueryParams = {
  entity: 'notifications',
  filter: 'ALL',
  sort: 'createdAt',
  direction: 'desc',
};

const APPOINTMENTS_PARAMS: PaginationQueryParams = {
  entity: 'notifications',
  filter: 'APPOINTMENT',
  sort: 'createdAt',
  direction: 'desc',
};

const items: Item[] = [
  { id: 'n1', name: 'Notification 1' },
  { id: 'n2', name: 'Notification 2' },
  { id: 'n3', name: 'Notification 3' },
];

// ─── buildScopeKey ────────────────────────────────────────────────────────────

describe('buildScopeKey', () => {
  it('produces the same key for identical params', () => {
    const k1 = buildScopeKey(NOTIFICATIONS_PARAMS);
    const k2 = buildScopeKey(NOTIFICATIONS_PARAMS);
    expect(k1).toBe(k2);
  });

  it('produces different keys for different filters', () => {
    expect(buildScopeKey(NOTIFICATIONS_PARAMS)).not.toBe(buildScopeKey(APPOINTMENTS_PARAMS));
  });

  it('produces different keys for different entities', () => {
    const clinicsParams: PaginationQueryParams = { entity: 'clinics' };
    expect(buildScopeKey(NOTIFICATIONS_PARAMS)).not.toBe(buildScopeKey(clinicsParams));
  });

  it('is stable regardless of extra param key insertion order', () => {
    const p1: PaginationQueryParams = { entity: 'e', extra: { b: 2, a: 1 } };
    const p2: PaginationQueryParams = { entity: 'e', extra: { a: 1, b: 2 } };
    expect(buildScopeKey(p1)).toBe(buildScopeKey(p2));
  });

  it('treats undefined optional fields as null (same key)', () => {
    const withUndefined: PaginationQueryParams = { entity: 'notifications' };
    const withNull: PaginationQueryParams = {
      entity: 'notifications',
      filter: undefined,
      sort: undefined,
      direction: undefined,
    };
    expect(buildScopeKey(withUndefined)).toBe(buildScopeKey(withNull));
  });
});

// ─── createCursor / validateCursor ───────────────────────────────────────────

describe('createCursor', () => {
  it('returns an opaque base64 string', () => {
    const cursor = createCursor(NOTIFICATIONS_PARAMS, 'n3');
    expect(typeof cursor).toBe('string');
    expect(() => atob(cursor)).not.toThrow();
  });

  it('encodes the lastId in the cursor payload', () => {
    const cursor = createCursor(NOTIFICATIONS_PARAMS, 'n5');
    const payload = JSON.parse(atob(cursor));
    expect(payload.lastId).toBe('n5');
  });

  it('includes an issuedAt ISO timestamp', () => {
    const before = new Date().toISOString();
    const cursor = createCursor(NOTIFICATIONS_PARAMS, 'n1');
    const after = new Date().toISOString();
    const payload = JSON.parse(atob(cursor));
    expect(payload.issuedAt >= before).toBe(true);
    expect(payload.issuedAt <= after).toBe(true);
  });
});

describe('validateCursor', () => {
  it('returns valid:true for a cursor with matching query params', () => {
    const cursor = createCursor(NOTIFICATIONS_PARAMS, 'n3');
    const result = validateCursor(cursor, NOTIFICATIONS_PARAMS);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.payload.lastId).toBe('n3');
    }
  });

  it('returns scope_mismatch when filter changes (core dedup guard)', () => {
    const cursor = createCursor(NOTIFICATIONS_PARAMS, 'n3');
    // Simulate user switching the filter from ALL → APPOINTMENT
    const result = validateCursor(cursor, APPOINTMENTS_PARAMS);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe('scope_mismatch');
      expect(result.message).toMatch(/scope/i);
    }
  });

  it('returns scope_mismatch when sort direction changes', () => {
    const cursor = createCursor(NOTIFICATIONS_PARAMS, 'n2');
    const ascParams: PaginationQueryParams = { ...NOTIFICATIONS_PARAMS, direction: 'asc' };
    const result = validateCursor(cursor, ascParams);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe('scope_mismatch');
  });

  it('returns scope_mismatch when entity changes (cross-list reuse rejected)', () => {
    const notifCursor = createCursor(NOTIFICATIONS_PARAMS, 'n1');
    const clinicsParams: PaginationQueryParams = { entity: 'clinics' };
    const result = validateCursor(notifCursor, clinicsParams);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe('scope_mismatch');
  });

  it('returns malformed for a non-base64 string', () => {
    const result = validateCursor('not-base64!!!' as Cursor, NOTIFICATIONS_PARAMS);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe('malformed');
  });

  it('returns malformed for valid base64 but non-JSON content', () => {
    const result = validateCursor(btoa('not-json') as Cursor, NOTIFICATIONS_PARAMS);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe('malformed');
  });

  it('returns malformed when cursor payload is missing required fields', () => {
    const incomplete = btoa(JSON.stringify({ scopeKey: 'x' })) as Cursor;
    const result = validateCursor(incomplete, NOTIFICATIONS_PARAMS);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe('malformed');
  });

  it('returns expired when cursor is older than maxAgeMs', () => {
    // Construct a cursor with an old issuedAt
    const oldPayload = JSON.stringify({
      scopeKey: buildScopeKey(NOTIFICATIONS_PARAMS),
      lastId: 'n1',
      issuedAt: new Date(Date.now() - 3600_000).toISOString(), // 1 hour ago
    });
    const oldCursor = btoa(oldPayload) as Cursor;
    const result = validateCursor(oldCursor, NOTIFICATIONS_PARAMS, 60_000); // 1 minute max
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe('expired');
  });

  it('does not enforce expiry when maxAgeMs is not provided', () => {
    const oldPayload = JSON.stringify({
      scopeKey: buildScopeKey(NOTIFICATIONS_PARAMS),
      lastId: 'n1',
      issuedAt: new Date(Date.now() - 3600_000).toISOString(),
    });
    const oldCursor = btoa(oldPayload) as Cursor;
    const result = validateCursor(oldCursor, NOTIFICATIONS_PARAMS);
    expect(result.valid).toBe(true);
  });
});

// ─── extractLastId ────────────────────────────────────────────────────────────

describe('extractLastId', () => {
  it('extracts the lastId from a valid, matching cursor', () => {
    const cursor = createCursor(NOTIFICATIONS_PARAMS, 'n9');
    expect(extractLastId(cursor, NOTIFICATIONS_PARAMS)).toBe('n9');
  });

  it('returns null when cursor is null (first page)', () => {
    expect(extractLastId(null, NOTIFICATIONS_PARAMS)).toBeNull();
  });

  it('returns null when cursor scope does not match', () => {
    const cursor = createCursor(NOTIFICATIONS_PARAMS, 'n9');
    expect(extractLastId(cursor, APPOINTMENTS_PARAMS)).toBeNull();
  });
});

// ─── mergePages — append ──────────────────────────────────────────────────────

describe('mergePages — append', () => {
  it('appends new items to the existing list without duplicates', () => {
    const page1 = items.slice(0, 2); // [n1, n2]
    const page2 = [{ id: 'n3', name: 'Notification 3' }, { id: 'n4', name: 'Notification 4' }];

    const result = mergePages(page1, page2, NOTIFICATIONS_PARAMS, true);
    expect(result.items).toHaveLength(4);
    expect(result.items.map((i) => i.id)).toEqual(['n1', 'n2', 'n3', 'n4']);
  });

  it('sets hasMore:true and returns a nextCursor when backend says more exist', () => {
    const result = mergePages(items.slice(0, 2), [items[2]], NOTIFICATIONS_PARAMS, true);
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).not.toBeNull();
  });

  it('sets hasMore:false and nextCursor:null on the final page', () => {
    const result = mergePages(items.slice(0, 2), [items[2]], NOTIFICATIONS_PARAMS, false);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
  });

  it('does not duplicate an item that arrives in two consecutive pages', () => {
    // Simulate backend returning n3 in both page 1 and page 2 (edge case)
    const page1: Item[] = [{ id: 'n1', name: 'N1' }, { id: 'n3', name: 'N3 from page 1' }];
    const page2: Item[] = [{ id: 'n3', name: 'N3 from page 2' }, { id: 'n4', name: 'N4' }];

    const result = mergePages(page1, page2, NOTIFICATIONS_PARAMS, false);
    const n3Occurrences = result.items.filter((i) => i.id === 'n3');
    expect(n3Occurrences).toHaveLength(1);
    // The first occurrence (from page 1) is preserved
    expect(n3Occurrences[0].name).toBe('N3 from page 1');
  });

  it('preserves stable ordering across pages', () => {
    const page1: Item[] = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }];
    const page2: Item[] = [{ id: 'c', name: 'C' }, { id: 'd', name: 'D' }];
    const result = mergePages(page1, page2, NOTIFICATIONS_PARAMS, false);
    expect(result.items.map((i) => i.id)).toEqual(['a', 'b', 'c', 'd']);
  });
});

// ─── mergePages — empty page ──────────────────────────────────────────────────

describe('mergePages — empty page', () => {
  it('returns existing items unchanged when newItems is empty', () => {
    const result = mergePages(items, [], NOTIFICATIONS_PARAMS, false);
    expect(result.items).toEqual(items);
  });

  it('sets hasMore:false when newItems is empty', () => {
    const result = mergePages(items, [], NOTIFICATIONS_PARAMS, false);
    expect(result.hasMore).toBe(false);
  });

  it('returns nextCursor:null when newItems is empty', () => {
    const result = mergePages(items, [], NOTIFICATIONS_PARAMS, true);
    expect(result.nextCursor).toBeNull();
  });

  it('handles an empty existing list + empty new page gracefully', () => {
    const result = mergePages<Item>([], [], NOTIFICATIONS_PARAMS, false);
    expect(result.items).toHaveLength(0);
    expect(result.hasMore).toBe(false);
  });
});

// ─── Filter change ────────────────────────────────────────────────────────────

describe('filter change — cursor rejection', () => {
  it('scope_mismatch is returned when using an ALL-filter cursor for APPOINTMENT filter', () => {
    const cursor = createCursor(NOTIFICATIONS_PARAMS, 'n5');
    const result = validateCursor(cursor, APPOINTMENTS_PARAMS);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe('scope_mismatch');
  });

  it('after filter change, resetPagination() returns empty state ready for new fetch', () => {
    const page = resetPagination<Item>();
    expect(page.items).toHaveLength(0);
    expect(page.nextCursor).toBeNull();
    expect(page.hasMore).toBe(true);
  });

  it('a cursor from a previous filter cannot be used after reset', () => {
    const oldCursor = createCursor(NOTIFICATIONS_PARAMS, 'n3');
    // User switches to APPOINTMENT filter
    const result = validateCursor(oldCursor, APPOINTMENTS_PARAMS);
    expect(result.valid).toBe(false);
  });
});

// ─── Deletion ─────────────────────────────────────────────────────────────────

describe('removeItem — deletion', () => {
  it('removes an existing item by id', () => {
    const updated = removeItem(items, 'n2');
    expect(updated.map((i) => i.id)).toEqual(['n1', 'n3']);
  });

  it('is a no-op when the id is not present', () => {
    const updated = removeItem(items, 'nonexistent');
    expect(updated).toHaveLength(items.length);
  });

  it('returns a new array (does not mutate the original)', () => {
    const copy = [...items];
    const updated = removeItem(copy, 'n1');
    expect(copy).toHaveLength(3);
    expect(updated).toHaveLength(2);
  });

  it('handles empty list gracefully', () => {
    expect(removeItem([], 'n1')).toHaveLength(0);
  });
});

// ─── Concurrent inserts ───────────────────────────────────────────────────────

describe('concurrent inserts — deduplication', () => {
  it('deduplicateItems removes duplicate ids, first occurrence wins', () => {
    const withDupes: Item[] = [
      { id: 'n1', name: 'First' },
      { id: 'n2', name: 'N2' },
      { id: 'n1', name: 'Duplicate First' },
      { id: 'n3', name: 'N3' },
    ];
    const result = deduplicateItems(withDupes);
    expect(result).toHaveLength(3);
    expect(result.find((i) => i.id === 'n1')?.name).toBe('First');
  });

  it('deduplicateItems preserves order of first occurrences', () => {
    const withDupes: Item[] = [
      { id: 'c', name: 'C' },
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
      { id: 'a', name: 'A-dup' },
    ];
    expect(deduplicateItems(withDupes).map((i) => i.id)).toEqual(['c', 'a', 'b']);
  });

  it('prependItem inserts a new live item at the top', () => {
    const liveItem: Item = { id: 'live1', name: 'Live' };
    const updated = prependItem(items, liveItem);
    expect(updated[0].id).toBe('live1');
    expect(updated).toHaveLength(4);
  });

  it('prependItem skips a duplicate live item without changing the list', () => {
    const duplicate = items[0];
    const updated = prependItem(items, duplicate);
    expect(updated).toHaveLength(3);
    expect(updated[0].id).toBe('n1'); // original position preserved
  });

  it('mergePages + prependItem combination does not produce duplicates', () => {
    // Simulate: page1 loaded, then WS pushes n3, then page2 arrives containing n3 again
    const page1: Item[] = [{ id: 'n1', name: 'N1' }, { id: 'n2', name: 'N2' }];
    const wsItem: Item = { id: 'n3', name: 'N3 (live)' };

    // After WS push
    const afterPush = prependItem(page1, wsItem);
    expect(afterPush[0].id).toBe('n3');
    expect(afterPush).toHaveLength(3);

    // Page 2 from backend also includes n3
    const page2: Item[] = [{ id: 'n3', name: 'N3 (paged)' }, { id: 'n4', name: 'N4' }];
    const merged = mergePages(afterPush, page2, NOTIFICATIONS_PARAMS, false);

    expect(merged.items.filter((i) => i.id === 'n3')).toHaveLength(1);
    // The WS item (which was prepended) should be preserved
    expect(merged.items.find((i) => i.id === 'n3')?.name).toBe('N3 (live)');
  });

  it('handles multiple concurrent WS pushes before first page load', () => {
    const wsItems: Item[] = [
      { id: 'ws1', name: 'WS1' },
      { id: 'ws2', name: 'WS2' },
      { id: 'ws1', name: 'WS1-dup' }, // fired twice
    ];

    let list: Item[] = [];
    wsItems.forEach((item) => {
      list = prependItem(list, item);
    });

    expect(deduplicateItems(list).filter((i) => i.id === 'ws1')).toHaveLength(1);
    expect(list).toHaveLength(2);
  });
});

// ─── nextCursor lifecycle ─────────────────────────────────────────────────────

describe('nextCursor lifecycle', () => {
  it('the next cursor from mergePages is valid against the same params', () => {
    const result = mergePages(items.slice(0, 2), [items[2]], NOTIFICATIONS_PARAMS, true);
    expect(result.nextCursor).not.toBeNull();
    const validation = validateCursor(result.nextCursor!, NOTIFICATIONS_PARAMS);
    expect(validation.valid).toBe(true);
  });

  it('the next cursor encodes the id of the last item in the page', () => {
    const lastItem: Item = { id: 'last-99', name: 'Last' };
    const result = mergePages(items, [lastItem], NOTIFICATIONS_PARAMS, true);
    expect(extractLastId(result.nextCursor, NOTIFICATIONS_PARAMS)).toBe('last-99');
  });

  it('cursor chain works across multiple pages', () => {
    // Page 1
    const p1Items: Item[] = [{ id: 'p1a', name: 'P1A' }, { id: 'p1b', name: 'P1B' }];
    const r1 = mergePages([], p1Items, NOTIFICATIONS_PARAMS, true);
    expect(r1.nextCursor).not.toBeNull();

    // Page 2 — validate cursor from p1
    const cursor1Valid = validateCursor(r1.nextCursor!, NOTIFICATIONS_PARAMS);
    expect(cursor1Valid.valid).toBe(true);

    const p2Items: Item[] = [{ id: 'p2a', name: 'P2A' }];
    const r2 = mergePages(r1.items, p2Items, NOTIFICATIONS_PARAMS, false);
    expect(r2.items).toHaveLength(3);
    expect(r2.nextCursor).toBeNull();
    expect(r2.hasMore).toBe(false);
  });
});
