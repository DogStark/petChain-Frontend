/**
 * useDataFreshness
 *
 * Tracks the last successful refresh timestamp for each dashboard data category
 * (profile, medical history, emergency) and exposes per-category refresh actions.
 *
 * Timestamps are persisted to localStorage (key: `petchain_freshness_<category>`)
 * with a sessionStorage fallback for environments that block localStorage.
 *
 * Authorisation and consent remain entirely on the backend; this hook only calls
 * the same API methods that the rest of the application already uses.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { medicalRecordsAPI } from '@/lib/api/medicalRecordsAPI';
import { petAPI } from '@/lib/api/petAPI';
import { userAPI } from '@/lib/api/userAPI';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DataCategory = 'profile' | 'medicalHistory' | 'emergency';

export interface CategoryFreshness {
  /** ISO-8601 timestamp of the last successful fetch, or null if never loaded */
  lastRefreshedAt: string | null;
  /** True while an in-flight request for this category is pending */
  isRefreshing: boolean;
  /** Human-readable error message from the most recent failed refresh, or null */
  error: string | null;
  /** The API source label shown in the UI */
  source: string;
}

export type FreshnessState = Record<DataCategory, CategoryFreshness>;

export interface UseDataFreshnessReturn {
  freshness: FreshnessState;
  /** Trigger a refresh of a single category */
  refresh: (category: DataCategory) => void;
  /** Trigger a refresh of all categories simultaneously */
  refreshAll: () => void;
}

// ---------------------------------------------------------------------------
// Storage helpers (localStorage → sessionStorage fallback)
// ---------------------------------------------------------------------------

const STORAGE_KEY_PREFIX = 'petchain_freshness_';

function readTimestamp(category: DataCategory): string | null {
  const key = `${STORAGE_KEY_PREFIX}${category}`;
  try {
    return localStorage.getItem(key);
  } catch {
    try {
      return sessionStorage.getItem(key);
    } catch {
      return null;
    }
  }
}

function writeTimestamp(category: DataCategory, iso: string): void {
  const key = `${STORAGE_KEY_PREFIX}${category}`;
  try {
    localStorage.setItem(key, iso);
  } catch {
    try {
      sessionStorage.setItem(key, iso);
    } catch {
      // storage unavailable — continue without persisting
    }
  }
}

// ---------------------------------------------------------------------------
// Category metadata
// ---------------------------------------------------------------------------

const CATEGORY_SOURCES: Record<DataCategory, string> = {
  profile: 'PetChain User API',
  medicalHistory: 'PetChain Medical Records API',
  emergency: 'PetChain Pet Emergency API',
};

function buildInitialState(): FreshnessState {
  const categories: DataCategory[] = ['profile', 'medicalHistory', 'emergency'];
  return Object.fromEntries(
    categories.map((cat) => [
      cat,
      {
        lastRefreshedAt: readTimestamp(cat),
        isRefreshing: false,
        error: null,
        source: CATEGORY_SOURCES[cat],
      },
    ])
  ) as FreshnessState;
}

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

/**
 * Returns a promise that represents a single "freshness probe" for the given
 * category.  We only need to know that the call succeeded (we discard the
 * payload); the actual data is managed by the dashboard itself.
 */
async function fetchCategory(
  category: DataCategory,
  signal: AbortSignal,
  petId?: string
): Promise<void> {
  switch (category) {
    case 'profile':
      await userAPI.getCurrentProfile();
      break;

    case 'medicalHistory': {
      if (!petId) {
        // When no pet is selected we call getUserPets and probe the first pet.
        const pets = await petAPI.getUserPets();
        if (signal.aborted) return;
        if (pets.length > 0) {
          await medicalRecordsAPI.getByPetId(pets[0].id);
        }
      } else {
        await medicalRecordsAPI.getByPetId(petId);
      }
      break;
    }

    case 'emergency': {
      if (!petId) {
        const pets = await petAPI.getUserPets();
        if (signal.aborted) return;
        if (pets.length > 0) {
          await petAPI.getPetEmergencyInfo(pets[0].id);
        }
      } else {
        await petAPI.getPetEmergencyInfo(petId);
      }
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useDataFreshness(petId?: string): UseDataFreshnessReturn {
  const [freshness, setFreshness] = useState<FreshnessState>(buildInitialState);

  // Track per-category AbortControllers so we can cancel in-flight requests
  const controllersRef = useRef<Partial<Record<DataCategory, AbortController>>>({});

  // Cancel all in-flight requests on unmount
  useEffect(() => {
    return () => {
      Object.values(controllersRef.current).forEach((ctrl) => ctrl?.abort());
    };
  }, []);

  const refresh = useCallback(
    (category: DataCategory) => {
      // Abort any previous request for this category
      controllersRef.current[category]?.abort();
      const controller = new AbortController();
      controllersRef.current[category] = controller;

      setFreshness((prev) => ({
        ...prev,
        [category]: { ...prev[category], isRefreshing: true, error: null },
      }));

      fetchCategory(category, controller.signal, petId)
        .then(() => {
          if (controller.signal.aborted) return;
          const iso = new Date().toISOString();
          writeTimestamp(category, iso);
          setFreshness((prev) => ({
            ...prev,
            [category]: {
              ...prev[category],
              lastRefreshedAt: iso,
              isRefreshing: false,
              error: null,
            },
          }));
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted) return;
          const message =
            err instanceof Error ? err.message : 'Failed to refresh. Please try again.';
          setFreshness((prev) => ({
            ...prev,
            [category]: { ...prev[category], isRefreshing: false, error: message },
          }));
        });
    },
    [petId]
  );

  const refreshAll = useCallback(() => {
    const categories: DataCategory[] = ['profile', 'medicalHistory', 'emergency'];
    categories.forEach((cat) => refresh(cat));
  }, [refresh]);

  return { freshness, refresh, refreshAll };
}
