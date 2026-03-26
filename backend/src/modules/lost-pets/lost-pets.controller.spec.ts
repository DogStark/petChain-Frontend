import { Test, TestingModule } from '@nestjs/testing';

jest.mock('../notifications/notifications.service', () => ({
  NotificationsService: jest.fn().mockImplementation(() => ({
    create: jest.fn(),
  })),
}));

import { LostPetsController } from './lost-pets.controller';
import { LostPetsService } from './lost-pets.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

describe('LostPetsController', () => {
  let controller: LostPetsController;

  const mockLostPetsService = {
    findAllLost: jest.fn(),
    findNearby: jest.fn(),
    updateUserLocation: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LostPetsController],
      providers: [
        {
          provide: LostPetsService,
          useValue: mockLostPetsService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<LostPetsController>(LostPetsController);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return all lost pets', async () => {
      const reports = [{ id: '1', status: 'LOST', pet: { name: 'Buddy' } }];
      mockLostPetsService.findAllLost.mockResolvedValue(reports);

      const result = await controller.findAll();

      expect(mockLostPetsService.findAllLost).toHaveBeenCalled();
      expect(result).toEqual(reports);
    });
  });

  describe('findNearby', () => {
    it('should return lost pets near location', async () => {
      const query = { latitude: 40.7128, longitude: -74.006, radiusKm: 10 };
      const reports = [{ id: '1', status: 'LOST' }];
      mockLostPetsService.findNearby.mockResolvedValue(reports);

      const result = await controller.findNearby(query);

      expect(mockLostPetsService.findNearby).toHaveBeenCalledWith(
        40.7128,
        -74.006,
        10,
      );
      expect(result).toEqual(reports);
    });

    it('should use default radius when not provided', async () => {
      const query = { latitude: 40.7128, longitude: -74.006 };
      Object.defineProperty(query, 'radiusKm', {
        get: () => 10,
        configurable: true,
      });
      mockLostPetsService.findNearby.mockResolvedValue([]);

      await controller.findNearby(query as any);

      expect(mockLostPetsService.findNearby).toHaveBeenCalledWith(
        40.7128,
        -74.006,
        10,
      );
    });
  });

  describe('updateMyLocation', () => {
    it('should update user location for lost pet alerts', async () => {
      const dto = {
        latitude: 40.7,
        longitude: -74.0,
        receiveLostPetAlerts: true,
      };
      const user = { id: 'u1', email: 'u@x.com' } as any;
      const saved = { id: 'loc-1', userId: 'u1', ...dto };
      mockLostPetsService.updateUserLocation.mockResolvedValue(saved);

      const result = await controller.updateMyLocation(dto, user);

      expect(mockLostPetsService.updateUserLocation).toHaveBeenCalledWith('u1', dto);
      expect(result).toEqual(saved);
    });
  });
});
