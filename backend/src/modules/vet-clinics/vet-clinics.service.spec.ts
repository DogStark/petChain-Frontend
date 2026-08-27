import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { VetClinicsService } from './vet-clinics.service';
import { VetClinic } from './entities/vet-clinic.entity';
import { ClinicSchedule } from './entities/clinic-schedule.entity';

const mockClinicRepo = {
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  remove: jest.fn(),
  createQueryBuilder: jest.fn(),
};

const mockScheduleRepo = {
  findOne: jest.fn(),
  create: jest.fn().mockImplementation((d) => d),
  save: jest.fn().mockImplementation((d) => Promise.resolve({ id: 'sched-1', ...d })),
  remove: jest.fn().mockResolvedValue(undefined),
  find: jest.fn(),
};

describe('VetClinicsService – slot generation', () => {
  let service: VetClinicsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VetClinicsService,
        { provide: getRepositoryToken(VetClinic), useValue: mockClinicRepo },
        { provide: getRepositoryToken(ClinicSchedule), useValue: mockScheduleRepo },
      ],
    }).compile();

    service = module.get<VetClinicsService>(VetClinicsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('getAvailableSlots', () => {
    const scheduleFor = (open: string, close: string, slot = 30): ClinicSchedule =>
      ({ openTime: open, closeTime: close, slotDurationMinutes: slot }) as ClinicSchedule;

    it('returns all slots when nothing is booked', async () => {
      mockScheduleRepo.findOne.mockResolvedValue(scheduleFor('08:00', '10:00', 60));

      const slots = await service.getAvailableSlots('clinic-1', '2025-07-01', []);
      expect(slots).toHaveLength(2);
      expect(slots[0]).toContain('T08:00');
      expect(slots[1]).toContain('T09:00');
    });

    it('excludes already-booked slots', async () => {
      mockScheduleRepo.findOne.mockResolvedValue(scheduleFor('08:00', '10:00', 60));

      const booked = new Date('2025-07-01T08:00:00');
      const slots = await service.getAvailableSlots('clinic-1', '2025-07-01', [booked]);
      expect(slots).toHaveLength(1);
      expect(slots[0]).toContain('T09:00');
    });

    it('returns empty array when clinic has no schedule for that day', async () => {
      mockScheduleRepo.findOne.mockResolvedValue(null);

      const slots = await service.getAvailableSlots('clinic-1', '2025-07-01', []);
      expect(slots).toHaveLength(0);
    });

    it('returns empty array for invalid date string', async () => {
      const slots = await service.getAvailableSlots('clinic-1', 'not-a-date', []);
      expect(slots).toHaveLength(0);
    });

    it('generates correct number of 30-min slots for 2-hour window', async () => {
      mockScheduleRepo.findOne.mockResolvedValue(scheduleFor('09:00', '11:00', 30));

      const slots = await service.getAvailableSlots('clinic-1', '2025-07-01', []);
      expect(slots).toHaveLength(4); // 09:00, 09:30, 10:00, 10:30
    });
  });

  describe('createSchedule', () => {
    it('persists schedule with clinicId', async () => {
      mockClinicRepo.findOne.mockResolvedValue({ id: 'clinic-1' });

      const result = await service.createSchedule('clinic-1', {
        dayOfWeek: 1,
        openTime: '08:00',
        closeTime: '18:00',
        slotDurationMinutes: 30,
      });

      expect(mockScheduleRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ clinicId: 'clinic-1', dayOfWeek: 1 }),
      );
      expect(result).toMatchObject({ clinicId: 'clinic-1' });
    });

    it('throws NotFoundException for unknown clinic', async () => {
      mockClinicRepo.findOne.mockResolvedValue(null);

      await expect(
        service.createSchedule('bad-clinic', {
          dayOfWeek: 1,
          openTime: '08:00',
          closeTime: '18:00',
          slotDurationMinutes: 30,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeSchedule', () => {
    it('removes an existing schedule', async () => {
      mockScheduleRepo.findOne.mockResolvedValue({ id: 'sched-1', clinicId: 'clinic-1' });

      await service.removeSchedule('clinic-1', 'sched-1');
      expect(mockScheduleRepo.remove).toHaveBeenCalled();
    });

    it('throws NotFoundException for unknown schedule', async () => {
      mockScheduleRepo.findOne.mockResolvedValue(null);

      await expect(service.removeSchedule('clinic-1', 'bad')).rejects.toThrow(NotFoundException);
    });
  });
});
