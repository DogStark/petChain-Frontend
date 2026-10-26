import type { WalletBalance } from '@/types/wallet';

import {
  EMPTY_ASSET_PREFERENCES,
  NATIVE_ASSET_KEY,
  getAssetKey,
  getAssetPreferencesStorageKey,
  organizeAssets,
  parseAssetPreferences,
  toggleHiddenAsset,
  togglePinnedAsset,
} from '../assetPreferences';

const ISSUER_A = 'GAISSUERAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const ISSUER_B = 'GBISSUERBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';

const xlm: WalletBalance = { asset_type: 'native', balance: '100.0000000' };
const usdcA: WalletBalance = {
  asset_type: 'credit_alphanum4',
  asset_code: 'USDC',
  asset_issuer: ISSUER_A,
  balance: '25.0000000',
};
const usdcB: WalletBalance = { ...usdcA, asset_issuer: ISSUER_B, balance: '5.0000000' };
const pet: WalletBalance = {
  asset_type: 'credit_alphanum12',
  asset_code: 'PETTOKEN',
  asset_issuer: ISSUER_A,
  balance: '1.0000000',
};
const pool: WalletBalance = { asset_type: 'liquidity_pool_shares', balance: '3.0000000' };

const USDC_A = `USDC:${ISSUER_A}`;
const PET = `PETTOKEN:${ISSUER_A}`;

describe('assetPreferences', () => {
  describe('getAssetKey', () => {
    it('distinguishes the same code from different issuers', () => {
      expect(getAssetKey(usdcA, 0)).not.toBe(getAssetKey(usdcB, 1));
      expect(getAssetKey(xlm, 3)).toBe(NATIVE_ASSET_KEY);
    });
  });

  it('scopes storage keys by network and wallet', () => {
    expect(getAssetPreferencesStorageKey('w1', 'TESTNET')).not.toBe(
      getAssetPreferencesStorageKey('w1', 'PUBLIC'),
    );
  });

  describe('parseAssetPreferences', () => {
    it('returns defaults for missing or corrupted data', () => {
      expect(parseAssetPreferences(null)).toEqual(EMPTY_ASSET_PREFERENCES);
      expect(parseAssetPreferences('{not json')).toEqual(EMPTY_ASSET_PREFERENCES);
      expect(parseAssetPreferences('null')).toEqual(EMPTY_ASSET_PREFERENCES);
      expect(parseAssetPreferences('{"pinned":"USDC","hidden":42}')).toEqual(
        EMPTY_ASSET_PREFERENCES,
      );
    });

    it('drops invalid entries, duplicates, hidden XLM and pinned/hidden conflicts', () => {
      const raw = JSON.stringify({
        pinned: [USDC_A, USDC_A, 7, '', 'x'.repeat(200)],
        hidden: [NATIVE_ASSET_KEY, USDC_A, PET],
      });
      expect(parseAssetPreferences(raw)).toEqual({ pinned: [USDC_A], hidden: [PET] });
    });
  });

  describe('toggles', () => {
    it('pinning an asset un-hides it and vice versa', () => {
      const hiddenPrefs = toggleHiddenAsset(EMPTY_ASSET_PREFERENCES, USDC_A);
      expect(hiddenPrefs).toEqual({ pinned: [], hidden: [USDC_A] });

      const pinnedPrefs = togglePinnedAsset(hiddenPrefs, USDC_A);
      expect(pinnedPrefs).toEqual({ pinned: [USDC_A], hidden: [] });

      expect(toggleHiddenAsset(pinnedPrefs, USDC_A)).toEqual({ pinned: [], hidden: [USDC_A] });
    });

    it('toggling twice restores the original state', () => {
      const once = togglePinnedAsset(EMPTY_ASSET_PREFERENCES, PET);
      expect(togglePinnedAsset(once, PET)).toEqual(EMPTY_ASSET_PREFERENCES);
    });

    it('never hides XLM', () => {
      expect(toggleHiddenAsset(EMPTY_ASSET_PREFERENCES, NATIVE_ASSET_KEY)).toBe(
        EMPTY_ASSET_PREFERENCES,
      );
    });
  });

  describe('organizeAssets', () => {
    it('shows XLM first and keeps Horizon order by default', () => {
      const result = organizeAssets([pet, usdcA, xlm], EMPTY_ASSET_PREFERENCES);
      expect(result.visible.map((a) => a.key)).toEqual([NATIVE_ASSET_KEY, PET, USDC_A]);
      expect(result.hidden).toEqual([]);
      expect(result.total).toBe(3);
    });

    it('puts pinned assets first in pin order and separates hidden ones', () => {
      const result = organizeAssets([xlm, usdcA, pet, usdcB], {
        pinned: [PET, USDC_A],
        hidden: [`USDC:${ISSUER_B}`],
      });
      expect(result.visible.map((a) => a.key)).toEqual([PET, USDC_A, NATIVE_ASSET_KEY]);
      expect(result.hidden.map((a) => a.key)).toEqual([`USDC:${ISSUER_B}`]);
      expect(result.total).toBe(4);
    });

    it('ignores preferences for assets the account no longer holds', () => {
      const result = organizeAssets([xlm, usdcA], {
        pinned: ['GONE:ISSUER'],
        hidden: ['ALSOGONE:ISSUER'],
      });
      expect(result.hidden).toHaveLength(0);
      expect(result.visible.every((a) => !a.pinned)).toBe(true);
    });

    it('labels duplicate codes with their issuer', () => {
      const result = organizeAssets([usdcA, usdcB], EMPTY_ASSET_PREFERENCES);
      expect(result.visible[0].label).toBe('USDC (GAIS…AAAA)');
      expect(result.visible[1].label).toBe('USDC (GBIS…BBBB)');
    });

    it('always shows unsupported assets without controls', () => {
      const result = organizeAssets([xlm, pool], {
        pinned: ['liquidity_pool_shares:1'],
        hidden: ['liquidity_pool_shares:1'],
      });
      const poolAsset = result.visible.find((a) => a.key === 'liquidity_pool_shares:1');
      expect(poolAsset).toMatchObject({ supported: false, pinned: false, hidden: false });
    });

    it('handles an empty account', () => {
      expect(organizeAssets([], EMPTY_ASSET_PREFERENCES)).toEqual({
        visible: [],
        hidden: [],
        total: 0,
      });
    });
  });
});
