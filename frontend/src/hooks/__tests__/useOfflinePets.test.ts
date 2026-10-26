import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useOfflinePets } from '../useOfflinePets';

const STORAGE_KEY = 'petchain.offlinePets';

function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key: string) => (store.has(key) ? (store.get(key) as string) : null),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    removeItem: (key: string) => {
      store.delete(key);
    },
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
  };
}

describe('useOfflinePets', () => {
  let storage: Storage;

  beforeEach(() => {
    storage = createMemoryStorage();
    vi.stubGlobal('localStorage', storage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('starts empty when nothing has been pinned', () => {
    const { result } = renderHook(() => useOfflinePets('account-a'));

    expect(result.current.pinnedPets).toEqual([]);
    expect(result.current.estimatedBytes).toBe(0);
    expect(result.current.isPinned('pet-1')).toBe(false);
  });

  it('pins a pet summary and reports an estimated storage cost', async () => {
    const { result } = renderHook(() => useOfflinePets('account-a'));

    await act(async () => {
      await result.current.pinPet({
        id: 'pet-1',
        name: 'Rex',
        species: 'dog',
        recentRecords: [{ id: 'rec-1', title: 'Vaccination', date: '2024-01-01' }],
      });
    });

    await waitFor(() => expect(result.current.isPinned('pet-1')).toBe(true));
    expect(result.current.pinnedPets).toHaveLength(1);
    expect(result.current.estimatedBytes).toBeGreaterThan(0);

    const persisted = JSON.parse(storage.getItem(STORAGE_KEY) ?? '{}');
    expect(persisted['account-a']?.['pet-1']?.name).toBe('Rex');
  });

  it('clears a single pet cache without affecting other accounts', async () => {
    const { result: accountA } = renderHook(() => useOfflinePets('account-a'));
    const { result: accountB } = renderHook(() => useOfflinePets('account-b'));

    await act(async () => {
      await accountA.current.pinPet({ id: 'pet-1', name: 'Rex', species: 'dog', recentRecords: [] });
      await accountB.current.pinPet({ id: 'pet-9', name: 'Milo', species: 'cat', recentRecords: [] });
    });

    await act(async () => {
      await accountA.current.clearPet('pet-1');
    });

    await waitFor(() => expect(accountA.current.isPinned('pet-1')).toBe(false));
    expect(accountB.current.isPinned('pet-9')).toBe(true);

    const persisted = JSON.parse(storage.getItem(STORAGE_KEY) ?? '{}');
    expect(persisted['account-a']?.['pet-1']).toBeUndefined();
    expect(persisted['account-b']?.['pet-9']?.name).toBe('Milo');
  });

  it('surfaces a denied state when the backend rejects pinning', async () => {
    const { result } = renderHook(() => useOfflinePets('account-a'));

    await act(async () => {
      await result.current.pinPet({
        id: 'pet-2',
        name: 'Nope',
        species: 'dog',
        recentRecords: [],
        denied: true,
      });
    });

    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.isPinned('pet-2')).toBe(false);
  });

  it('handles storage quota failures without dropping existing pins', async () => {
    const { result } = renderHook(() => useOfflinePets('account-a'));

    await act(async () => {
      await result.current.pinPet({ id: 'pet-1', name: 'Rex', species: 'dog', recentRecords: [] });
    });

    const setItemSpy = vi.spyOn(storage, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });

    await act(async () => {
      await result.current.pinPet({ id: 'pet-3', name: 'Big', species: 'dog', recentRecords: [] });
    });

    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.isPinned('pet-1')).toBe(true);
    expect(result.current.isPinned('pet-3')).toBe(false);

    setItemSpy.mockRestore();
  });
});
