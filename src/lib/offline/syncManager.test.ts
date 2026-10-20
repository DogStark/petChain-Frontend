import SyncManager from './syncManager';
import {
  getPendingSyncActions,
  getSyncConflict,
  getUnresolvedSyncConflicts,
  removeSyncAction,
  removeSyncConflict,
  storeSyncConflict,
} from './indexedDB';

jest.mock('./indexedDB', () => ({
  getPendingSyncActions: jest.fn(),
  getSyncConflict: jest.fn(),
  getUnresolvedSyncConflicts: jest.fn(),
  removeSyncAction: jest.fn(),
  removeSyncConflict: jest.fn(),
  incrementRetry: jest.fn(),
  storeSyncConflict: jest.fn(),
}));

const pendingItem = {
  id: 24,
  ownerId: 'user-1',
  action: 'update' as const,
  endpoint: '/pets/4',
  payload: { name: 'Local name', phone: 'local phone' },
  createdAt: 10,
  retryCount: 0,
  maxRetries: 3,
  idempotencyKey: 'sync-24',
};

describe('SyncManager unresolved conflict lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getPendingSyncActions as jest.Mock).mockResolvedValue([pendingItem]);
    (getUnresolvedSyncConflicts as jest.Mock).mockResolvedValue([]);
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 409,
      text: async () =>
        JSON.stringify({ serverData: { name: 'Server name', phone: 'server phone' } }),
    }) as jest.Mock;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('stores both versions after a 409 and counts the retained unresolved conflict', async () => {
    const manager = new SyncManager();
    (storeSyncConflict as jest.Mock).mockResolvedValue(undefined);
    (getUnresolvedSyncConflicts as jest.Mock)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          conflictId: '24',
          ownerId: 'user-1',
          queueItemId: 24,
          endpoint: '/pets/4',
          idempotencyKey: 'sync-24',
          localData: pendingItem.payload,
          serverData: { name: 'Server name', phone: 'server phone' },
          createdAt: 11,
        },
      ]);

    const result = await manager.processQueue('user-1');

    expect(storeSyncConflict).toHaveBeenCalledWith(
      expect.objectContaining({
        conflictId: '24',
        ownerId: 'user-1',
        queueItemId: 24,
        localData: pendingItem.payload,
        serverData: { name: 'Server name', phone: 'server phone' },
      }),
    );
    expect(removeSyncAction).not.toHaveBeenCalled();
    expect(result.conflicts).toBe(1);
    expect(getPendingSyncActions).toHaveBeenCalledTimes(1);
  });

  it('does not re-submit an unresolved queued conflict on a later sync', async () => {
    const manager = new SyncManager();
    (getUnresolvedSyncConflicts as jest.Mock).mockResolvedValue([
      { conflictId: '24' },
    ]);

    const result = await manager.processQueue();

    expect(global.fetch).not.toHaveBeenCalled();
    expect(result.conflicts).toBe(1);
  });

  it('retains malformed 409 responses as unresolved conflicts', async () => {
    const manager = new SyncManager();
    (storeSyncConflict as jest.Mock).mockResolvedValue(undefined);
    (getUnresolvedSyncConflicts as jest.Mock)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ conflictId: '24', ownerId: 'user-1' }]);
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 409,
      text: async () => 'not-json',
    }) as jest.Mock;

    const result = await manager.processQueue('user-1');

    expect(storeSyncConflict).toHaveBeenCalledWith(
      expect.objectContaining({ serverData: {} }),
    );
    expect(result.conflicts).toBe(1);
  });

  it('keeps a conflict when the backend refuses the selected resolution', async () => {
    const manager = new SyncManager();
    (getSyncConflict as jest.Mock).mockResolvedValue({
      conflictId: '24',
      ownerId: 'user-1',
      queueItemId: 24,
      endpoint: '/pets/4',
      idempotencyKey: 'sync-24',
      localData: pendingItem.payload,
      serverData: { name: 'Server name', phone: 'server phone' },
      createdAt: 11,
    });
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 403 }) as jest.Mock;

    await expect(
      manager.resolveConflict('24', { name: 'Selected name' }, 'user-1'),
    ).rejects.toThrow(/HTTP 403/i);

    expect(removeSyncAction).not.toHaveBeenCalled();
    expect(removeSyncConflict).not.toHaveBeenCalled();
  });
});
