import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { WalletsService } from './wallets.service';
import { Wallet } from './entities/wallet.entity';
import { WalletAuditLog } from './entities/wallet-audit-log.entity';
import { stellarConfig } from '../../config/stellar.config';

describe('WalletsService', () => {
  let service: WalletsService;
  let walletRepository: Repository<Wallet>;
  let auditRepository: Repository<WalletAuditLog>;

  const mockWalletRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
  };

  const mockAuditRepository = {
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockStellarConfig = {
    networks: {
      testnet: {
        horizonUrl: 'https://horizon-testnet.stellar.org',
        networkPassphrase: 'Test SDF Network ; September 2015',
      },
      public: {
        horizonUrl: 'https://horizon.stellar.org',
        networkPassphrase: 'Public Global Stellar Network ; September 2015',
      },
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletsService,
        {
          provide: getRepositoryToken(Wallet),
          useValue: mockWalletRepository,
        },
        {
          provide: getRepositoryToken(WalletAuditLog),
          useValue: mockAuditRepository,
        },
        {
          provide: stellarConfig.KEY,
          useValue: mockStellarConfig,
        },
      ],
    }).compile();

    service = module.get<WalletsService>(WalletsService);
    walletRepository = module.get<Repository<Wallet>>(
      getRepositoryToken(Wallet),
    );
    auditRepository = module.get<Repository<WalletAuditLog>>(
      getRepositoryToken(WalletAuditLog),
    );

    jest.clearAllMocks();
  });

  describe('createForUser', () => {
    it('should create a wallet for user', async () => {
      const userId = 'user-123';
      const dto = {
        userId,
        publicKey: 'GBUQWP3BOUZX34ULNQG23RQ6F4BWFIREAOCZQ27EMENDED5TXWDAOBJ6',
        encryptedSecretKey: 'encrypted-key',
        encryptionIv: 'iv-value',
        encryptionSalt: 'salt-value',
        keyDerivation: 'PBKDF2' as const,
        network: 'TESTNET' as const,
      };

      const mockWallet = { id: 'wallet-123', ...dto };
      mockWalletRepository.create.mockReturnValue(mockWallet);
      mockWalletRepository.save.mockResolvedValue(mockWallet);
      mockAuditRepository.create.mockReturnValue({});
      mockAuditRepository.save.mockResolvedValue({});

      const result = await service.createForUser(dto);

      expect(result.id).toBe('wallet-123');
      expect(result.userId).toBe(userId);
      expect(mockWalletRepository.save).toHaveBeenCalled();
      expect(mockAuditRepository.save).toHaveBeenCalled();
    });

    it('should set default values for optional fields', async () => {
      const dto = {
        userId: 'user-123',
        publicKey: 'GBUQWP3BOUZX34ULNQG23RQ6F4BWFIREAOCZQ27EMENDED5TXWDAOBJ6',
        encryptedSecretKey: 'encrypted-key',
        encryptionIv: 'iv-value',
        encryptionSalt: 'salt-value',
        keyDerivation: 'PBKDF2' as const,
        network: 'TESTNET' as const,
      };

      mockWalletRepository.create.mockReturnValue(dto);
      mockWalletRepository.save.mockResolvedValue(dto);
      mockAuditRepository.save.mockResolvedValue({});

      await service.createForUser(dto);

      const createCall = mockWalletRepository.create.mock.calls[0][0];
      expect(createCall.isMultiSig).toBe(false);
      expect(createCall.multisigConfig).toBeNull();
      expect(createCall.hsmKeyId).toBeNull();
    });
  });

  describe('findByUser', () => {
    it('should find all wallets for user', async () => {
      const userId = 'user-123';
      const mockWallets = [
        { id: 'wallet-1', userId, publicKey: 'GBU...' },
        { id: 'wallet-2', userId, publicKey: 'GBU...' },
      ];

      mockWalletRepository.find.mockResolvedValue(mockWallets);

      const result = await service.findByUser(userId);

      expect(result).toEqual(mockWallets);
      expect(mockWalletRepository.find).toHaveBeenCalledWith({
        where: { userId },
      });
    });
  });

  describe('findOneForUser', () => {
    it('should find wallet owned by user', async () => {
      const walletId = 'wallet-123';
      const userId = 'user-123';
      const mockWallet = { id: walletId, userId, publicKey: 'GBU...' };

      mockWalletRepository.findOne.mockResolvedValue(mockWallet);

      const result = await service.findOneForUser(walletId, userId);

      expect(result).toEqual(mockWallet);
      expect(mockWalletRepository.findOne).toHaveBeenCalledWith({
        where: { id: walletId, userId },
      });
    });

    it('should throw if wallet not found', async () => {
      mockWalletRepository.findOne.mockResolvedValue(null);

      await expect(
        service.findOneForUser('nonexistent', 'user-123'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw if wallet belongs to different user', async () => {
      mockWalletRepository.findOne.mockResolvedValue(null);

      await expect(
        service.findOneForUser('wallet-123', 'other-user'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('rotateKeys', () => {
    it('should rotate wallet keys', async () => {
      const walletId = 'wallet-123';
      const userId = 'user-123';
      const mockWallet = {
        id: walletId,
        userId,
        rotationVersion: 1,
        encryptedSecretKey: 'old-key',
        hsmKeyId: null,
      };

      mockWalletRepository.findOne.mockResolvedValue(mockWallet);
      mockWalletRepository.save.mockResolvedValue({
        ...mockWallet,
        encryptedSecretKey: 'new-key',
        rotationVersion: 2,
      });
      mockAuditRepository.save.mockResolvedValue({});

      const result = await service.rotateKeys(walletId, userId, {
        encryptedSecretKey: 'new-key',
      });

      expect(result.rotationVersion).toBe(2);
      expect(result.encryptedSecretKey).toBe('new-key');
      expect(mockWalletRepository.save).toHaveBeenCalled();
    });

    it('should allow HSM key during rotation', async () => {
      const walletId = 'wallet-123';
      const userId = 'user-123';
      mockWalletRepository.findOne.mockResolvedValue({
        id: walletId,
        rotationVersion: 1,
      });
      mockWalletRepository.save.mockResolvedValue({
        id: walletId,
        rotationVersion: 2,
        hsmKeyId: 'hsm-key-123',
      });
      mockAuditRepository.save.mockResolvedValue({});

      const result = await service.rotateKeys(walletId, userId, {
        hsmKeyId: 'hsm-key-123',
      });

      expect(result.hsmKeyId).toBe('hsm-key-123');
    });
  });

  describe('exportBackup', () => {
    it('should export wallet backup data', async () => {
      const walletId = 'wallet-123';
      const userId = 'user-123';
      const mockWallet = {
        id: walletId,
        userId,
        publicKey: 'GBUQWP3BOUZX34ULNQG23RQ6F4BWFIREAOCZQ27EMENDED5TXWDAOBJ6',
        encryptedSecretKey: 'encrypted-key',
        encryptionIv: 'iv-value',
        encryptionSalt: 'salt-value',
        keyDerivation: 'pbkdf2',
        network: 'testnet',
        isMultiSig: false,
        multisigConfig: null,
      };

      mockWalletRepository.findOne.mockResolvedValue(mockWallet);
      mockAuditRepository.save.mockResolvedValue({});

      const result = await service.exportBackup(walletId, userId, {
        backupPassword: 'password123',
      });

      expect(result.backupData.publicKey).toBe(mockWallet.publicKey);
      expect(result.backupData.encryptedSecretKey).toBe(mockWallet.encryptedSecretKey);
      expect(result.backupData.exportedAt).toBeTruthy();
    });

    it('should handle wallet without encrypted key', async () => {
      const walletId = 'wallet-123';
      const userId = 'user-123';
      const mockWallet = {
        id: walletId,
        userId,
        publicKey: 'GBUQWP3BOUZX34ULNQG23RQ6F4BWFIREAOCZQ27EMENDED5TXWDAOBJ6',
        encryptedSecretKey: null,
        encryptionIv: 'iv-value',
        encryptionSalt: 'salt-value',
        keyDerivation: 'pbkdf2',
        network: 'testnet',
        isMultiSig: false,
        multisigConfig: null,
      };

      mockWalletRepository.findOne.mockResolvedValue(mockWallet);
      mockAuditRepository.save.mockResolvedValue({});

      const result = await service.exportBackup(walletId, userId, {});

      expect(result.backupData.encryptedSecretKey).toBeNull();
    });
  });

  describe('recoverWallet', () => {
    it('should recover wallet from backup data', async () => {
      const userId = 'user-123';
      const backupData = {
        publicKey: 'GBUQWP3BOUZX34ULNQG23RQ6F4BWFIREAOCZQ27EMENDED5TXWDAOBJ6',
        encryptedSecretKey: 'encrypted-key',
        encryptionIv: 'iv-value',
        encryptionSalt: 'salt-value',
        keyDerivation: 'PBKDF2' as const,
        network: 'TESTNET' as const,
        isMultiSig: false,
        multisigConfig: null,
      };

      mockWalletRepository.findOne.mockResolvedValue(null);
      mockWalletRepository.create.mockReturnValue({ userId, ...backupData });
      mockWalletRepository.save.mockResolvedValue({
        id: 'wallet-recovered',
        userId,
        ...backupData,
      });
      mockAuditRepository.save.mockResolvedValue({});

      const result = await service.recoverWallet(userId, { backupData });

      expect(result.userId).toBe(userId);
      expect(result.publicKey).toBe(backupData.publicKey);
      expect(mockWalletRepository.save).toHaveBeenCalled();
    });

    it('should throw if wallet with same public key exists', async () => {
      const userId = 'user-123';
      const backupData = {
        publicKey: 'GBUQWP3BOUZX34ULNQG23RQ6F4BWFIREAOCZQ27EMENDED5TXWDAOBJ6',
        encryptedSecretKey: 'encrypted-key',
        encryptionIv: 'iv-value',
        encryptionSalt: 'salt-value',
        keyDerivation: 'PBKDF2' as const,
        network: 'TESTNET' as const,
        isMultiSig: false,
        multisigConfig: null,
      };

      mockWalletRepository.findOne.mockResolvedValue({
        id: 'existing-wallet',
        publicKey: backupData.publicKey,
      });

      await expect(
        service.recoverWallet(userId, { backupData }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should set default rotation version to 1 on recovery', async () => {
      const userId = 'user-123';
      const backupData = {
        publicKey: 'GBUQWP3BOUZX34ULNQG23RQ6F4BWFIREAOCZQ27EMENDED5TXWDAOBJ6',
        encryptedSecretKey: 'encrypted-key',
        encryptionIv: 'iv-value',
        encryptionSalt: 'salt-value',
        keyDerivation: 'PBKDF2' as const,
        network: 'TESTNET' as const,
        isMultiSig: false,
        multisigConfig: null,
      };

      mockWalletRepository.findOne.mockResolvedValue(null);
      mockWalletRepository.create.mockReturnValue({
        userId,
        rotationVersion: 1,
        ...backupData,
      });
      mockWalletRepository.save.mockResolvedValue({
        userId,
        rotationVersion: 1,
        ...backupData,
      });
      mockAuditRepository.save.mockResolvedValue({});

      const result = await service.recoverWallet(userId, { backupData });

      expect(result.rotationVersion).toBe(1);
    });
  });
});
