import { validateMultisigConfig, buildConfigSummary } from './multisigValidation';
import type { WalletSigner, WalletMonitoringData } from '../types/wallet';

const WALLET_PK = 'GBDXN7RPDL5AWZFBZJMV3SMNYPZLXBXQFTHFB7LHDAFLMD6VYWBQBGD';
const SIGNER_A = 'GBCM6LX7UMVNTVH5WJXYN56XLOMO5FSL6OGPXD4RMFQXQJLEJPFVCMEA';
const SIGNER_B = 'GCY4DE3Y5GMT2ATVJDVJ5MHL66VZ5KZPR5OQFVJEZV5H6RJBGV7PEYBB';
const SIGNER_C = 'GCFXHWST5IKFN4GR7Y3N3QY2E4V6WJY5JG5U6KNJKV4YS5MISXNI3V5';

function makeSigners(...entries: [string, number][]): WalletSigner[] {
  return entries.map(([pk, w]) => ({ publicKey: pk, weight: w }));
}

function makeAccountData(signers: WalletSigner[]): WalletMonitoringData {
  return {
    publicKey: WALLET_PK,
    balances: [{ asset_type: 'native', balance: '100.0' }],
    sequence: '1',
    signers,
    thresholds: { low_threshold: 1, med_threshold: 2, high_threshold: 2 },
    lastFetched: new Date().toISOString(),
  };
}

