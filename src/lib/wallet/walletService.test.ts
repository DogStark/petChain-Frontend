// Mock crypto before importing walletService
Object.defineProperty(globalThis, 'crypto', {
  value: require('crypto').webcrypto,
  writable: true,
});

// Mock @stellar/stellar-sdk
jest.mock('@stellar/stellar-sdk', () => {
  const mockKeypair = {
    publicKey: () => 'MOCK_PUBLIC_KEY',
    secret: () => 'MOCK_SECRET_KEY',
  };
  return {
    Keypair: {
      random: () => mockKeypair,
      fromSecret: () => mockKeypair,
    },
    Networks: { PUBLIC: 'Public Global Stellar Network', TESTNET: 'Test SDF Network' },
    Asset: { native: () => ({ isNative: () => true }) },
    TransactionBuilder: jest.fn().mockImplementation(() => ({
      addOperation: jest.fn().mockReturnThis(),
      addMemo: jest.fn().mockReturnThis(),
      setTimeout: jest.fn().mockReturnThis(),
      build: jest.fn().mockReturnValue({ sign: jest.fn() }),
    })),
    Operation: {
      payment: jest.fn(),
      setOptions: jest.fn(),
    },
    Memo: { text: jest.fn((t) => t) },
    BASE_FEE: '100',
    Horizon: {
      Server: jest.fn().mockImplementation(() => ({
        loadAccount: jest.fn().mockResolvedValue({
          balances: [],
          sequence: '0',
          signers: [],
          thresholds: { low_threshold: 0, med_threshold: 0, high_threshold: 0 },
        }),
        submitTransaction: jest.fn().mockResolvedValue({
          hash: 'mock_hash',
          ledger: 1,
          successful: true,
          envelope_xdr: 'mock_xdr',
          result_xdr: 'mock_result_xdr',
        }),
        feeStats: jest.fn().mockResolvedValue({
          fee_charged: { min: '100', mode: '200', p90: '500' },
        }),
      })),
    },
  };
});

// Mock walletCrypto
jest.mock('./walletCrypto', () => ({
  encryptSecretKey: jest.fn().mockResolvedValue({
    encryptedKey: 'mock_encrypted',
    iv: 'mock_iv',
    salt: 'mock_salt',
  }),
  decryptSecretKey: jest.fn().mockResolvedValue('MOCK_SECRET_KEY'),
  computeChecksum: jest.fn().mockResolvedValue('mock_checksum_64chars_padding_here_00000000000000000000000000'),
}));

// Mock randomUUID
jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  randomUUID: jest.fn(() => 'test-uuid-1234'),
}));

import walletService from './walletService';
import { encryptSecretKey, decryptSecretKey, computeChecksum } from './walletCrypto';

const STORAGE_KEY = 'petchain_wallets';

const mockWallet = {
  id: 'wallet_test-uuid-1234',
  publicKey: 'MOCK_PUBLIC_KEY',
  encryptedSecretKey: 'mock_encrypted',
  iv: 'mock_iv',
  salt: 'mock_salt',
  label: 'Test Wallet',
  type: 'standard' as const,
  network: 'TESTNET' as const,
  createdAt: '2024-01-01T00:00:00.000Z',
  backupVerified: true,
};

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
  // Reset computeChecksum to return deterministic value matching what importBackup expects
  (computeChecksum as jest.Mock).mockResolvedValue('mock_checksum_64chars_padding_here_00000000000000000000000000');
});

