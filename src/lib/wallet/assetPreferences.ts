import type { WalletBalance, WalletNetwork } from '../../types/wallet';

/**
 * Local-only wallet asset display preferences (pin / hide).
 *
 * These are purely presentational: they never change balances, signing or
 * what the backend authorises. Nothing here is sent off the device.
 */

const STORAGE_PREFIX = 'petchain-wallet-asset-prefs';
const MAX_ENTRIES = 200;
const MAX_KEY_LENGTH = 80;

export const NATIVE_ASSET_KEY = 'native';

export interface AssetPreferences {
  pinned: string[];
  hidden: string[];
}

export interface OrganizedAsset {
  key: string;
  label: string;
  balance: WalletBalance;
  /** Unsupported assets (e.g. liquidity pool shares) are always shown, without controls. */
  supported: boolean;
  pinned: boolean;
  hidden: boolean;
}

export interface OrganizedAssets {
  visible: OrganizedAsset[];
  hidden: OrganizedAsset[];
  total: number;
}

export const EMPTY_ASSET_PREFERENCES: AssetPreferences = { pinned: [], hidden: [] };

export function isSupportedAsset(balance: WalletBalance): boolean {
  if (balance.asset_type === 'native') return true;
  return (
    (balance.asset_type === 'credit_alphanum4' || balance.asset_type === 'credit_alphanum12') &&
    !!balance.asset_code &&
    !!balance.asset_issuer
  );
}

/** Stable identity for an asset. Code alone is not unique across issuers. */
export function getAssetKey(balance: WalletBalance, index: number): string {
  if (balance.asset_type === 'native') return NATIVE_ASSET_KEY;
  if (isSupportedAsset(balance)) return `${balance.asset_code}:${balance.asset_issuer}`;
  return `${balance.asset_type}:${index}`;
}

export function getAssetPreferencesStorageKey(walletId: string, network: WalletNetwork): string {
  return `${STORAGE_PREFIX}:${network}:${walletId}`;
}

function sanitizeKeys(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const keys = value.filter(
    (v): v is string => typeof v === 'string' && v.length > 0 && v.length <= MAX_KEY_LENGTH,
  );
  return Array.from(new Set(keys)).slice(0, MAX_ENTRIES);
}

/** Tolerates missing, corrupted or tampered storage by falling back to defaults. */
export function parseAssetPreferences(raw: string | null): AssetPreferences {
  if (!raw) return EMPTY_ASSET_PREFERENCES;
  try {
    const parsed = JSON.parse(raw) as Partial<AssetPreferences> | null;
    const pinned = sanitizeKeys(parsed?.pinned);
    const hidden = sanitizeKeys(parsed?.hidden).filter(
      (key) => key !== NATIVE_ASSET_KEY && !pinned.includes(key),
    );
    return { pinned, hidden };
  } catch {
    return EMPTY_ASSET_PREFERENCES;
  }
}

export function togglePinnedAsset(prefs: AssetPreferences, key: string): AssetPreferences {
  if (prefs.pinned.includes(key)) {
    return { ...prefs, pinned: prefs.pinned.filter((k) => k !== key) };
  }
  if (prefs.pinned.length >= MAX_ENTRIES) return prefs;
  return {
    pinned: [...prefs.pinned, key],
    hidden: prefs.hidden.filter((k) => k !== key),
  };
}

/** XLM pays fees and reserves, so it can never be hidden. */
export function toggleHiddenAsset(prefs: AssetPreferences, key: string): AssetPreferences {
  if (key === NATIVE_ASSET_KEY) return prefs;
  if (prefs.hidden.includes(key)) {
    return { ...prefs, hidden: prefs.hidden.filter((k) => k !== key) };
  }
  if (prefs.hidden.length >= MAX_ENTRIES) return prefs;
  return {
    pinned: prefs.pinned.filter((k) => k !== key),
    hidden: [...prefs.hidden, key],
  };
}

function shortIssuer(issuer: string): string {
  return `${issuer.slice(0, 4)}…${issuer.slice(-4)}`;
}

/**
 * Splits balances into visible and hidden groups. Pinned assets come first in
 * pin order, then XLM, then the rest in Horizon order. Preferences for assets
 * the account no longer holds are ignored so hidden counts stay accurate.
 */
export function organizeAssets(
  balances: WalletBalance[],
  prefs: AssetPreferences,
): OrganizedAssets {
  const codeCounts = new Map<string, number>();
  balances.forEach((b) => {
    if (b.asset_code) codeCounts.set(b.asset_code, (codeCounts.get(b.asset_code) ?? 0) + 1);
  });

  const assets: OrganizedAsset[] = balances.map((balance, index) => {
    const key = getAssetKey(balance, index);
    const supported = isSupportedAsset(balance);
    let label = balance.asset_type === 'native' ? 'XLM' : (balance.asset_code ?? 'Unknown');
    if (balance.asset_code && balance.asset_issuer && (codeCounts.get(balance.asset_code) ?? 0) > 1) {
      label = `${label} (${shortIssuer(balance.asset_issuer)})`;
    }
    return {
      key,
      label,
      balance,
      supported,
      pinned: supported && prefs.pinned.includes(key),
      hidden: supported && key !== NATIVE_ASSET_KEY && prefs.hidden.includes(key),
    };
  });

  const rank = (asset: OrganizedAsset): number => {
    if (asset.pinned) return prefs.pinned.indexOf(asset.key);
    if (asset.key === NATIVE_ASSET_KEY) return MAX_ENTRIES;
    return MAX_ENTRIES + 1;
  };
  // Array.prototype.sort is stable, so ties keep Horizon order.
  const ordered = [...assets].sort((a, b) => rank(a) - rank(b));

  return {
    visible: ordered.filter((a) => !a.hidden),
    hidden: ordered.filter((a) => a.hidden),
    total: assets.length,
  };
}