describe('validateMultisigConfig', () => {
  const baseSigners = makeSigners([SIGNER_A, 1], [SIGNER_B, 1]);
  const emptyAccountData = makeAccountData([]);

  describe('public key validation', () => {
    it('rejects empty public keys', () => {
      const signers = makeSigners(['', 1]);
      const result = validateMultisigConfig(signers, 1, 1, 2, 2, WALLET_PK, emptyAccountData);
      expect(result.errors.length).toBeGreaterThanOrEqual(1);
      expect(result.errors.some((e) => e.includes('must have a public key'))).toBe(true);
    });

    it('rejects keys not starting with G', () => {
      const signers = makeSigners(['ABCD123456789012345678901234567890123456789012345678', 1]);
      const result = validateMultisigConfig(signers, 1, 1, 2, 2, WALLET_PK, emptyAccountData);
      expect(result.errors.some((e) => e.includes('not a valid Stellar public key'))).toBe(true);
    });

    it('rejects keys that are not 56 characters', () => {
      const shortKey = 'GBDXN7RPDL5AWZFBZJMV3SMNYPZLXBXQ';
      const signers = makeSigners([shortKey, 1]);
      const result = validateMultisigConfig(signers, 1, 1, 2, 2, WALLET_PK, emptyAccountData);
      expect(result.errors.some((e) => e.includes('not a valid Stellar public key'))).toBe(true);
    });

    it('accepts valid 56-char G-prefixed keys', () => {
      const signers = makeSigners([SIGNER_A, 1]);
      const result = validateMultisigConfig(signers, 1, 1, 2, 2, WALLET_PK, emptyAccountData);
      expect(result.errors.some((e) => e.includes('not a valid Stellar public key'))).toBe(false);
    });
  });

  describe('self-referencing', () => {
    it('rejects adding own key as co-signer', () => {
      const signers = makeSigners([WALLET_PK, 1]);
      const result = validateMultisigConfig(signers, 1, 1, 2, 2, WALLET_PK, emptyAccountData);
      expect(result.errors.some((e) => e.includes('cannot add your own key'))).toBe(true);
    });

    it('allows other valid keys', () => {
      const signers = makeSigners([SIGNER_A, 1]);
      const result = validateMultisigConfig(signers, 1, 1, 2, 2, WALLET_PK, emptyAccountData);
      expect(result.errors.some((e) => e.includes('cannot add your own key'))).toBe(false);
    });
  });

  describe('duplicate signer detection', () => {
    it('rejects duplicate keys among new signers', () => {
      const signers = makeSigners([SIGNER_A, 1], [SIGNER_A, 2]);
      const result = validateMultisigConfig(signers, 1, 1, 2, 2, WALLET_PK, emptyAccountData);
      expect(result.errors.some((e) => e.includes('Duplicate co-signer keys'))).toBe(true);
    });

    it('rejects a new signer that already exists on-chain', () => {
      const accountData = makeAccountData([
        { publicKey: SIGNER_A, weight: 2 },
      ]);
      const signers = makeSigners([SIGNER_A, 1]);
      const result = validateMultisigConfig(signers, 1, 1, 2, 2, WALLET_PK, accountData);
      expect(result.errors.some((e) => e.includes('already exist(s) on-chain'))).toBe(true);
    });

    it('allows a new signer that does not conflict', () => {
      const signers = makeSigners([SIGNER_A, 1], [SIGNER_B, 1]);
      const result = validateMultisigConfig(signers, 1, 1, 2, 2, WALLET_PK, emptyAccountData);
      expect(result.errors.some((e) => e.includes('Duplicate co-signer keys'))).toBe(false);
      expect(result.errors.some((e) => e.includes('already exist(s) on-chain'))).toBe(false);
    });

    it('allows removing a signer and re-adding different ones', () => {
      const accountData = makeAccountData([
        { publicKey: SIGNER_A, weight: 1 },
      ]);
      const signers = makeSigners([SIGNER_B, 1]);
      const result = validateMultisigConfig(signers, 1, 1, 2, 2, WALLET_PK, accountData);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('weight validation', () => {
    it('rejects weight > 255', () => {
      const signers = makeSigners([SIGNER_A, 256]);
      const result = validateMultisigConfig(signers, 1, 1, 2, 2, WALLET_PK, emptyAccountData);
      expect(result.errors.some((e) => e.includes('weight must be between'))).toBe(true);
    });

    it('rejects negative weight', () => {
      const signers = makeSigners([SIGNER_A, -1]);
      const result = validateMultisigConfig(signers, 1, 1, 2, 2, WALLET_PK, emptyAccountData);
      expect(result.errors.some((e) => e.includes('weight must be between'))).toBe(true);
    });

    it('accepts weight 0', () => {
      const signers = makeSigners([SIGNER_A, 0]);
      const result = validateMultisigConfig(signers, 1, 1, 2, 2, WALLET_PK, emptyAccountData);
      expect(result.errors.some((e) => e.includes('weight must be between'))).toBe(false);
    });

    it('warns about zero-weight signers', () => {
      const signers = makeSigners([SIGNER_A, 0]);
      const result = validateMultisigConfig(signers, 1, 1, 2, 2, WALLET_PK, emptyAccountData);
      expect(result.warnings.some((w) => w.message.includes('weight 0'))).toBe(true);
    });

    it('rejects master weight > 255', () => {
      const result = validateMultisigConfig(baseSigners, 256, 1, 2, 2, WALLET_PK, emptyAccountData);
      expect(result.errors.some((e) => e.includes('Master weight must be between'))).toBe(true);
    });
  });

  describe('threshold ordering', () => {
    it('rejects medThreshold < lowThreshold', () => {
      const result = validateMultisigConfig(baseSigners, 1, 5, 3, 5, WALLET_PK, emptyAccountData);
      expect(result.errors.some((e) => e.includes('Medium threshold must be ≥ low threshold'))).toBe(true);
    });

    it('rejects highThreshold < medThreshold', () => {
      const result = validateMultisigConfig(baseSigners, 1, 1, 5, 3, WALLET_PK, emptyAccountData);
      expect(result.errors.some((e) => e.includes('High threshold must be ≥ medium threshold'))).toBe(true);
    });

    it('allows equal thresholds', () => {
      const result = validateMultisigConfig(baseSigners, 1, 2, 2, 2, WALLET_PK, emptyAccountData);
      expect(result.errors.some((e) => e.includes('threshold must be'))).toBe(false);
    });

    it('allows increasing thresholds', () => {
      const result = validateMultisigConfig(baseSigners, 1, 1, 2, 3, WALLET_PK, emptyAccountData);
      expect(result.errors.some((e) => e.includes('threshold must be'))).toBe(false);
    });
  });

  describe('threshold vs total weight', () => {
    it('rejects lowThreshold exceeding total weight', () => {
      const signers = makeSigners([SIGNER_A, 1]);
      const result = validateMultisigConfig(signers, 1, 5, 5, 5, WALLET_PK, emptyAccountData);
      expect(result.errors.some((e) => e.includes('Low threshold') && e.includes('exceeds total'))).toBe(true);
    });

    it('rejects medThreshold exceeding total weight', () => {
      const signers = makeSigners([SIGNER_A, 1]);
      const result = validateMultisigConfig(signers, 1, 1, 5, 5, WALLET_PK, emptyAccountData);
      expect(result.errors.some((e) => e.includes('Medium threshold') && e.includes('exceeds total'))).toBe(true);
    });

    it('rejects highThreshold exceeding total weight', () => {
      const signers = makeSigners([SIGNER_A, 1]);
      const result = validateMultisigConfig(signers, 1, 1, 2, 5, WALLET_PK, emptyAccountData);
      expect(result.errors.some((e) => e.includes('High threshold') && e.includes('exceeds total'))).toBe(true);
    });

    it('rejects all thresholds when total weight is zero', () => {
      const signers = makeSigners([SIGNER_A, 0]);
      const result = validateMultisigConfig(signers, 0, 1, 2, 2, WALLET_PK, emptyAccountData);
      expect(result.errors.some((e) => e.includes('Total available weight is 0'))).toBe(true);
    });

    it('accepts thresholds exactly equal to total weight', () => {
      const signers = makeSigners([SIGNER_A, 2]);
      const result = validateMultisigConfig(signers, 1, 3, 3, 3, WALLET_PK, emptyAccountData);
      expect(result.errors.some((e) => e.includes('exceeds total'))).toBe(false);
    });
  });

  describe('risky configuration warnings', () => {
    it('warns when highThreshold equals total weight', () => {
      const signers = makeSigners([SIGNER_A, 2]);
      const result = validateMultisigConfig(signers, 1, 1, 2, 3, WALLET_PK, emptyAccountData);
      expect(result.warnings.some((w) => w.field === 'highThreshold')).toBe(true);
    });

    it('warns when medThreshold equals total weight', () => {
      const signers = makeSigners([SIGNER_A, 2]);
      const result = validateMultisigConfig(signers, 1, 1, 3, 3, WALLET_PK, emptyAccountData);
      expect(result.warnings.some((w) => w.field === 'medThreshold')).toBe(true);
    });

    it('warns when masterWeight is 0 with no co-signers', () => {
      const result = validateMultisigConfig([], 0, 0, 0, 0, WALLET_PK, emptyAccountData);
      expect(result.warnings.some((w) => w.field === 'masterWeight')).toBe(true);
    });

    it('does not warn when thresholds are safely below total weight', () => {
      const signers = makeSigners([SIGNER_A, 5], [SIGNER_B, 5]);
      const result = validateMultisigConfig(signers, 5, 1, 5, 10, WALLET_PK, emptyAccountData);
      expect(result.warnings.some((w) => w.field === 'highThreshold')).toBe(false);
      expect(result.warnings.some((w) => w.field === 'medThreshold')).toBe(false);
    });
  });

  describe('happy path', () => {
    it('returns no errors for a valid configuration', () => {
      const signers = makeSigners([SIGNER_A, 2], [SIGNER_B, 1]);
      const result = validateMultisigConfig(signers, 1, 1, 2, 3, WALLET_PK, emptyAccountData);
      expect(result.errors).toHaveLength(0);
    });

    it('handles empty signer list with valid thresholds', () => {
      const result = validateMultisigConfig([], 5, 1, 2, 2, WALLET_PK, emptyAccountData);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('empty/loading states', () => {
    it('handles null accountData gracefully', () => {
      const signers = makeSigners([SIGNER_A, 1]);
      const result = validateMultisigConfig(signers, 1, 1, 2, 2, WALLET_PK, null);
      expect(result.errors).toHaveLength(0);
    });

    it('handles completely empty signers array', () => {
      const result = validateMultisigConfig([], 1, 0, 0, 0, WALLET_PK, emptyAccountData);
      expect(result.errors).toHaveLength(0);
    });
  });
});

describe('buildConfigSummary', () => {
  it('shows correct signer count', () => {
    const signers = makeSigners([SIGNER_A, 1], [SIGNER_B, 1]);
    const summary = buildConfigSummary(signers, 1, 1, 2, 2);
    const coSignersEntry = summary.find((s) => s.label === 'Co-signers');
    expect(coSignersEntry?.value).toBe('2 signer(s)');
  });

  it('filters out empty public keys from count', () => {
    const signers = makeSigners(['', 1], [SIGNER_A, 1]);
    const summary = buildConfigSummary(signers, 1, 1, 2, 2);
    const coSignersEntry = summary.find((s) => s.label === 'Co-signers');
    expect(coSignersEntry?.value).toBe('1 signer(s)');
  });

  it('calculates total weight correctly', () => {
    const signers = makeSigners([SIGNER_A, 3], [SIGNER_B, 2]);
    const summary = buildConfigSummary(signers, 1, 1, 2, 2);
    const totalEntry = summary.find((s) => s.label === 'Total Weight');
    expect(totalEntry?.value).toBe('6');
  });

  it('marks threshold entries as highlighted', () => {
    const summary = buildConfigSummary([], 1, 1, 2, 3);
    const medEntry = summary.find((s) => s.label === 'Medium Threshold');
    const highEntry = summary.find((s) => s.label === 'High Threshold');
    expect(medEntry?.highlight).toBe(true);
    expect(highEntry?.highlight).toBe(true);
  });

  it('returns all expected fields', () => {
    const summary = buildConfigSummary([], 1, 1, 2, 3);
    expect(summary.map((s) => s.label)).toEqual([
      'Co-signers',
      'Master Weight',
      'Total Weight',
      'Low Threshold',
      'Medium Threshold',
      'High Threshold',
    ]);
  });
});
