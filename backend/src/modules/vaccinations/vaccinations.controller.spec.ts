import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { VaccinationsController } from './vaccinations.controller';
import { VaccinationsService } from './vaccinations.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

const mockVaccinationsService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findByPet: jest.fn(),
  getVaccinationStats: jest.fn(),
  getUpcomingDueVaccinations: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  addAdverseReactions: jest.fn(),
  remove: jest.fn(),
};

describe('VaccinationsController', () => {
  let controller: VaccinationsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VaccinationsController],
      providers: [
        { provide: VaccinationsService, useValue: mockVaccinationsService },
      ],
    }).compile();

    controller = module.get<VaccinationsController>(VaccinationsController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('JwtAuthGuard enforcement', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const guard = new JwtAuthGuard();
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({ headers: {} }),
          getResponse: () => ({}),
          getNext: () => ({}),
        }),
        getType: () => 'http',
        getClass: () => VaccinationsController,
        getHandler: () => controller.findAll,
        getArgs: () => [],
        getArgByIndex: () => null,
      } as unknown as ExecutionContext;

      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('has JwtAuthGuard applied at controller level', () => {
      const guards = Reflect.getMetadata('__guards__', VaccinationsController);
      expect(guards).toBeDefined();
      expect(guards.some((g: unknown) => g === JwtAuthGuard)).toBe(true);
    });
  });
});
