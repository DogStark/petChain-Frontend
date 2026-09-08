import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';

import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { Appointment, AppointmentStatus } from './entities/appointment.entity';

@Injectable()
export class AppointmentsService {
  constructor(
    @InjectRepository(Appointment)
    private readonly appointmentRepository: Repository<Appointment>,
  ) {}

  // ---------------- CREATE ----------------
  async create(dto: CreateAppointmentDto) {
    // Basic validation
    if (!dto.vetId) {
      throw new BadRequestException('Invalid appointment data');
    }

    // Conflict prevention — check for overlapping date/time with the same vet
    const existing = await this.appointmentRepository.findOne({
      where: {
        vetId: dto.vetId,
        appointmentDate: dto.appointmentDate as any,
        appointmentTime: dto.appointmentTime,
        status: AppointmentStatus.SCHEDULED,
      },
    });

    if (existing) {
      throw new BadRequestException(
        'Vet already has a scheduled appointment at this date and time',
      );
    }

    const appointment = this.appointmentRepository.create({
      ...dto,
      status: AppointmentStatus.SCHEDULED,
    });

    return this.appointmentRepository.save(appointment);
  }

  // ---------------- FIND ALL ----------------
  async findAll(petId?: string, vetId?: string, status?: AppointmentStatus) {
    const query = this.appointmentRepository.createQueryBuilder('appointment');

    if (petId) {
      query.andWhere('appointment.petId = :petId', { petId });
    }

    if (vetId) {
      query.andWhere('appointment.vetId = :vetId', { vetId });
    }

    if (status) {
      query.andWhere('appointment.status = :status', { status });
    }

    return query.getMany();
  }

  // ---------------- FIND ONE ----------------
  async findOne(id: string) {
    const appointment = await this.appointmentRepository.findOne({
      where: { id },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    return appointment;
  }

  // ---------------- UPCOMING ----------------
  async getUpcomingAppointments(petId?: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const query = this.appointmentRepository
      .createQueryBuilder('appointment')
      .where('appointment.appointmentDate >= :today', { today })
      .andWhere('appointment.status = :status', {
        status: AppointmentStatus.SCHEDULED,
      });

    if (petId) {
      query.andWhere('appointment.petId = :petId', { petId });
    }

    return query.getMany();
  }

  // ---------------- UPDATE ----------------
  async update(id: string, dto: UpdateAppointmentDto) {
    const existingAppointment = await this.findOne(id);

    // Conflict prevention — check for overlapping date/time with the same vet
    const vetId = (dto as any).vetId ?? existingAppointment.vetId;
    const appointmentDate = (dto as any).appointmentDate ?? existingAppointment.appointmentDate;
    const appointmentTime = (dto as any).appointmentTime ?? existingAppointment.appointmentTime;

    if (vetId) {
      const conflict = await this.appointmentRepository.findOne({
        where: {
          vetId,
          appointmentDate: appointmentDate as any,
          appointmentTime,
          status: AppointmentStatus.SCHEDULED,
          id: Not(id),
        },
      });

      if (conflict) {
        throw new BadRequestException(
          'Vet already has another scheduled appointment at this date and time',
        );
      }
    }

    await this.appointmentRepository.update(id, dto);
    return this.findOne(id);
  }

  // ---------------- CANCEL ----------------
  async remove(id: string) {
    const appointment = await this.findOne(id);

    if (appointment.status === AppointmentStatus.CANCELLED) {
      throw new BadRequestException('Appointment already cancelled');
    }

    await this.appointmentRepository.update(id, {
      status: AppointmentStatus.CANCELLED,
    });

    return { message: 'Appointment cancelled successfully' };
  }
}
