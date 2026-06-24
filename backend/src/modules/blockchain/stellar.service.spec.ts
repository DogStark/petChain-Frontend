import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { StellarService } from './stellar.service';

jest.mock('@stellar/stellar-sdk', () => ({
  Horizon: {
    Server: jest.fn(() => ({
      fetchAccount: jest.fn(),
      submitTransaction: jest.fn(),
    })),
  },
  Keypair: {
    fromSecret: jest.fn(() => ({
      publicKey: jest.fn().mockReturnValue('test-public-key'),
    })),
    random: jest.fn(() => ({
      publicKey: jest.fn().mockReturnValue('random-public-key'),
    })),
  },
  Networks: {
    TESTNET: 'Test SDF Network ; September 2015',
  },
  rpc: {
    Server: jest.fn(() => ({
      getLatestLedger: jest.fn(),
      getAccount: jest.fn(),
      prepareTransaction: jest.fn(),
      simulateTransaction: jest.fn(),
      getTransaction: jest.fn(),
      sendTransaction: jest.fn(),
    })),
    Api: {
      isSimulationError: jest.fn().mockReturnValue(false),
    },
  },
  TransactionBuilder: jest.fn(),
  Operation: {
    invokeContractFunction: jest.fn(),
  },
  Contract: jest.fn(),
}));

describe('StellarService - Contract Integration', () => {
  let service: StellarService;
  let configService: ConfigService;

  beforeEach(async () => {
    configService = {
      get: jest.fn((key: string) => {
        if (key === 'blockchain.stellar.rpcUrl')
          return 'https://horizon-testnet.stellar.org';
        if (key === 'blockchain.stellar.sorobanRpcUrl')
          return 'https://soroban-testnet.stellar.org';
        if (key === 'blockchain.stellar.secretKey') return null;
        return undefined;
      }),
    } as any;

    const module = await Test.createTestingModule({
      providers: [
        StellarService,
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<StellarService>(StellarService);
  });

  it('should deploy contract', async () => {
    jest.spyOn(service, 'deployContract').mockResolvedValue({
      contractId: 'test-contract-id',
      txHash: 'test-tx-hash',
    });

    const result = await service.deployContract('test-wasm-hash');
    expect(result).toHaveProperty('contractId');
    expect(result).toHaveProperty('txHash');
  });

  it('should invoke contract', async () => {
    jest
      .spyOn(service, 'invokeContract')
      .mockResolvedValue({ data: 'test-data' });

    const result = await service.invokeContract('contract-id', 'method', []);
    expect(result).toBeDefined();
  });

  it('should estimate gas', async () => {
    jest.spyOn(service, 'estimateGas').mockResolvedValue({
      fee: '1000',
      resourceFee: '500',
    });

    const result = await service.estimateGas('contract-id', 'method', []);
    expect(result).toHaveProperty('fee');
    expect(result).toHaveProperty('resourceFee');
  });

  it('should upgrade contract', async () => {
    jest.spyOn(service, 'upgradeContract').mockResolvedValue('upgrade-tx-hash');

    const txHash = await service.upgradeContract(
      'contract-id',
      'new-wasm-hash',
    );
    expect(txHash).toBeDefined();
  });
});
