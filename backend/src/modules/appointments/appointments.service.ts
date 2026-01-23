import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { Appointment, AppointmentStatus } from './entities/appointment.entity';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';

@Injectable()
export class AppointmentsService {
  constructor(
    @InjectRepository(Appointment)
    private readonly appointmentRepository: Repository<Appointment>,
  ) {}

  async create(
    createAppointmentDto: CreateAppointmentDto,
  ): Promise<Appointment> {
    const appointment =
      this.appointmentRepository.create(createAppointmentDto);
    return await this.appointmentRepository.save(appointment);
  }

  async findAll(
    petId?: string,
    vetId?: string,
    status?: AppointmentStatus,
  ): Promise<Appointment[]> {
    const where: any = {};

    if (petId) {
      where.petId = petId;
    }

    if (vetId) {
      where.vetId = vetId;
    }

    if (status) {
      where.status = status;
    }

    return await this.appointmentRepository.find({
      where,
      relations: ['pet', 'vet'],
      order: { appointmentDate: 'ASC', appointmentTime: 'ASC' },
    });
  }

  async findOne(id: string): Promise<Appointment> {
    const appointment = await this.appointmentRepository.findOne({
      where: { id },
      relations: ['pet', 'vet'],
    });

    if (!appointment) {
      throw new NotFoundException(`Appointment with ID ${id} not found`);
    }

    return appointment;
  }

  async update(
    id: string,
    updateAppointmentDto: UpdateAppointmentDto,
  ): Promise<Appointment> {
    const appointment = await this.findOne(id);
    Object.assign(appointment, updateAppointmentDto);
    return await this.appointmentRepository.save(appointment);
  }

  async remove(id: string): Promise<void> {
    const appointment = await this.findOne(id);
    await this.appointmentRepository.remove(appointment);
  }

  async getUpcomingAppointments(petId?: string): Promise<Appointment[]> {
    const today = new Date();
    const where: any = {
      appointmentDate: MoreThanOrEqual(today),
      status: AppointmentStatus.SCHEDULED,
    };

    if (petId) {
      where.petId = petId;
    }

    return await this.appointmentRepository.find({
      where,
      relations: ['pet', 'vet'],
      order: { appointmentDate: 'ASC', appointmentTime: 'ASC' },
    });
  }
}
