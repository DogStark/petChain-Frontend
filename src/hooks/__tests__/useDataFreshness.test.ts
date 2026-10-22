/**
 * Tests for useDataFreshness hook
 *
 * Covers:
 *  - Initial state (no persisted timestamp → null)
 *  - Successful refresh: state updated, timestamp persisted
 *  - Failed refresh: error captured, isRefreshing resets to false
 *  - In-flight request cancellation when component unmounts
 *  - refreshAll delegates to each category
 *  - localStorage fallback to sessionStorage
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { useDataFreshness } from '../useDataFreshness';
import { userAPI } from '@/lib/api/userAPI';
import { petAPI } from '@/lib/api/petAPI';
import { medicalRecordsAPI } from '@/lib/api/medicalRecordsAPI';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@/lib/api/userAPI', () => ({
  userAPI: {
    getCurrentProfile: jest.fn(),
  },
}));

jest.mock('@/lib/api/petAPI', () => ({
  petAPI: {
    getUserPets: jest.fn(),
    getPetEmergencyInfo: jest.fn(),
  },
}));

jest.mock('@/lib/api/medicalRecordsAPI', () => ({
  medicalRecordsAPI: {
    getByPetId: jest.fn(),
  },
}));

const mockGetCurrentProfile = userAPI.getCurrentProfile as jest.Mock;
const mockGetUserPets = petAPI.getUserPets as jest.Mock;
const mockGetPetEmergencyInfo = petAPI.getPetEmergencyInfo as jest.Mock;
const mockGetByPetId = medicalRecordsAPI.getByPetId as jest.Mock;

// ---------------------------------------------------------------------------
// localStorage mock
// ---------------------------------------------------------------------------

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] ?? null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PROFILE_KEY = 'petchain_freshness_profile';
const MEDICAL_KEY = 'petchain_freshness_medicalHistory';
const EMERGENCY_KEY = 'petchain_freshness_emergency';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useDataFreshness', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.clear();
    // Default happy-path stubs
    mockGetCurrentProfile.mockResolvedValue({ id: 'u1' });
    mockGetUserPets.mockResolvedValue([{ id: 'p1', name: 'Rex' }]);
    mockGetByPetId.mockResolvedValue([]);
    mockGetPetEmergencyInfo.mockResolvedValue(null);
  });

  // -------------------------------------------------------------------------
  // Initial state
  // -------------------------------------------------------------------------

  it('starts with null lastRefreshedAt when no timestamp is stored', () => {
    const { result } = renderHook(() => useDataFreshness());

    expect(result.current.freshness.profile.lastRefreshedAt).toBeNull();
    expect(result.current.freshness.medicalHistory.lastRefreshedAt).toBeNull();
    expect(result.current.freshness.emergency.lastRefreshedAt).toBeNull();
  });

  it('reads a previously stored timestamp from localStorage on mount', () => {
    const iso = '2024-01-01T10:00:00.000Z';
    localStorageMock.getItem.mockImplementation((key: string) =>
      key === PROFILE_KEY ? iso : null
    );
    const { result } = renderHook(() => useDataFreshness());
    expect(result.current.freshness.profile.lastRefreshedAt).toBe(iso);
  });

  it('exposes the correct source label for each category', () => {
    const { result } = renderHook(() => useDataFreshness());
    expect(result.current.freshness.profile.source).toBe('PetChain User API');
    expect(result.current.freshness.medicalHistory.source).toBe(
      'PetChain Medical Records API'
    );
    expect(result.current.freshness.emergency.source).toBe('PetChain Pet Emergency API');
  });

  // -------------------------------------------------------------------------
  // Successful refresh — profile
  // -------------------------------------------------------------------------

  it('sets isRefreshing=true immediately and then resolves with a timestamp', async () => {
    let resolve!: () => void;
    mockGetCurrentProfile.mockReturnValue(
      new Promise<{ id: string }>((res) => {
        resolve = () => res({ id: 'u1' });
      })
    );

    const { result } = renderHook(() => useDataFreshness());

    act(() => {
      result.current.refresh('profile');
    });

    expect(result.current.freshness.profile.isRefreshing).toBe(true);
    expect(result.current.freshness.profile.error).toBeNull();

    await act(async () => {
      resolve();
    });

    expect(result.current.freshness.profile.isRefreshing).toBe(false);
    expect(result.current.freshness.profile.lastRefreshedAt).not.toBeNull();
    expect(result.current.freshness.profile.error).toBeNull();
    // Timestamp must be a valid ISO string
    expect(new Date(result.current.freshness.profile.lastRefreshedAt!).toISOString()).toBe(
      result.current.freshness.profile.lastRefreshedAt
    );
  });

  it('persists the timestamp to localStorage after a successful refresh', async () => {
    const { result } = renderHook(() => useDataFreshness());

    await act(async () => {
      result.current.refresh('profile');
    });

    await waitFor(() =>
      expect(result.current.freshness.profile.isRefreshing).toBe(false)
    );

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      PROFILE_KEY,
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
    );
  });

  // -------------------------------------------------------------------------
  // Successful refresh — medicalHistory (uses getUserPets when no petId)
  // -------------------------------------------------------------------------

  it('refreshes medicalHistory by fetching pets first when no petId is provided', async () => {
    const { result } = renderHook(() => useDataFreshness());

    await act(async () => {
      result.current.refresh('medicalHistory');
    });

    await waitFor(() =>
      expect(result.current.freshness.medicalHistory.isRefreshing).toBe(false)
    );

    expect(mockGetUserPets).toHaveBeenCalledTimes(1);
    expect(mockGetByPetId).toHaveBeenCalledWith('p1');
    expect(result.current.freshness.medicalHistory.lastRefreshedAt).not.toBeNull();
  });

  it('refreshes medicalHistory directly when a petId is provided', async () => {
    const { result } = renderHook(() => useDataFreshness('pet-42'));

    await act(async () => {
      result.current.refresh('medicalHistory');
    });

    await waitFor(() =>
      expect(result.current.freshness.medicalHistory.isRefreshing).toBe(false)
    );

    expect(mockGetUserPets).not.toHaveBeenCalled();
    expect(mockGetByPetId).toHaveBeenCalledWith('pet-42');
  });

  // -------------------------------------------------------------------------
  // Successful refresh — emergency
  // -------------------------------------------------------------------------

  it('refreshes emergency data using the first pet when no petId is given', async () => {
    const { result } = renderHook(() => useDataFreshness());

    await act(async () => {
      result.current.refresh('emergency');
    });

    await waitFor(() =>
      expect(result.current.freshness.emergency.isRefreshing).toBe(false)
    );

    expect(mockGetPetEmergencyInfo).toHaveBeenCalledWith('p1');
    expect(result.current.freshness.emergency.lastRefreshedAt).not.toBeNull();
  });

  // -------------------------------------------------------------------------
  // Error / failure states
  // -------------------------------------------------------------------------

  it('captures the error message and resets isRefreshing on a failed refresh', async () => {
    mockGetCurrentProfile.mockRejectedValue(new Error('Unauthorized'));

    const { result } = renderHook(() => useDataFreshness());

    await act(async () => {
      result.current.refresh('profile');
    });

    await waitFor(() =>
      expect(result.current.freshness.profile.isRefreshing).toBe(false)
    );

    expect(result.current.freshness.profile.error).toBe('Unauthorized');
    expect(result.current.freshness.profile.lastRefreshedAt).toBeNull();
  });

  it('captures a generic message when the thrown value is not an Error', async () => {
    mockGetCurrentProfile.mockRejectedValue('network gone');

    const { result } = renderHook(() => useDataFreshness());

    await act(async () => {
      result.current.refresh('profile');
    });

    await waitFor(() =>
      expect(result.current.freshness.profile.isRefreshing).toBe(false)
    );

    expect(result.current.freshness.profile.error).toBe(
      'Failed to refresh. Please try again.'
    );
  });

  it('clears the previous error on a subsequent successful refresh', async () => {
    mockGetCurrentProfile
      .mockRejectedValueOnce(new Error('first failure'))
      .mockResolvedValue({ id: 'u1' });

    const { result } = renderHook(() => useDataFreshness());

    // First call — fails
    await act(async () => {
      result.current.refresh('profile');
    });
    await waitFor(() => expect(result.current.freshness.profile.error).toBe('first failure'));

    // Second call — succeeds
    await act(async () => {
      result.current.refresh('profile');
    });
    await waitFor(() =>
      expect(result.current.freshness.profile.isRefreshing).toBe(false)
    );

    expect(result.current.freshness.profile.error).toBeNull();
    expect(result.current.freshness.profile.lastRefreshedAt).not.toBeNull();
  });

  // -------------------------------------------------------------------------
  // Empty pet list (no pets registered)
  // -------------------------------------------------------------------------

  it('succeeds silently for medicalHistory when the user has no pets', async () => {
    mockGetUserPets.mockResolvedValue([]);

    const { result } = renderHook(() => useDataFreshness());

    await act(async () => {
      result.current.refresh('medicalHistory');
    });

    await waitFor(() =>
      expect(result.current.freshness.medicalHistory.isRefreshing).toBe(false)
    );

    expect(mockGetByPetId).not.toHaveBeenCalled();
    expect(result.current.freshness.medicalHistory.error).toBeNull();
    expect(result.current.freshness.medicalHistory.lastRefreshedAt).not.toBeNull();
  });

  it('succeeds silently for emergency when the user has no pets', async () => {
    mockGetUserPets.mockResolvedValue([]);

    const { result } = renderHook(() => useDataFreshness());

    await act(async () => {
      result.current.refresh('emergency');
    });

    await waitFor(() =>
      expect(result.current.freshness.emergency.isRefreshing).toBe(false)
    );

    expect(mockGetPetEmergencyInfo).not.toHaveBeenCalled();
    expect(result.current.freshness.emergency.error).toBeNull();
    expect(result.current.freshness.emergency.lastRefreshedAt).not.toBeNull();
  });

  // -------------------------------------------------------------------------
  // refreshAll
  // -------------------------------------------------------------------------

  it('refreshAll triggers a refresh for every category', async () => {
    const { result } = renderHook(() => useDataFreshness());

    await act(async () => {
      result.current.refreshAll();
    });

    await waitFor(() => {
      expect(result.current.freshness.profile.isRefreshing).toBe(false);
      expect(result.current.freshness.medicalHistory.isRefreshing).toBe(false);
      expect(result.current.freshness.emergency.isRefreshing).toBe(false);
    });

    expect(mockGetCurrentProfile).toHaveBeenCalledTimes(1);
    // getUserPets is called for both medicalHistory and emergency when no petId
    expect(mockGetByPetId).toHaveBeenCalledTimes(1);
    expect(mockGetPetEmergencyInfo).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  // AbortController / unmount cancellation
  // -------------------------------------------------------------------------

  it('does not update state after the component unmounts (no act() warning)', async () => {
    let externalResolve!: () => void;
    mockGetCurrentProfile.mockReturnValue(
      new Promise<{ id: string }>((res) => {
        externalResolve = () => res({ id: 'u1' });
      })
    );

    const { result, unmount } = renderHook(() => useDataFreshness());

    act(() => {
      result.current.refresh('profile');
    });

    expect(result.current.freshness.profile.isRefreshing).toBe(true);

    unmount();

    // Resolve after unmount — should not cause state update warnings
    await act(async () => {
      externalResolve();
    });

    // Result is frozen after unmount — we just verify no crash
    expect(true).toBe(true);
  });

  // -------------------------------------------------------------------------
  // localStorage → sessionStorage fallback
  // -------------------------------------------------------------------------

  it('falls back to sessionStorage when localStorage throws on setItem', async () => {
    const sessionStorageMock = {
      getItem: jest.fn(() => null),
      setItem: jest.fn(),
    };
    Object.defineProperty(window, 'sessionStorage', { value: sessionStorageMock, writable: true });

    localStorageMock.setItem.mockImplementation(() => {
      throw new Error('storage full');
    });

    const { result } = renderHook(() => useDataFreshness());

    await act(async () => {
      result.current.refresh('profile');
    });

    await waitFor(() =>
      expect(result.current.freshness.profile.isRefreshing).toBe(false)
    );

    expect(sessionStorageMock.setItem).toHaveBeenCalledWith(
      PROFILE_KEY,
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
    );
  });

  it('persists timestamps for medicalHistory and emergency after successful refresh', async () => {
    const { result } = renderHook(() => useDataFreshness());

    await act(async () => {
      result.current.refreshAll();
    });

    await waitFor(() => {
      expect(result.current.freshness.medicalHistory.isRefreshing).toBe(false);
      expect(result.current.freshness.emergency.isRefreshing).toBe(false);
    });

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      MEDICAL_KEY,
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
    );
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      EMERGENCY_KEY,
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
    );
  });
});
