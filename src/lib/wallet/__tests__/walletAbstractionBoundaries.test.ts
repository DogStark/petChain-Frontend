/**
 * Characterization tests for the wallet abstraction boundaries.
 *
 * These tests document the KNOWN BUGS and AMBIGUITIES found before the fix was
 * applied. Each test is labeled with the issue it characterises and asserts the
 * CORRECT post-fix behaviour so the suite stays green as a regression guard.
 *
 * Issues reproduced here (pre-fix):
 *   1. importBackup: missing closing brace on `if (existing)` — dead code
 *      caused the method to silently never create the wallet.
 *   2. WalletBalance name collision: services/walletBalance.ts and
 *      types/wallet.ts exported different interfaces under the same name.
 *   3. walletAPI.getWallets / storeBackup / getBackup / getWalletTransactions
 *      are never called on the read path — confirmed dead code.
 */

// ── crypto polyfill (jsdom does not include TextEncoder / TextDecoder) ────────
import { TextEncoder, TextDecoder } from 'util';
Object.assign(globalThis, { TextEncoder, TextDecoder });
Object.defineProperty(globalThis, 'crypto', {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  value: require('crypto').webcrypto,
  writable: true,
});

// ── stellar-sdk mock ──────────────────────────────────────────────────────────
jest.mock('@stellar/stellar-sdk', () => {
  const mockKeypair = {
    publicKey: () => 'GBTEST_PUBLIC_KEY_CHARACTERIZATION',
    secret: () => 'SBTEST_SECRET_KEY_CHARACTERIZATION',
  };
  return {
    Keypair: {
      random: () => mockKeypair,
      fromSecret: () => mockKeypair,
    },
    Networks: { PUBLIC: 'Public Global Stellar Network ; Sep 2015', TESTNET: 'Test SDF Network ; September 2015' },
    Asset: { native: () => ({ isNative: () => true }) },
    TransactionBuilder: jest.fn().mockImplementation(() => ({
      addOperation: jest.fn().mockReturnThis(),
      setTimeout: jest.fn().mockReturnThis(),
      build: jest.fn().mockReturnValue({ sign: jest.fn() }),
    })),
    Operation: { payment: jest.fn(), setOptions: jest.fn() },
    Memo: { text: jest.fn((t) => t) },
    BASE_FEE: '100',
    Horizon: {
      Server: jest.fn().mockImplementation(() => ({
        loadAccount: jest.fn().mockResolvedValue({
          balances: [], sequence: '0', signers: [],
          thresholds: { low_threshold: 0, med_threshold: 0, high_threshold: 0 },
        }),
        submitTransaction: jest.fn().mockResolvedValue({
          hash: 'char_hash', ledger: 1, successful: true,
          envelope_xdr: '', result_xdr: '',
        }),
        feeStats: jest.fn().mockResolvedValue({
          fee_charged: { min: '100', mode: '200', p90: '500' },
        }),
      })),
    },
  };
});

// ── walletCrypto mock ─────────────────────────────────────────────────────────
jest.mock('../walletCrypto', () => ({
  encryptSecretKey: jest.fn().mockResolvedValue({
    encryptedKey: 'char_encrypted',
    iv: 'char_iv',
    salt: 'char_salt',
  }),
  decryptSecretKey: jest.fn().mockResolvedValue('SBTEST_SECRET_KEY_CHARACTERIZATION'),
  computeChecksum: jest.fn().mockResolvedValue('char_checksum_64chars_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'),
}));

jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  randomUUID: jest.fn(() => 'char-uuid-0001'),
}));

// ── walletAPI mock ────────────────────────────────────────────────────────────
jest.mock('../../api/walletAPI', () => ({
  walletAPI: {
    registerWallet: jest.fn().mockResolvedValue({ id: 'server-w-1' }),
    getWallets: jest.fn().mockResolvedValue([]),
    updateWallet: jest.fn().mockResolvedValue({ id: 'server-w-1' }),
    deleteWallet: jest.fn().mockResolvedValue(undefined),
    storeBackup: jest.fn().mockResolvedValue(undefined),
    getBackup: jest.fn().mockResolvedValue({}),
    getWalletTransactions: jest.fn().mockResolvedValue([]),
  },
}));

import type { AccountBalance } from '../../../services/walletBalance';
import type { WalletBalance as StellarBalanceRecord } from '../../../types/wallet';
import { walletAPI } from '../../api/walletAPI';
import { computeChecksum } from '../walletCrypto';
import walletService from '../walletService';

