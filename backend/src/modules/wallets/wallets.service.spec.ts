import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { WalletsService } from './wallets.service';
import { Wallet } from './entities/wallet.entity';
import { WalletAuditLog } from './entities/wallet-audit-log.entity';
import { stellarConfig } from '../../config/stellar.config';

describe('WalletsService', () => {
  let service: WalletsService;
  let walletRepo: { create: jest.Mock; save: jest.Mock; find: jest.Mock; findOne: jest.Mock };
  let auditRepo: { create: jest.Mock; save: jest.Mock };

  beforeEach(async () => {
    walletRepo = {
      create: jest.fn((data) => data),
      save: jest.fn((data) => Promise.resolve({ id: 'wallet-1', ...data })),
      find: jest.fn(),
      findOne: jest.fn(),
    };
    auditRepo = {
      create: jest.fn((data) => data),
      save: jest.fn((data) => Promise.resolve(data)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletsService,
        { provide: getRepositoryToken(Wallet), useValue: walletRepo },
        { provide: getRepositoryToken(WalletAuditLog), useValue: auditRepo },
        {
          provide: stellarConfig.KEY,
          useValue: {
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
          },
        },
      ],
    }).compile();

    service = module.get<WalletsService>(WalletsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createForUser', () => {
    it('creates and records an audit entry for a new wallet', async () => {
      const dto = { userId: 'user-1', network: 'testnet' } as any;
      const wallet = await service.createForUser(dto);

      expect(walletRepo.save).toHaveBeenCalled();
      expect(wallet.id).toBe('wallet-1');
      expect(auditRepo.save).toHaveBeenCalled();
    });
  });

  describe('findOneForUser', () => {
    it('throws NotFoundException when the wallet does not belong to the user', async () => {
      walletRepo.findOne.mockResolvedValue(null);
      await expect(service.findOneForUser('wallet-1', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns the wallet when found', async () => {
      walletRepo.findOne.mockResolvedValue({ id: 'wallet-1', userId: 'user-1', network: 'testnet' });
      const wallet = await service.findOneForUser('wallet-1', 'user-1');
      expect(wallet.id).toBe('wallet-1');
    });
  });

  describe('prepareTransaction network validation', () => {
    it('rejects when the requested network does not match the wallet network', async () => {
      walletRepo.findOne.mockResolvedValue({
        id: 'wallet-1',
        userId: 'user-1',
        network: 'testnet',
      });

      await expect(
        service.prepareTransaction('wallet-1', 'user-1', {
          network: 'public',
          sourcePublicKey: 'G' + 'A'.repeat(55),
          operations: [],
        } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
