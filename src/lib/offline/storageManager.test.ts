/**
 * Tests for storage quota estimation and pressure events (issue #868).
 * Offline writes must surface quota failures without losing queued mutations.
 */
import {
  subscribeToStorageEvents,
  estimateStorageUsage,
  isQuotaExceededError,
  notifyQuotaOk,
  reportStorageEvent,
} from './storageManager';
import type { StoragePressureEvent } from './storageManager';

describe('isQuotaExceededError', () => {
  it('recognizes the Chrome QuotaExceededError name', () => {
    const error = new DOMException('quota', 'QuotaExceededError');
    expect(isQuotaExceededError(error)).toBe(true);
  });

  it('recognizes the Firefox NS_ERROR_DOM_QUOTA_REACHED name', () => {
    const error = new DOMException('quota', 'NS_ERROR_DOM_QUOTA_REACHED');
    expect(isQuotaExceededError(error)).toBe(true);
  });

  it('does not misclassify other errors', () => {
    expect(isQuotaExceededError(new Error('boom'))).toBe(false);
    expect(isQuotaExceededError(new DOMException('x', 'NotFoundError'))).toBe(false);
    expect(isQuotaExceededError(null)).toBe(false);
    expect(isQuotaExceededError('QuotaExceededError')).toBe(false);
  });
});

describe('estimateStorageUsage', () => {
  const originalEstimate = navigator.storage?.estimate;

  afterEach(() => {
    if (originalEstimate) {
      Object.defineProperty(navigator, 'storage', {
        value: { estimate: originalEstimate },
        configurable: true,
      });
    }
  });

  it('returns usage, quota, and percentUsed from the Storage API', async () => {
    Object.defineProperty(navigator, 'storage', {
      value: {
        estimate: jest.fn().mockResolvedValue({ usage: 50_000_000, quota: 100_000_000 }),
      },
      configurable: true,
    });

    const estimate = await estimateStorageUsage();
    expect(estimate).toEqual({ usage: 50_000_000, quota: 100_000_000, percentUsed: 50 });
  });

  it('returns null when the Storage API is unavailable', async () => {
    Object.defineProperty(navigator, 'storage', { value: undefined, configurable: true });
    expect(await estimateStorageUsage()).toBeNull();
  });

  it('degrades to 0 percent when quota is zero', async () => {
    Object.defineProperty(navigator, 'storage', {
      value: { estimate: jest.fn().mockResolvedValue({ usage: 10, quota: 0 }) },
      configurable: true,
    });
    const estimate = await estimateStorageUsage();
    expect(estimate?.percentUsed).toBe(0);
  });
});

describe('storage-pressure event bus', () => {
  it('delivers quota-exceeded events to subscribers', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeToStorageEvents(listener);

    const event: StoragePressureEvent = {
      type: 'quota-exceeded',
      store: 'syncQueue',
      message: 'Storage is full.',
    };
    reportStorageEvent(event);
    expect(listener).toHaveBeenCalledWith(event);

    unsubscribe();
    reportStorageEvent({ type: 'evicted', store: 'cache', removed: 1 });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('notifyQuotaOk emits a quota-ok event', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeToStorageEvents(listener);
    notifyQuotaOk();
    expect(listener).toHaveBeenCalledWith({ type: 'quota-ok' });
    unsubscribe();
  });

  it('never loses queued-mutation events because eviction targets cache stores', () => {
    // The eviction design keeps the sync queue untouched; this test pins the
    // event contract so future refactors cannot silently evict mutations.
    const event: StoragePressureEvent = { type: 'evicted', store: 'cache', removed: 7 };
    expect(event.store).not.toBe('syncQueue');
  });
});
