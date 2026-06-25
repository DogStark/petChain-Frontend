import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

jest.mock('../notifications/notifications.service', () => ({
  NotificationsService: jest.fn().mockImplementation(() => ({
    create: jest.fn(),
  })),
}));
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { LostPetsService } from './lost-pets.service';
import {
  LostPetReport,
  LostPetStatus,
} from './entities/lost-pet-report.entity';
import { PetSighting } from './entities/pet-sighting.entity';
import { UserLocation } from '../users/entities/user-location.entity';
import { PetsService } from '../pets/pets.service';
import { QRCodesService } from '../qrcodes/qrcodes.service';
import { NotificationsService } from '../notifications/notifications.service';

// ── Haversine formula (pure calculation) ─────────────────────────────────────
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

describe('Haversine formula', () => {
  it('returns ~0 for identical coordinates', () => {
    expect(haversineKm(51.5, -0.1, 51.5, -0.1)).toBeCloseTo(0, 5);
  });

  it('calculates London → Paris as ~341km', () => {
    const d = haversineKm(51.5074, -0.1278, 48.8566, 2.3522);
    expect(d).toBeGreaterThan(330);
    expect(d).toBeLessThan(350);
  });

  it('distinguishes nearby vs far points relative to 10km radius', () => {
    expect(haversineKm(40.0, -74.0, 40.009, -74.0)).toBeLessThan(10);
    expect(haversineKm(40.0, -74.0, 40.45, -74.0)).toBeGreaterThan(10);
  });
});

