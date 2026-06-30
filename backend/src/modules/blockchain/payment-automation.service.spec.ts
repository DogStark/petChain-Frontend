import { Test, TestingModule } from '@nestjs/testing';
import { PaymentAutomationService } from './payment-automation.service';
import { StellarService } from './stellar.service';
import { ContractManagementService } from './contract-management.service';

describe('PaymentAutomationService', () => {
  let service: PaymentAutomationService;
  let stellarService: StellarService;
  let contractManagementService: ContractManagementService;

  const mockStellarService = {
    invokeContract: jest.fn(),
  };

  const mockContractManagementService = {
    getContractId: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentAutomationService,
        {
          provide: StellarService,
          useValue: mockStellarService,
        },
        {
          provide: ContractManagementService,
          useValue: mockContractManagementService,
        },
      ],
    }).compile();

    service = module.get<PaymentAutomationService>(PaymentAutomationService);
    stellarService = module.get<StellarService>(StellarService);
    contractManagementService = module.get<ContractManagementService>(
      ContractManagementService,
    );

    jest.clearAllMocks();
  });

  describe('processAutomatedPayment - contract interaction', () => {
    it('should fetch token contract ID if not provided', async () => {
      const contractId = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4';
      mockContractManagementService.getContractId.mockResolvedValue(contractId);

      try {
        await service.processAutomatedPayment(
          'from-address',
          'to-address',
          500n,
        );
      } catch {
        // Expected to fail on address parsing
      }

      expect(mockContractManagementService.getContractId).toHaveBeenCalledWith('Token');
    });

    it('should throw if token contract not found', async () => {
      mockContractManagementService.getContractId.mockResolvedValue(null);

      await expect(
        service.processAutomatedPayment(
          'from-address',
          'to-address',
          100n,
        ),
      ).rejects.toThrow('Token contract not found');
    });
  });

  describe('checkBalance - contract interaction', () => {
    it('should fetch token contract ID for balance if not provided', async () => {
      const contractId = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4';
      mockContractManagementService.getContractId.mockResolvedValue(contractId);

      try {
        await service.checkBalance('account-address');
      } catch {
        // Expected to fail on address parsing
      }

      expect(mockContractManagementService.getContractId).toHaveBeenCalledWith('Token');
    });

    it('should throw if contract not found for balance check', async () => {
      mockContractManagementService.getContractId.mockResolvedValue(null);

      await expect(
        service.checkBalance('account-address'),
      ).rejects.toThrow('Token contract not found');
    });
  });

  describe('authorizeOperator - contract interaction', () => {
    it('should throw if contract not found for authorization', async () => {
      mockContractManagementService.getContractId.mockResolvedValue(null);

      await expect(
        service.authorizeOperator('operator-address'),
      ).rejects.toThrow('Token contract not found');
    });

    it('should fetch token contract ID for authorization if not provided', async () => {
      const contractId = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4';
      mockContractManagementService.getContractId.mockResolvedValue(contractId);

      try {
        await service.authorizeOperator('operator-address');
      } catch {
        // Expected to fail on address parsing - tested for contract ID fetch
      }

      expect(mockContractManagementService.getContractId).toHaveBeenCalledWith('Token');
    });
  });
});
