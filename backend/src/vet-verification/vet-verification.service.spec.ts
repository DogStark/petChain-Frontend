import { Test, TestingModule } from '@nestjs/testing';
import { VetVerificationService } from './vet-verification.service';
import { CacheService } from '../modules/cache/cache.service';

jest.mock('uuid', () => ({
  v4: () => 'test-uuid',
}));

const mockCacheService = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
  del: jest.fn().mockResolvedValue(undefined),
  invalidatePet: jest.fn().mockResolvedValue(undefined),
};

describe('VetVerificationService', () => {
  let service: VetVerificationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VetVerificationService,
        { provide: CacheService, useValue: mockCacheService },
      ],
    }).compile();

    service = module.get<VetVerificationService>(VetVerificationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
