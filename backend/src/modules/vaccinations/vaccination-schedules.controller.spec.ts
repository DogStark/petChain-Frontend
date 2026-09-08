import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { VaccinationSchedulesController } from './vaccination-schedules.controller';
import { VaccinationSchedulesService } from './vaccination-schedules.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

const mockSchedulesService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findByBreed: jest.fn(),
  findGeneral: jest.fn(),
  seedDefaultDogSchedules: jest.fn(),
  seedDefaultCatSchedules: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
};

describe('VaccinationSchedulesController', () => {
  let controller: VaccinationSchedulesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VaccinationSchedulesController],
      providers: [
        { provide: VaccinationSchedulesService, useValue: mockSchedulesService },
      ],
    }).compile();

    controller = module.get<VaccinationSchedulesController>(
      VaccinationSchedulesController,
    );
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
        getClass: () => VaccinationSchedulesController,
        getHandler: () => controller.findAll,
        getArgs: () => [],
        getArgByIndex: () => null,
      } as unknown as ExecutionContext;

      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('has JwtAuthGuard applied at controller level', () => {
      const guards = Reflect.getMetadata(
        '__guards__',
        VaccinationSchedulesController,
      );
      expect(guards).toBeDefined();
      expect(guards.some((g: unknown) => g === JwtAuthGuard)).toBe(true);
    });
  });
});
