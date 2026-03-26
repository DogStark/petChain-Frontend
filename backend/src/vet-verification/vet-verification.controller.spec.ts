import { Test, TestingModule } from '@nestjs/testing';
import { VetVerificationController } from './vet-verification.controller';

describe('VetVerificationController', () => {
  let controller: VetVerificationController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VetVerificationController],
    }).compile();

    controller = module.get<VetVerificationController>(VetVerificationController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