describe('WalletService', () => {
  describe('getWallets', () => {
    it('returns empty array when localStorage is empty', () => {
      expect(walletService.getWallets()).toEqual([]);
    });

    it('returns parsed wallets from localStorage', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([mockWallet]));
      expect(walletService.getWallets()).toEqual([mockWallet]);
    });

    it('returns empty array on corrupted localStorage JSON', () => {
      localStorage.setItem(STORAGE_KEY, 'NOT_VALID_JSON{{{');
      expect(walletService.getWallets()).toEqual([]);
    });

    it('returns empty array when localStorage value is null', () => {
      // localStorage.getItem returns null for missing keys
      expect(walletService.getWallets()).toEqual([]);
    });
  });

  describe('getWallet', () => {
    it('returns null when wallet not found', () => {
      expect(walletService.getWallet('non-existent')).toBeNull();
    });

    it('returns the wallet by id', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([mockWallet]));
      expect(walletService.getWallet(mockWallet.id)).toEqual(mockWallet);
    });
  });

  describe('persistWallet', () => {
    it('adds a new wallet to localStorage', () => {
      walletService.persistWallet(mockWallet);
      expect(walletService.getWallets()).toEqual([mockWallet]);
    });

    it('updates an existing wallet in-place', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([mockWallet]));
      const updated = { ...mockWallet, label: 'Updated Label' };
      walletService.persistWallet(updated);
      const wallets = walletService.getWallets();
      expect(wallets).toHaveLength(1);
      expect(wallets[0].label).toBe('Updated Label');
    });
  });

  describe('deleteWallet', () => {
    it('removes a wallet by id', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([mockWallet]));
      walletService.deleteWallet(mockWallet.id);
      expect(walletService.getWallets()).toEqual([]);
    });

    it('is a no-op for a non-existent id', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([mockWallet]));
      walletService.deleteWallet('non-existent');
      expect(walletService.getWallets()).toHaveLength(1);
    });
  });

  describe('markBackupVerified', () => {
    it('sets backupVerified to true', () => {
      const unverified = { ...mockWallet, backupVerified: false };
      localStorage.setItem(STORAGE_KEY, JSON.stringify([unverified]));
      walletService.markBackupVerified(mockWallet.id);
      expect(walletService.getWallet(mockWallet.id)?.backupVerified).toBe(true);
    });

    it('is a no-op for a non-existent wallet', () => {
      expect(() => walletService.markBackupVerified('ghost')).not.toThrow();
    });
  });

  describe('decryptKey / verifyPin', () => {
    it('decryptKey delegates to decryptSecretKey', async () => {
      const secret = await walletService.decryptKey(mockWallet, 'pin');
      expect(decryptSecretKey).toHaveBeenCalledWith(
        mockWallet.encryptedSecretKey,
        mockWallet.iv,
        mockWallet.salt,
        'pin'
      );
      expect(secret).toBe('MOCK_SECRET_KEY');
    });

    it('verifyPin returns true when decryption succeeds', async () => {
      expect(await walletService.verifyPin(mockWallet, 'pin')).toBe(true);
    });

    it('verifyPin returns false when decryption throws', async () => {
      (decryptSecretKey as jest.Mock).mockRejectedValueOnce(new Error('wrong pin'));
      expect(await walletService.verifyPin(mockWallet, 'bad-pin')).toBe(false);
    });
  });

  describe('estimateFee', () => {
    it('returns fee stats from the server', async () => {
      const fee = await walletService.estimateFee();
      expect(fee).toEqual({ base: '100', recommended: '200', high: '500' });
    });
  });

  describe('sendPayment', () => {
    it('returns broadcast result on success', async () => {
      const tx = {
        destination: 'GDEST...',
        asset: 'XLM',
        amount: '10',
        fee: '100',
        memo: 'test',
      };
      const result = await walletService.sendPayment(mockWallet, 'pin', tx);
      expect(result.successful).toBe(true);
      expect(result.hash).toBe('mock_hash');
    });

    it('propagates error when submitTransaction fails', async () => {
      const { Horizon } = require('@stellar/stellar-sdk');
      Horizon.Server.mockImplementationOnce(() => ({
        loadAccount: jest.fn().mockResolvedValue({
          balances: [], sequence: '0', signers: [],
          thresholds: { low_threshold: 0, med_threshold: 0, high_threshold: 0 },
        }),
        submitTransaction: jest.fn().mockRejectedValue(new Error('network error')),
        feeStats: jest.fn(),
      }));

      // Re-import to get new instance — use a fresh service to pick up mock
      const { default: ws } = await import('./walletService');
      await expect(
        ws.sendPayment(mockWallet, 'pin', { destination: 'G...', asset: 'XLM', amount: '1' })
      ).rejects.toThrow();
    });
  });

  describe('exportBackup / importBackup', () => {
    it('exportBackup returns payload with checksum', async () => {
      const backup = await walletService.exportBackup(mockWallet, 'pin');
      expect(backup).toHaveProperty('checksum');
      expect(backup.publicKey).toBe(mockWallet.publicKey);
    });

    it('importBackup restores wallet and persists it', async () => {
      const backup = {
        version: 1,
        publicKey: 'MOCK_PUBLIC_KEY',
        encryptedKey: 'mock_encrypted',
        iv: 'mock_iv',
        salt: 'mock_salt',
        network: 'TESTNET',
        label: 'Restored',
        createdAt: '2024-01-01T00:00:00.000Z',
        checksum: 'mock_checksum_64chars_padding_here_00000000000000000000000000',
      };
      const wallet = await walletService.importBackup(backup, 'pin');
      expect(wallet.publicKey).toBe('MOCK_PUBLIC_KEY');
      expect(wallet.label).toBe('Restored');
      expect(walletService.getWallets()).toHaveLength(1);
    });

    it('importBackup throws on tampered checksum', async () => {
      (computeChecksum as jest.Mock).mockResolvedValueOnce('different_checksum');
      const backup = {
        version: 1,
        publicKey: 'MOCK_PUBLIC_KEY',
        encryptedKey: 'mock_encrypted',
        iv: 'mock_iv',
        salt: 'mock_salt',
        network: 'TESTNET',
        label: 'Evil',
        createdAt: '2024-01-01T00:00:00.000Z',
        checksum: 'original_checksum',
      };
      await expect(walletService.importBackup(backup, 'pin')).rejects.toThrow(
        'corrupted or has been tampered'
      );
    });
  });
});
