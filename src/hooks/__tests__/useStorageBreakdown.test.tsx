import { act, renderHook, waitFor } from '@testing-library/react';
import { useStorageBreakdown } from '../useStorageBreakdown';
import { cleanupCategory, getStorageBreakdown } from '@/lib/offline/storageUsage';
import { useAuth } from '@/contexts/AuthContext';

jest.mock('@/lib/offline/storageUsage');
jest.mock('@/contexts/AuthContext', () => ({ useAuth: jest.fn() }));

const breakdown = {
  categories: [{ id: 'cache', itemCount: 1, bytes: 10, cleanableCount: 1 }],
  totalBytes: 10,
  browserEstimate: null,
};

describe('useStorageBreakdown', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (useAuth as jest.Mock).mockReturnValue({ user: { id: 'user-1' } });
    (getStorageBreakdown as jest.Mock).mockResolvedValue(breakdown);
  });

  it('loads the breakdown for the signed-in account', async () => {
    const { result } = renderHook(() => useStorageBreakdown());

    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(getStorageBreakdown).toHaveBeenCalledWith('user-1');
    expect(result.current.breakdown).toEqual(breakdown);
  });

  it('does not read storage when nobody is signed in', async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: null });

    const { result } = renderHook(() => useStorageBreakdown());

    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));
    expect(getStorageBreakdown).not.toHaveBeenCalled();
  });

  it('exposes an error status when reading fails', async () => {
    (getStorageBreakdown as jest.Mock).mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() => useStorageBreakdown());

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.breakdown).toBeNull();
  });

  it('cleans a category, then refreshes the breakdown', async () => {
    (cleanupCategory as jest.Mock).mockResolvedValue({ id: 'cache', removed: 3 });
    const { result } = renderHook(() => useStorageBreakdown());
    await waitFor(() => expect(result.current.status).toBe('ready'));

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.cleanup('cache');
    });

    expect(cleanupCategory).toHaveBeenCalledWith('cache', 'user-1');
    expect(getStorageBreakdown).toHaveBeenCalledTimes(2);
    expect(outcome).toEqual({ id: 'cache', removed: 3 });
    expect(result.current.cleaningId).toBeNull();
  });

  it('keeps the breakdown and reports failure when cleanup throws', async () => {
    (cleanupCategory as jest.Mock).mockRejectedValue(new Error('tx aborted'));
    const { result } = renderHook(() => useStorageBreakdown());
    await waitFor(() => expect(result.current.status).toBe('ready'));

    let outcome: unknown = 'unset';
    await act(async () => {
      outcome = await result.current.cleanup('cache');
    });

    expect(outcome).toBeNull();
    expect(result.current.cleanupError).toMatch(/could not be cleared/i);
    expect(result.current.breakdown).toEqual(breakdown);
  });
});