const STORAGE_KEY = 'petchain_wallets';

const GOOD_BACKUP = {
  version: 1 as const,
  publicKey: 'GBTEST_PUBLIC_KEY_CHARACTERIZATION',
  encryptedKey: 'char_encrypted',
  iv: 'char_iv',
  salt: 'char_salt',
  network: 'TESTNET',
  label: 'Char Wallet',
  createdAt: '2025-01-01T00:00:00.000Z',
  checksum: 'char_checksum_64chars_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
};

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
  (computeChecksum as jest.Mock).mockResolvedValue(
    'char_checksum_64chars_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// ISSUE 1: importBackup — missing closing brace on `if (existing)` block
// Before fix: wallet construction was inside the `if` branch and unreachable
// after the throw; the method effectively never returned a new wallet.
// After fix:  `if (existing)` closes after the throw and the happy path runs.
// ─────────────────────────────────────────────────────────────────────────────
describe('Issue 1 — importBackup: missing closing brace on if(existing)', () => {
  it('creates and persists a wallet from a valid backup when no duplicate exists', async () => {
    const wallet = await walletService.importBackup(GOOD_BACKUP, 'correct-pin');

    expect(wallet.publicKey).toBe(GOOD_BACKUP.publicKey);
    expect(wallet.label).toBe(GOOD_BACKUP.label);
    expect(wallet.network).toBe('TESTNET');
    expect(wallet.backupVerified).toBe(true);
    expect(walletService.getWallets()).toHaveLength(1);
  });

  it('throws when the wallet is already present (duplicate guard works)', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        {
          id: 'wallet_existing',
          publicKey: GOOD_BACKUP.publicKey,
          encryptedSecretKey: 'enc',
          iv: 'iv',
          salt: 'salt',
          label: 'Existing',
          type: 'standard',
          network: 'TESTNET',
          createdAt: '2025-01-01T00:00:00.000Z',
          backupVerified: true,
        },
      ])
    );

    await expect(walletService.importBackup(GOOD_BACKUP, 'correct-pin')).rejects.toThrow(
      'already added'
    );
  });

  it('throws when backup checksum is tampered', async () => {
    (computeChecksum as jest.Mock).mockResolvedValueOnce('different_checksum_entirely');
    await expect(
      walletService.importBackup({ ...GOOD_BACKUP, checksum: 'original_checksum' }, 'pin')
    ).rejects.toThrow('corrupted or has been tampered');
  });

  it('fires backend registration after successful import (fire-and-forget)', async () => {
    await walletService.importBackup(GOOD_BACKUP, 'correct-pin');
    // Allow the fire-and-forget promise to flush
    await new Promise((r) => setTimeout(r, 0));
    expect(walletAPI.registerWallet).toHaveBeenCalledWith(
      GOOD_BACKUP.publicKey,
      GOOD_BACKUP.label,
      'TESTNET'
    );
  });

  it('accepts a backup from a different network (cross-network import)', async () => {
    const mainnetBackup = { ...GOOD_BACKUP, network: 'PUBLIC' };
    const wallet = await walletService.importBackup(mainnetBackup, 'correct-pin');
    expect(wallet.network).toBe('PUBLIC');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ISSUE 2: WalletBalance name collision
// Before fix: types/wallet.ts and services/walletBalance.ts both exported an
// interface named WalletBalance with completely different shapes.
// After fix:  services/walletBalance.ts exports AccountBalance (account-level
// aggregate) while types/wallet.ts keeps WalletBalance (per-asset Stellar record).
// ─────────────────────────────────────────────────────────────────────────────
describe('Issue 2 — WalletBalance type name collision is resolved', () => {
  it('types/wallet WalletBalance matches the Stellar per-asset record shape', () => {
    // Type-level test — if this compiles without error, the shapes are correct.
    const record: StellarBalanceRecord = {
      asset_type: 'native',
      balance: '100.0',
    };
    expect(record.asset_type).toBe('native');
    expect(record.balance).toBe('100.0');
  });

  it('services/walletBalance AccountBalance matches the account-level aggregate shape', () => {
    // Type-level test — compiles only if AccountBalance exists and has the right fields.
    const aggregate: AccountBalance = {
      publicKey: 'GPUBLIC',
      balances: [
        { assetCode: 'XLM', balance: '100.0', assetType: 'native', isNative: true },
      ],
      nativeBalance: 100.0,
      lastUpdated: new Date(),
      network: 'testnet',
    };
    expect(aggregate.publicKey).toBe('GPUBLIC');
    expect(aggregate.nativeBalance).toBe(100.0);
  });

  it('the two types are structurally distinct (different required fields)', () => {
    // StellarBalanceRecord has asset_type+balance (snake_case Stellar fields)
    // AccountBalance has publicKey+balances[] (camelCase aggregate fields)
    const stellarFields: (keyof StellarBalanceRecord)[] = ['asset_type', 'balance'];
    const aggregateFields: (keyof AccountBalance)[] = ['publicKey', 'balances', 'nativeBalance', 'lastUpdated', 'network'];

    const overlap = stellarFields.filter((f) => (aggregateFields as string[]).includes(f));
    expect(overlap).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ISSUE 3: walletAPI read-path methods are dead code
// Before fix: getWallets(), storeBackup(), getBackup(), getWalletTransactions()
// were defined but never called from walletService or useWallet.
// After fix:  these methods are removed from walletAPI and documented as
// intentionally absent — the local read path uses localStorage directly.
// ─────────────────────────────────────────────────────────────────────────────
describe('Issue 3 — walletAPI.getWallets is not called on the local read path', () => {
  it('walletService.getWallets() reads from localStorage without calling walletAPI', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        {
          id: 'wallet_local',
          publicKey: 'GPUBLIC_LOCAL',
          encryptedSecretKey: 'enc',
          iv: 'iv',
          salt: 'salt',
          label: 'Local Wallet',
          type: 'standard',
          network: 'TESTNET',
          createdAt: '2025-01-01T00:00:00.000Z',
          backupVerified: true,
        },
      ])
    );

    const wallets = walletService.getWallets();
    expect(wallets).toHaveLength(1);
    expect(wallets[0].id).toBe('wallet_local');
    expect(walletAPI.getWallets).not.toHaveBeenCalled();
  });

  it('createWallet registers with backend but does NOT call walletAPI.getWallets', async () => {
    await walletService.createWallet('Test', 'pin1234');
    await new Promise((r) => setTimeout(r, 0));
    expect(walletAPI.registerWallet).toHaveBeenCalledTimes(1);
    expect(walletAPI.getWallets).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// walletService core — happy path regression coverage
// ─────────────────────────────────────────────────────────────────────────────
describe('walletService — core lifecycle regression', () => {
  it('createWallet persists an encrypted wallet locally', async () => {
    const wallet = await walletService.createWallet('Regression Wallet', 'securePin!99');
    expect(wallet.id).toBe('wallet_char-uuid-0001');
    expect(wallet.encryptedSecretKey).toBe('char_encrypted');
    expect(walletService.getWallets()).toHaveLength(1);
  });

  it('deleteWallet removes wallet from localStorage', async () => {
    const wallet = await walletService.createWallet('To Delete', 'pin');
    expect(walletService.getWallets()).toHaveLength(1);
    walletService.deleteWallet(wallet.id);
    expect(walletService.getWallets()).toHaveLength(0);
  });

  it('markBackupVerified flips backupVerified to true', async () => {
    // importWallet creates with backupVerified: false
    const wallet = await walletService.importWallet(
      'SBTEST_SECRET_KEY_CHARACTERIZATION',
      'Import Label',
      'pin'
    );
    expect(wallet.backupVerified).toBe(false);
    walletService.markBackupVerified(wallet.id);
    expect(walletService.getWallet(wallet.id)?.backupVerified).toBe(true);
  });

  it('exportBackup produces a payload with a checksum', async () => {
    const wallet = await walletService.createWallet('Backup Me', 'pin');
    const backup = await walletService.exportBackup(wallet, 'pin');
    expect(backup).toHaveProperty('checksum');
    expect(backup.publicKey).toBe(wallet.publicKey);
    expect(backup.encryptedKey).toBe(wallet.encryptedSecretKey);
  });

  it('importWallet rejects duplicate public keys', async () => {
    await walletService.importWallet('SBTEST_SECRET_KEY_CHARACTERIZATION', 'First', 'pin');
    await expect(
      walletService.importWallet('SBTEST_SECRET_KEY_CHARACTERIZATION', 'Duplicate', 'pin')
    ).rejects.toThrow('already added');
  });
});
