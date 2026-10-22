import { useCallback, useEffect, useState } from 'react';

import {
  EMPTY_ASSET_PREFERENCES,
  getAssetPreferencesStorageKey,
  parseAssetPreferences,
  toggleHiddenAsset,
  togglePinnedAsset,
} from '../lib/wallet/assetPreferences';
import type { AssetPreferences } from '../lib/wallet/assetPreferences';
import type { WalletNetwork } from '../types/wallet';

export interface UseAssetPreferencesReturn {
  preferences: AssetPreferences;
  /** False when storage is blocked; preferences then last only for this session. */
  canPersist: boolean;
  togglePin: (assetKey: string) => void;
  toggleHidden: (assetKey: string) => void;
}

function readPreferences(storageKey: string): { preferences: AssetPreferences; canPersist: boolean } {
  try {
    return {
      preferences: parseAssetPreferences(window.localStorage.getItem(storageKey)),
      canPersist: true,
    };
  } catch {
    return { preferences: EMPTY_ASSET_PREFERENCES, canPersist: false };
  }
}

function writePreferences(storageKey: string, preferences: AssetPreferences): boolean {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(preferences));
    return true;
  } catch {
    return false;
  }
}

/**
 * Per-wallet, per-network pin/hide preferences persisted in localStorage.
 * Display-only: access and consent remain enforced by the backend.
 */
export function useAssetPreferences(
  walletId: string | null,
  network: WalletNetwork,
): UseAssetPreferencesReturn {
  const storageKey = walletId ? getAssetPreferencesStorageKey(walletId, network) : null;
  const [preferences, setPreferences] = useState<AssetPreferences>(EMPTY_ASSET_PREFERENCES);
  const [canPersist, setCanPersist] = useState(true);

  useEffect(() => {
    if (!storageKey || typeof window === 'undefined') {
      setPreferences(EMPTY_ASSET_PREFERENCES);
      return;
    }
    const stored = readPreferences(storageKey);
    setPreferences(stored.preferences);
    setCanPersist(stored.canPersist);
  }, [storageKey]);

  const update = useCallback(
    (next: AssetPreferences) => {
      if (next === preferences) return;
      setPreferences(next);
      if (storageKey) setCanPersist(writePreferences(storageKey, next));
    },
    [preferences, storageKey],
  );

  const togglePin = useCallback(
    (assetKey: string) => update(togglePinnedAsset(preferences, assetKey)),
    [preferences, update],
  );

  const toggleHidden = useCallback(
    (assetKey: string) => update(toggleHiddenAsset(preferences, assetKey)),
    [preferences, update],
  );

  return { preferences, canPersist, togglePin, toggleHidden };
}

export default useAssetPreferences;
