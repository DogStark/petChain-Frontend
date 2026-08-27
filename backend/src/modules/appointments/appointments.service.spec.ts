import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { Appointment, AppointmentStatus } from './entities/appointment.entity';

describe('AppointmentsService', () => {
  let service: AppointmentsService;

  const mockAppointmentRepo = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentsService,
        {
          provide: getRepositoryToken(Appointment),
          useValue: mockAppointmentRepo,
        },
      ],
    }).compile();

    service = module.get<AppointmentsService>(AppointmentsService);

    mockAppointmentRepo.createQueryBuilder.mockImplementation(() => ({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    }));

    jest.clearAllMocks();
  });

  describe('create', () => {
    const dto = {
      petId: 'pet-1',
      vetId: 'vet-1',
      appointmentDate: '2026-07-15',
      appointmentTime: '10:00:00',
      reason: 'Annual checkup',
    };

    it('should create an appointment when no conflict exists', async () => {
      mockAppointmentRepo.findOne.mockResolvedValue(null);
      const created = { id: 'appt-1', ...dto, status: AppointmentStatus.SCHEDULED };
      mockAppointmentRepo.create.mockReturnValue(created);
      mockAppointmentRepo.save.mockResolvedValue(created);

      const result = await service.create(dto);

      expect(mockAppointmentRepo.findOne).toHaveBeenCalledWith({
        where: {
          vetId: dto.vetId,
          appointmentDate: dto.appointmentDate as any,
          appointmentTime: dto.appointmentTime,
          status: AppointmentStatus.SCHEDULED,
        },
      });
      expect(result).toEqual(created);
    });

    it('should throw when same vet has conflicting appointment at same date/time', async () => {
      const existing = { id: 'appt-0', ...dto, status: AppointmentStatus.SCHEDULED };
      mockAppointmentRepo.findOne.mockResolvedValue(existing);

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
      await expect(service.create(dto)).rejects.toThrow(
        'Vet already has a scheduled appointment at this date and time',
      );
    });

    it('should allow creating appointment for same vet on a different date', async () => {
      mockAppointmentRepo.findOne.mockResolvedValue(null);
      const differentDateDto = { ...dto, appointmentDate: '2026-07-16' };
      const created = { id: 'appt-2', ...differentDateDto, status: AppointmentStatus.SCHEDULED };
      mockAppointmentRepo.create.mockReturnValue(created);
      mockAppointmentRepo.save.mockResolvedValue(created);

      const result = await service.create(differentDateDto);

      expect(result).toEqual(created);
    });

    it('should allow creating appointment for same vet on same date but different time', async () => {
      mockAppointmentRepo.findOne.mockResolvedValue(null);
      const differentTimeDto = { ...dto, appointmentTime: '14:00:00' };
      const created = { id: 'appt-3', ...differentTimeDto, status: AppointmentStatus.SCHEDULED };
      mockAppointmentRepo.create.mockReturnValue(created);
      mockAppointmentRepo.save.mockResolvedValue(created);

      const result = await service.create(differentTimeDto);

      expect(result).toEqual(created);
    });

    it('should throw BadRequestException if vetId is missing', async () => {
      await expect(service.create({ ...dto, vetId: '' })).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ---------------- UPCOMING ----------------

  describe('getUpcomingAppointments', () => {
    it('should filter by appointmentDate >= today and SCHEDULED status', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      mockAppointmentRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.getUpcomingAppointments();

      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'appointment.appointmentDate >= :today',
        expect.any(Object),
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'appointment.status = :status',
        { status: AppointmentStatus.SCHEDULED },
      );
    });

    it('should accept optional petId filter', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      mockAppointmentRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.getUpcomingAppointments('pet-1');

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'appointment.petId = :petId',
        { petId: 'pet-1' },
      );
    });
  });

  // ---------------- UPDATE ----------------

  describe('update', () => {
    const existingAppointment = {
      id: 'appt-1',
      petId: 'pet-1',
      vetId: 'vet-1',
      appointmentDate: '2026-07-15',
      appointmentTime: '10:00:00',
      status: AppointmentStatus.SCHEDULED,
    };

    it('should update appointment when no date/time conflict exists', async () => {
      mockAppointmentRepo.findOne
        .mockResolvedValueOnce(existingAppointment)
        .mockResolvedValueOnce(null);
      mockAppointmentRepo.update.mockResolvedValue({});
      const updated = { ...existingAppointment, reason: 'Follow-up' };
      mockAppointmentRepo.findOne.mockResolvedValueOnce(updated);

      const result = await service.update('appt-1', { reason: 'Follow-up' });

      expect(result).toEqual(updated);
    });

    it('should throw when updating to a conflicting date/time', async () => {
      const conflict = {
        id: 'appt-2', vetId: 'vet-2', appointmentDate: '2026-07-15',
        appointmentTime: '10:00:00', status: AppointmentStatus.SCHEDULED,
      };
      mockAppointmentRepo.findOne
        .mockResolvedValueOnce(existingAppointment)
        .mockResolvedValueOnce(conflict);

      await expect(
        service.update('appt-1', { vetId: 'vet-2' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow updating non-conflicting fields', async () => {
      mockAppointmentRepo.findOne
        .mockResolvedValueOnce(existingAppointment)
        .mockResolvedValueOnce(null);
      mockAppointmentRepo.update.mockResolvedValue({});
      const updated = { ...existingAppointment, reason: 'Updated reason' };
      mockAppointmentRepo.findOne.mockResolvedValueOnce(updated);

      const result = await service.update('appt-1', { reason: 'Updated reason' });

      expect(result.reason).toBe('Updated reason');
    });
  });

  // ---------------- FIND ONE ----------------

  describe('findOne', () => {
    it('should return an appointment by id', async () => {
      const appointment = { id: 'appt-1', vetId: 'vet-1' };
      mockAppointmentRepo.findOne.mockResolvedValue(appointment);

      const result = await service.findOne('appt-1');
      expect(result).toEqual(appointment);
    });

    it('should throw NotFoundException if appointment is not found', async () => {
      mockAppointmentRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ---------------- REMOVE ----------------

  describe('remove', () => {
    it('should cancel an appointment', async () => {
      const appointment = { id: 'appt-1', status: AppointmentStatus.SCHEDULED };
      mockAppointmentRepo.findOne.mockResolvedValue(appointment);

      const result = await service.remove('appt-1');

      expect(mockAppointmentRepo.update).toHaveBeenCalledWith('appt-1', {
        status: AppointmentStatus.CANCELLED,
      });
      expect(result).toEqual({ message: 'Appointment cancelled successfully' });
    });

    it('should throw if appointment is already cancelled', async () => {
      const appointment = { id: 'appt-1', status: AppointmentStatus.CANCELLED };
      mockAppointmentRepo.findOne.mockResolvedValue(appointment);

      await expect(service.remove('appt-1')).rejects.toThrow(BadRequestException);
    });
  });
});