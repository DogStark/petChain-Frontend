import { cleanupCategory, getStorageBreakdown } from './storageUsage';
import {
  evictCacheEntries,
  evictRecordEntries,
  getAllCacheEntries,
  getAllRecordEntries,
  getPendingSyncActions,
  getUnresolvedSyncConflicts,
  removeSyncAction,
} from './indexedDB';
import { estimateStorageUsage } from './storageManager';

jest.mock('./indexedDB', () => ({
  evictCacheEntries: jest.fn(),
  evictRecordEntries: jest.fn(),
  getAllCacheEntries: jest.fn(),
  getAllRecordEntries: jest.fn(),
  getPendingSyncActions: jest.fn(),
  getUnresolvedSyncConflicts: jest.fn(),
  removeSyncAction: jest.fn(),
}));
jest.mock('./storageManager', () => ({ estimateStorageUsage: jest.fn() }));

const OWNER = 'user-1';
const queueItem = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  ownerId: OWNER,
  action: 'update' as const,
  endpoint: '/pets/1',
  payload: { name: 'Rex' },
  createdAt: 1,
  retryCount: 0,
  maxRetries: 3,
  idempotencyKey: 'k1',
  ...overrides,
});

describe('storageUsage', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (getAllCacheEntries as jest.Mock).mockResolvedValue([]);
    (getAllRecordEntries as jest.Mock).mockResolvedValue([]);
    (getPendingSyncActions as jest.Mock).mockResolvedValue([]);
    (getUnresolvedSyncConflicts as jest.Mock).mockResolvedValue([]);
    (estimateStorageUsage as jest.Mock).mockResolvedValue(null);
    (evictCacheEntries as jest.Mock).mockResolvedValue(0);
    (evictRecordEntries as jest.Mock).mockResolvedValue(0);
  });

  describe('getStorageBreakdown', () => {
    it('reports zero usage for every category when nothing is stored', async () => {
      const result = await getStorageBreakdown(OWNER);

      expect(result.categories.map((c) => c.id)).toEqual(['cache', 'queuedChanges', 'attachments']);
      expect(result.categories.every((c) => c.itemCount === 0 && c.bytes === 0)).toBe(true);
      expect(result.totalBytes).toBe(0);
      expect(result.browserEstimate).toBeNull();
    });

    it('counts cache entries and record snapshots together as cache', async () => {
      (getAllCacheEntries as jest.Mock).mockResolvedValue([{ key: 'a', data: 'x', timestamp: 1 }]);
      (getAllRecordEntries as jest.Mock).mockResolvedValue([{ key: 'b', data: 'y', timestamp: 2 }]);

      const cache = (await getStorageBreakdown(OWNER)).categories[0];

      expect(cache.itemCount).toBe(2);
      expect(cache.bytes).toBeGreaterThan(0);
      expect(cache.cleanableCount).toBe(2);
    });

    it("only counts the signed-in account's queued changes and conflicts", async () => {
      (getPendingSyncActions as jest.Mock).mockResolvedValue([
        queueItem({ id: 1 }),
        queueItem({ id: 2, ownerId: 'someone-else' }),
        queueItem({ id: 3, ownerId: undefined }),
      ]);
      (getUnresolvedSyncConflicts as jest.Mock).mockResolvedValue([
        { conflictId: 'c1', ownerId: OWNER, localData: {}, serverData: {} },
        { conflictId: 'c2', ownerId: 'someone-else', localData: {}, serverData: {} },
      ]);

      const queued = (await getStorageBreakdown(OWNER)).categories[1];

      expect(queued.itemCount).toBe(3); // items 1 and 3, plus conflict c1
    });

    it('marks only queued changes that exhausted their retries as cleanable', async () => {
      (getPendingSyncActions as jest.Mock).mockResolvedValue([
        queueItem({ id: 1, retryCount: 0 }),
        queueItem({ id: 2, retryCount: 3 }),
      ]);

      expect((await getStorageBreakdown(OWNER)).categories[1].cleanableCount).toBe(1);
    });

    it('never exposes keys, endpoints or payload contents', async () => {
      (getAllCacheEntries as jest.Mock).mockResolvedValue([
        { key: 'secret-key', data: 'secret', timestamp: 1 },
      ]);
      (getPendingSyncActions as jest.Mock).mockResolvedValue([queueItem({ endpoint: '/secret' })]);

      const serialized = JSON.stringify(await getStorageBreakdown(OWNER));

      expect(serialized).not.toMatch(/secret/);
    });

    it('includes the browser-wide estimate when available', async () => {
      const estimate = { usage: 10, quota: 100, percentUsed: 10 };
      (estimateStorageUsage as jest.Mock).mockResolvedValue(estimate);

      expect((await getStorageBreakdown(OWNER)).browserEstimate).toEqual(estimate);
    });

    it('propagates read failures', async () => {
      (getAllCacheEntries as jest.Mock).mockRejectedValue(new Error('idb unavailable'));

      await expect(getStorageBreakdown(OWNER)).rejects.toThrow('idb unavailable');
    });
  });

  describe('cleanupCategory', () => {
    it('clears cache and record snapshots', async () => {
      (evictCacheEntries as jest.Mock).mockResolvedValue(4);
      (evictRecordEntries as jest.Mock).mockResolvedValue(2);

      await expect(cleanupCategory('cache', OWNER)).resolves.toEqual({ id: 'cache', removed: 6 });
    });

    it('removes only exhausted, owned queue items and never touches pending work', async () => {
      (getPendingSyncActions as jest.Mock).mockResolvedValue([
        queueItem({ id: 1, retryCount: 0 }),
        queueItem({ id: 2, retryCount: 3 }),
        queueItem({ id: 3, retryCount: 3, ownerId: 'someone-else' }),
      ]);

      const result = await cleanupCategory('queuedChanges', OWNER);

      expect(result).toEqual({ id: 'queuedChanges', removed: 1 });
      expect(removeSyncAction).toHaveBeenCalledTimes(1);
      expect(removeSyncAction).toHaveBeenCalledWith(2);
    });

    it('removes nothing when no queued change is cleanable', async () => {
      (getPendingSyncActions as jest.Mock).mockResolvedValue([queueItem({ retryCount: 1 })]);

      await expect(cleanupCategory('queuedChanges', OWNER)).resolves.toEqual({
        id: 'queuedChanges',
        removed: 0,
      });
      expect(removeSyncAction).not.toHaveBeenCalled();
    });

    it('reports nothing removed for attachments, which are not persisted offline yet', async () => {
      await expect(cleanupCategory('attachments', OWNER)).resolves.toEqual({
        id: 'attachments',
        removed: 0,
      });
    });

    it('propagates cleanup failures', async () => {
      (evictCacheEntries as jest.Mock).mockRejectedValue(new Error('tx aborted'));

      await expect(cleanupCategory('cache', OWNER)).rejects.toThrow('tx aborted');
    });
  });
});
