import { Test, TestingModule } from '@nestjs/testing';
import { VetVerificationController } from './vet-verification.controller';
import { VetVerificationService } from './vet-verification.service';

jest.mock('uuid', () => ({
  v4: () => 'test-uuid',
}));

describe('VetVerificationController', () => {
  let controller: VetVerificationController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VetVerificationController],
      providers: [
        {
          provide: VetVerificationService,
          useValue: {
            create: jest.fn(),
            autoVerify: jest.fn(),
            getStatus: jest.fn(),
            manualReview: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<VetVerificationController>(
      VetVerificationController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
