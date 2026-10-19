/**
 * Regression tests for issue #866:
 * Bound and monitor the offline mutation queue.
 *
 * Run with:
 *   npx ts-node --project tsconfig.test.json tests/offlineQueueBounds.test.ts
 */

import SyncManager, {
  QUEUE_MAX_SIZE,
  BASE_BACKOFF_MS,
  MAX_BACKOFF_MS,
  DEAD_LETTER_TTL_MS,
  SyncStatus,
  DeadLetterItem,
} from '../src/lib/offline/syncManager';
import { SyncQueueItem } from '../src/lib/offline/indexedDB';

// ─── test runner ─────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(description: string, fn: () => void | Promise<void>) {
  const run = async () => {
    try {
      await fn();
      console.log(`  ✓ ${description}`);
      passed++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ✗ ${description}\n    ${msg}`);
      failed++;
    }
  };
  // Track promise so we can await all at the end
  pendingTests.push(run());
}

const pendingTests: Promise<void>[] = [];

function expect<T>(actual: T) {
  return {
    toBe(expected: T) {
      if (actual !== expected)
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    },
    toBeGreaterThan(n: number) {
      if ((actual as unknown as number) <= n)
        throw new Error(`Expected ${JSON.stringify(actual)} > ${n}`);
    },
    toBeLessThanOrEqual(n: number) {
      if ((actual as unknown as number) > n)
        throw new Error(`Expected ${JSON.stringify(actual)} <= ${n}`);
    },
    toBeTruthy() {
      if (!actual) throw new Error(`Expected truthy, got ${JSON.stringify(actual)}`);
    },
    toBeFalsy() {
      if (actual) throw new Error(`Expected falsy, got ${JSON.stringify(actual)}`);
    },
    toEqual(expected: T) {
      const a = JSON.stringify(actual);
      const e = JSON.stringify(expected);
      if (a !== e) throw new Error(`Expected\n  ${e}\ngot\n  ${a}`);
    },
  };
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function makeSyncItem(overrides: Partial<SyncQueueItem> = {}): SyncQueueItem {
  return {
    id: 1,
    action: 'create',
    endpoint: '/pets/123/records',
    payload: { note: 'checkup' },
    createdAt: Date.now(),
    retryCount: 0,
    maxRetries: 3,
    idempotencyKey: `key-${Date.now()}-${Math.random()}`,
    ...overrides,
  };
}

// ─── constants ───────────────────────────────────────────────────────────────

console.log('\n[#866] Offline mutation queue – bounds, backoff, dead-letter\n');

test('QUEUE_MAX_SIZE is a positive integer', () => {
  expect(typeof QUEUE_MAX_SIZE).toBe('number');
  expect(QUEUE_MAX_SIZE).toBeGreaterThan(0);
});

test('BASE_BACKOFF_MS is a positive integer', () => {
  expect(typeof BASE_BACKOFF_MS).toBe('number');
  expect(BASE_BACKOFF_MS).toBeGreaterThan(0);
});

test('MAX_BACKOFF_MS is greater than BASE_BACKOFF_MS', () => {
  expect(MAX_BACKOFF_MS).toBeGreaterThan(BASE_BACKOFF_MS);
});

test('DEAD_LETTER_TTL_MS is at least one hour', () => {
  expect(DEAD_LETTER_TTL_MS).toBeGreaterThan(60 * 60 * 1_000);
});

// ─── exponential backoff ──────────────────────────────────────────────────────

test('backoff for retry 0 equals BASE_BACKOFF_MS', () => {
  const delay = SyncManager.calculateBackoffMs(0);
  expect(delay).toBe(BASE_BACKOFF_MS);
});

test('backoff doubles on each retry', () => {
  const d0 = SyncManager.calculateBackoffMs(0);
  const d1 = SyncManager.calculateBackoffMs(1);
  const d2 = SyncManager.calculateBackoffMs(2);
  expect(d1).toBe(d0 * 2);
  expect(d2).toBe(d0 * 4);
});

test('backoff is capped at MAX_BACKOFF_MS', () => {
  const highRetry = SyncManager.calculateBackoffMs(100);
  expect(highRetry).toBe(MAX_BACKOFF_MS);
});

test('backoff at retry 1000 does not exceed MAX_BACKOFF_MS', () => {
  expect(SyncManager.calculateBackoffMs(1_000)).toBeLessThanOrEqual(MAX_BACKOFF_MS);
});

// ─── queue-full status ────────────────────────────────────────────────────────

test('canEnqueue emits queue-full and returns false when queue is at limit', async () => {
  const emittedStatuses: SyncStatus[] = [];
  const manager = new SyncManager({
    maxQueueSize: 2,
    onStatusChange: (s) => emittedStatuses.push(s),
  });

  // Stub getPendingSyncActions so it returns 2 items (at the limit)
  const origModule = await import('../src/lib/offline/indexedDB');
  const origGetPending = origModule.getPendingSyncActions;
  (origModule as unknown as { getPendingSyncActions: () => Promise<SyncQueueItem[]> })
    .getPendingSyncActions = async () => [makeSyncItem({ id: 1 }), makeSyncItem({ id: 2 })];

  const result = await manager.canEnqueue();

  // Restore
  (origModule as unknown as { getPendingSyncActions: typeof origGetPending }).getPendingSyncActions =
    origGetPending;

  expect(result).toBeFalsy();
  expect(emittedStatuses.includes('queue-full')).toBeTruthy();
});

// ─── dead-letter store ────────────────────────────────────────────────────────

test('dead-letter store is initially empty', () => {
  const manager = new SyncManager();
  expect(manager.getDeadLetterItems().length).toBe(0);
});

test('clearDeadLetterStore empties the store', () => {
  const manager = new SyncManager();
  // Manually inject an item via the private accessor (cast to any for testing)
  (manager as unknown as { deadLetterStore: DeadLetterItem[] }).deadLetterStore.push({
    item: makeSyncItem(),
    deadLetteredAt: Date.now(),
    reason: 'test',
  });
  expect(manager.getDeadLetterItems().length).toBe(1);
  manager.clearDeadLetterStore();
  expect(manager.getDeadLetterItems().length).toBe(0);
});

test('dead-letter TTL prune removes expired items', () => {
  const manager = new SyncManager();
  const deadLetterStore = (manager as unknown as { deadLetterStore: DeadLetterItem[] })
    .deadLetterStore;

  // Add one expired item and one fresh item
  deadLetterStore.push({
    item: makeSyncItem({ id: 1 }),
    deadLetteredAt: Date.now() - DEAD_LETTER_TTL_MS - 1,
    reason: 'expired',
  });
  deadLetterStore.push({
    item: makeSyncItem({ id: 2 }),
    deadLetteredAt: Date.now(),
    reason: 'fresh',
  });

  // Trigger prune via the private method
  (manager as unknown as { pruneExpiredDeadLetterItems(): number }).pruneExpiredDeadLetterItems();

  expect(manager.getDeadLetterItems().length).toBe(1);
  expect(manager.getDeadLetterItems()[0].reason).toBe('fresh');
});

// ─── processQueue dead-lettering ─────────────────────────────────────────────

test('processQueue moves exhausted items to dead-letter store', async () => {
  const emittedStatuses: SyncStatus[] = [];
  const manager = new SyncManager({
    onStatusChange: (s) => emittedStatuses.push(s),
  });

  // Override internal dependencies with stubs
  const exhaustedItem: SyncQueueItem = makeSyncItem({
    id: 99,
    retryCount: 3,
    maxRetries: 3,
  });

  // Stub getPendingSyncActions to return one exhausted item
  const origModule = await import('../src/lib/offline/indexedDB');
  const origGetPending = origModule.getPendingSyncActions;
  const origRemove = origModule.removeSyncAction;

  (origModule as unknown as { getPendingSyncActions: () => Promise<SyncQueueItem[]> })
    .getPendingSyncActions = async () => [exhaustedItem];
  (origModule as unknown as { removeSyncAction: (id: number) => Promise<void> })
    .removeSyncAction = async () => {};

  await manager.processQueue();

  // Restore
  (origModule as unknown as { getPendingSyncActions: typeof origGetPending }).getPendingSyncActions =
    origGetPending;
  (origModule as unknown as { removeSyncAction: typeof origRemove }).removeSyncAction = origRemove;

  expect(manager.getDeadLetterItems().length).toBe(1);
  expect(emittedStatuses.includes('dead-letter')).toBeTruthy();
});

// ─── summary ─────────────────────────────────────────────────────────────────

Promise.all(pendingTests).then(() => {
  console.log(`\n  Passed: ${passed}  Failed: ${failed}\n`);
  if (failed > 0) process.exit(1);
});