describe('LostPetsService', () => {
  let service: LostPetsService;

  const mockLostPetReportRepo = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockSightingRepo = {
    create: jest.fn().mockReturnValue({ id: 'sighting-1' }),
    save: jest.fn().mockResolvedValue({ id: 'sighting-1' }),
  };

  const mockUserLocationRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockPetsService = {
    verifyOwnership: jest.fn(),
    findOne: jest.fn(),
  };

  const mockQRCodesService = {
    findByPetId: jest.fn(),
    update: jest.fn(),
  };

  const mockNotificationsService = {
    create: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LostPetsService,
        {
          provide: getRepositoryToken(LostPetReport),
          useValue: mockLostPetReportRepo,
        },
        {
          provide: getRepositoryToken(PetSighting),
          useValue: mockSightingRepo,
        },
        {
          provide: getRepositoryToken(UserLocation),
          useValue: mockUserLocationRepo,
        },
        { provide: PetsService, useValue: mockPetsService },
        { provide: QRCodesService, useValue: mockQRCodesService },
        { provide: NotificationsService, useValue: mockNotificationsService },
      ],
    }).compile();

    service = module.get<LostPetsService>(LostPetsService);
    jest.clearAllMocks();
  });

  describe('reportLost', () => {
    const petId = 'pet-1';
    const ownerId = 'owner-1';
    const dto = {
      customMessage: 'Please help find my dog!',
      lastSeenLatitude: 40.7128,
      lastSeenLongitude: -74.006,
      contactInfo: '555-1234',
    };

    it('should create lost report and update QR code', async () => {
      mockPetsService.verifyOwnership.mockResolvedValue(true);
      mockLostPetReportRepo.findOne.mockResolvedValue(null);
      const created = {
        id: 'report-1',
        petId,
        status: LostPetStatus.LOST,
        ...dto,
      };
      mockLostPetReportRepo.create.mockReturnValue(created);
      mockLostPetReportRepo.save.mockResolvedValue(created);
      mockQRCodesService.findByPetId.mockResolvedValue([
        { qrCodeId: 'qr-1', isActive: true },
      ]);
      mockPetsService.findOne.mockResolvedValue({ id: petId, name: 'Buddy' });
      mockUserLocationRepo.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      });
      mockLostPetReportRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(created);

      const result = await service.reportLost(petId, ownerId, dto);

      expect(mockPetsService.verifyOwnership).toHaveBeenCalledWith(
        petId,
        ownerId,
      );
      expect(mockLostPetReportRepo.create).toHaveBeenCalled();
      expect(mockLostPetReportRepo.save).toHaveBeenCalled();
      expect(mockQRCodesService.update).toHaveBeenCalled();
      expect(result.status).toBe(LostPetStatus.LOST);
    });

    it('should throw when pet already reported as lost', async () => {
      mockPetsService.verifyOwnership.mockResolvedValue(true);
      mockLostPetReportRepo.findOne.mockResolvedValue({
        id: 'existing',
        status: LostPetStatus.LOST,
      });

      await expect(service.reportLost(petId, ownerId, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw when not owner', async () => {
      mockPetsService.verifyOwnership.mockResolvedValue(false);

      await expect(service.reportLost(petId, ownerId, dto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('reportFound', () => {
    const petId = 'pet-1';
    const ownerId = 'owner-1';
    const dto = {
      foundLocation: 'Central Park',
      foundDetails: 'Near fountain',
    };

    it('should update report to found and clear QR message', async () => {
      const existing = {
        id: 'report-1',
        petId,
        status: LostPetStatus.LOST,
        save: jest.fn(),
      };
      mockPetsService.verifyOwnership.mockResolvedValue(true);
      mockLostPetReportRepo.findOne.mockResolvedValue(existing);
      mockLostPetReportRepo.save.mockResolvedValue({
        ...existing,
        status: LostPetStatus.FOUND,
      });
      mockQRCodesService.findByPetId.mockResolvedValue([
        { qrCodeId: 'qr-1', isActive: true },
      ]);
      mockLostPetReportRepo.findOne
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce({ ...existing, status: LostPetStatus.FOUND });

      const result = await service.reportFound(petId, ownerId, dto);

      expect(existing.status).toBe(LostPetStatus.FOUND);
      expect(mockQRCodesService.update).toHaveBeenCalled();
      expect(result.status).toBe(LostPetStatus.FOUND);
    });

    it('should throw when no active lost report', async () => {
      mockPetsService.verifyOwnership.mockResolvedValue(true);
      mockLostPetReportRepo.findOne.mockResolvedValue(null);

      await expect(service.reportFound(petId, ownerId, dto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateLostMessage', () => {
    const petId = 'pet-1';
    const ownerId = 'owner-1';
    const dto = { customMessage: 'Updated message' };

    it('should update message and QR code', async () => {
      const existing = {
        id: 'report-1',
        petId,
        status: LostPetStatus.LOST,
        customMessage: 'Old',
      };
      mockPetsService.verifyOwnership.mockResolvedValue(true);
      mockLostPetReportRepo.findOne.mockResolvedValue(existing);
      mockLostPetReportRepo.save.mockResolvedValue({ ...existing, ...dto });
      mockQRCodesService.findByPetId.mockResolvedValue([
        { qrCodeId: 'qr-1', isActive: true },
      ]);

      const result = await service.updateLostMessage(petId, ownerId, dto);

      expect(mockQRCodesService.update).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('findAllLost', () => {
    it('should return all lost reports', async () => {
      const reports = [{ id: '1', status: LostPetStatus.LOST }];
      mockLostPetReportRepo.find.mockResolvedValue(reports);

      const result = await service.findAllLost();

      expect(mockLostPetReportRepo.find).toHaveBeenCalledWith({
        where: { status: LostPetStatus.LOST },
        relations: expect.any(Array),
        order: { reportedDate: 'DESC' },
      });
      expect(result).toEqual(reports);
    });
  });

  describe('findNearby', () => {
    it('should return lost pets within radius', async () => {
      const mockQb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([{ id: '1' }]),
      };
      mockLostPetReportRepo.createQueryBuilder.mockReturnValue(mockQb);

      const result = await service.findNearby(40.7128, -74.006, 10);

      expect(mockLostPetReportRepo.createQueryBuilder).toHaveBeenCalledWith(
        'report',
      );
      expect(result).toHaveLength(1);
    });
  });

  describe('getReportByPetId', () => {
    it('should return report when exists', async () => {
      const report = { id: '1', petId: 'pet-1', status: LostPetStatus.LOST };
      mockLostPetReportRepo.findOne.mockResolvedValue(report);

      const result = await service.getReportByPetId('pet-1');

      expect(mockLostPetReportRepo.findOne).toHaveBeenCalledWith({
        where: { petId: 'pet-1', status: LostPetStatus.LOST },
        relations: expect.any(Array),
      });
      expect(result).toEqual(report);
    });

    it('should return null when no report', async () => {
      mockLostPetReportRepo.findOne.mockResolvedValue(null);

      const result = await service.getReportByPetId('pet-1');

      expect(result).toBeNull();
    });
  });

  describe('updateUserLocation', () => {
    it('should create new user location when none exists', async () => {
      const dto = {
        latitude: 40.7,
        longitude: -74.0,
        receiveLostPetAlerts: true,
      };
      const created = { id: 'loc-1', userId: 'u1', ...dto };
      mockUserLocationRepo.findOne.mockResolvedValue(null);
      mockUserLocationRepo.create.mockReturnValue(created);
      mockUserLocationRepo.save.mockResolvedValue(created);

      const result = await service.updateUserLocation('u1', dto);

      expect(mockUserLocationRepo.findOne).toHaveBeenCalledWith({
        where: { userId: 'u1' },
      });
      expect(mockUserLocationRepo.create).toHaveBeenCalledWith({
        userId: 'u1',
        latitude: dto.latitude,
        longitude: dto.longitude,
        receiveLostPetAlerts: true,
      });
      expect(mockUserLocationRepo.save).toHaveBeenCalled();
      expect(result).toEqual(created);
    });

    it('should update existing user location', async () => {
      const dto = { latitude: 40.8, longitude: -74.1 };
      const existing = {
        id: 'loc-1',
        userId: 'u1',
        latitude: 40.7,
        longitude: -74.0,
        receiveLostPetAlerts: true,
      };
      mockUserLocationRepo.findOne.mockResolvedValue(existing);
      mockUserLocationRepo.save.mockImplementation((x) => Promise.resolve(x));

      const result = await service.updateUserLocation('u1', dto);

      expect(mockUserLocationRepo.findOne).toHaveBeenCalledWith({
        where: { userId: 'u1' },
      });
      expect(mockUserLocationRepo.save).toHaveBeenCalled();
      expect(result.latitude).toBe(40.8);
      expect(result.longitude).toBe(-74.1);
    });
  });

  describe('createSighting', () => {
    const reportWithPet = {
      id: 'report-1',
      pet: { id: 'pet-1', name: 'Buddy', ownerId: 'owner-1' },
    };

    it('persists sighting with correct fields', async () => {
      mockLostPetReportRepo.findOne.mockResolvedValue(reportWithPet);
      mockNotificationsService.create.mockResolvedValue({});

      await service.createSighting('report-1', 'user-99', {
        lat: 40.1,
        lng: -74.1,
        description: 'Near the park',
      });

      expect(mockSightingRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          lostPetReportId: 'report-1',
          reportedByUserId: 'user-99',
          lat: 40.1,
          lng: -74.1,
          description: 'Near the park',
        }),
      );
      expect(mockSightingRepo.save).toHaveBeenCalled();
    });

    it('notifies pet owner after sighting is saved', async () => {
      mockLostPetReportRepo.findOne.mockResolvedValue(reportWithPet);
      mockNotificationsService.create.mockResolvedValue({});

      await service.createSighting('report-1', 'user-99', { lat: 40.1, lng: -74.1 });

      expect(mockNotificationsService.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'owner-1' }),
      );
    });

    it('throws NotFoundException when report does not exist', async () => {
      mockLostPetReportRepo.findOne.mockResolvedValue(null);

      await expect(
        service.createSighting('bad-id', 'user-99', { lat: 0, lng: 0 }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
