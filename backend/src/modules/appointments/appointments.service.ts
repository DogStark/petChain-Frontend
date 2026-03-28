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

    // 🔥 Conflict prevention (generic - no date/time assumption)
    const existing = await this.appointmentRepository.findOne({
      where: {
        vetId: dto.vetId,
        status: AppointmentStatus.SCHEDULED,
      },
    });

    if (existing) {
      throw new BadRequestException(
        'Vet already has a scheduled appointment (basic conflict prevention)',
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
    const now = new Date();

    const query = this.appointmentRepository
      .createQueryBuilder('appointment')
      .where('appointment.createdAt >= :now', { now }) // safe fallback field
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

    // 🔥 Conflict prevention (generic)
    if (dto.vetId) {
      const conflict = await this.appointmentRepository.findOne({
        where: {
          vetId: dto.vetId,
          status: AppointmentStatus.SCHEDULED,
          id: Not(id),
        },
      });

      if (conflict) {
        throw new BadRequestException(
          'Vet already has another scheduled appointment',
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
