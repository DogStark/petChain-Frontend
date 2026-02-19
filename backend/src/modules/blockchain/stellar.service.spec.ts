import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { StellarService } from './stellar.service';

describe('StellarService - Contract Integration', () => {
  let service: StellarService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        StellarService,
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    service = module.get<StellarService>(StellarService);
  });

  it('should deploy contract', async () => {
    const result = await service.deployContract('test-wasm-hash');
    expect(result).toHaveProperty('contractId');
    expect(result).toHaveProperty('txHash');
  });

  it('should invoke contract', async () => {
    const result = await service.invokeContract('contract-id', 'method', []);
    expect(result).toBeDefined();
  });

  it('should estimate gas', async () => {
    const result = await service.estimateGas('contract-id', 'method', []);
    expect(result).toHaveProperty('fee');
    expect(result).toHaveProperty('resourceFee');
  });

  it('should upgrade contract', async () => {
    const txHash = await service.upgradeContract('contract-id', 'new-wasm-hash');
    expect(txHash).toBeDefined();
  });
});
