import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'petchain-unit-preference';

export type UnitSystem = 'metric' | 'customary';
export type UnitPreferenceSource = 'locale' | 'user';

export interface UnitPreferenceState {
  system: UnitSystem;
  source: UnitPreferenceSource;
  setSystem: (system: UnitSystem) => void;
  resetToLocale: () => void;
}

/**
 * Determine the default unit system based on browser locale.
 * en-US → customary (imperial), all others → metric
 */
function getLocaleDefaultSystem(): UnitSystem {
  if (typeof window === 'undefined') return 'metric';
  
  try {
    const locale = navigator.language || 'en-US';
    // Only en-US uses customary units by default
    return locale.toLowerCase().startsWith('en-us') ? 'customary' : 'metric';
  } catch {
    return 'metric';
  }
}

/**
 * Read persisted preference from localStorage with validation.
 * Returns null if missing, invalid, or localStorage unavailable.
 */
function readStoredPreference(): UnitSystem | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'metric' || stored === 'customary') {
      return stored;
    }
    return null;
  } catch {
    // localStorage unavailable (private browsing, SSR)
    return null;
  }
}

/**
 * Persist preference to localStorage with error handling.
 */
function writeStoredPreference(system: UnitSystem): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(STORAGE_KEY, system);
  } catch {
    // Silently fail in private browsing or storage quota exceeded
  }
}

/**
 * Clear persisted preference from localStorage.
 */
function clearStoredPreference(): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Silently fail
  }
}

/**
 * Hook for managing unit preference (metric vs customary).
 * 
 * - Default derived from locale (en-US → customary, others → metric)
 * - User can override, persisted in localStorage
 * - SSR-safe: initializes with locale default, hydrates on mount
 * - Returns current system, source, setters
 * 
 * @example
 * const { system, source, setSystem, resetToLocale } = useUnitPreference();
 * 
 * // Display weight based on preference
 * if (system === 'metric') {
 *   return `${weight} kg`;
 * } else {
 *   return `${weight * 2.20462} lb`;
 * }
 */
export function useUnitPreference(): UnitPreferenceState {
  // Initialize with locale default to avoid hydration mismatch
  const [system, setSystemState] = useState<UnitSystem>(() => {
    // SSR: always use metric as safe default
    if (typeof window === 'undefined') return 'metric';
    return getLocaleDefaultSystem();
  });
  
  const [source, setSource] = useState<UnitPreferenceSource>('locale');
  
  // Hydrate from localStorage on mount (client-only)
  useEffect(() => {
    const stored = readStoredPreference();
    const localeDefault = getLocaleDefaultSystem();
    
    if (stored) {
      setSystemState(stored);
      setSource('user');
    } else {
      setSystemState(localeDefault);
      setSource('locale');
    }
  }, []);
  
  const setSystem = useCallback((newSystem: UnitSystem) => {
    setSystemState(newSystem);
    setSource('user');
    writeStoredPreference(newSystem);
  }, []);
  
  const resetToLocale = useCallback(() => {
    const localeDefault = getLocaleDefaultSystem();
    setSystemState(localeDefault);
    setSource('locale');
    clearStoredPreference();
  }, []);
  
  return {
    system,
    source,
    setSystem,
    resetToLocale,
  };
}
