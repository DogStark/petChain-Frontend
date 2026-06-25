import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { StellarListenerService } from './stellar-listener.service';
import { Wallet } from './entities/wallet.entity';
import { WalletAuditLog } from './entities/wallet-audit-log.entity';
import { NotificationsGateway } from '../../websocket/gateways/notifications.gateway';

const mockWalletRepo = {
  find: jest.fn().mockResolvedValue([]),
};

const mockAuditLogRepo = {
  create: jest.fn().mockImplementation((data) => ({ id: 'log-1', ...data })),
  save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
};

const mockConfigService = {
  get: jest.fn().mockReturnValue('https://horizon-testnet.stellar.org'),
};

const mockGateway = {
  sendNotification: jest.fn().mockResolvedValue(undefined),
};

describe('StellarListenerService', () => {
  let service: StellarListenerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StellarListenerService,
        { provide: getRepositoryToken(Wallet), useValue: mockWalletRepo },
        { provide: getRepositoryToken(WalletAuditLog), useValue: mockAuditLogRepo },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: NotificationsGateway, useValue: mockGateway },
      ],
    }).compile();

    service = module.get<StellarListenerService>(StellarListenerService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('handleConfirmedTransaction', () => {
    const tx = {
      hash: 'abc123def456',
      ledger: 54321,
      fee_charged: '100',
      successful: true,
      source_account: 'GABC',
    };

    it('persists audit log with tx fields', async () => {
      await service.handleConfirmedTransaction(tx, 'wallet-1', 'user-1');

      expect(mockAuditLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          walletId: 'wallet-1',
          userId: 'user-1',
          operation: 'SUBMIT_TRANSACTION',
          ledger: 54321,
          feeCharged: '100',
        }),
      );
      expect(mockAuditLogRepo.save).toHaveBeenCalled();
    });

    it('sends WebSocket notification to wallet owner', async () => {
      await service.handleConfirmedTransaction(tx, 'wallet-1', 'user-1');

      expect(mockGateway.sendNotification).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ title: 'Transaction Confirmed' }),
      );
    });

    it('sets confirmedAt to a recent date', async () => {
      const before = new Date();
      await service.handleConfirmedTransaction(tx, 'wallet-1', 'user-1');
      const after = new Date();

      const created = mockAuditLogRepo.create.mock.calls[0][0] as WalletAuditLog;
      expect(created.confirmedAt!.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(created.confirmedAt!.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('onModuleInit', () => {
    it('subscribes to SSE for each active wallet', async () => {
      const spy = jest.spyOn(service, 'subscribeToAccount').mockImplementation(() => {});
      mockWalletRepo.find.mockResolvedValueOnce([
        { publicKey: 'GAAA', id: 'w1', userId: 'u1' },
        { publicKey: 'GBBB', id: 'w2', userId: 'u2' },
      ]);

      await service.onModuleInit();
      expect(spy).toHaveBeenCalledTimes(2);
      expect(spy).toHaveBeenCalledWith('GAAA', 'w1', 'u1');
      expect(spy).toHaveBeenCalledWith('GBBB', 'w2', 'u2');
    });
  });
});
