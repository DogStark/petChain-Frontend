import { Test, TestingModule } from '@nestjs/testing';
import { VetVerificationService } from './vet-verification.service';

jest.mock('uuid', () => ({
  v4: () => 'test-uuid',
}));

describe('VetVerificationService', () => {
  let service: VetVerificationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [VetVerificationService],
    }).compile();

    service = module.get<VetVerificationService>(VetVerificationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
