import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { Appointment, AppointmentStatus } from './entities/appointment.entity';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { VetClinicsService } from './vet-clinics.service';

@Injectable()
export class AppointmentsService {
  constructor(
    @InjectRepository(Appointment)
    private readonly appointmentRepository: Repository<Appointment>,
    private readonly vetClinicsService: VetClinicsService,
  ) {}

  /**
   * Create a new appointment
   */
  async create(
    createAppointmentDto: CreateAppointmentDto,
  ): Promise<Appointment> {
    // Verify clinic exists
    await this.vetClinicsService.findOne(createAppointmentDto.vetClinicId);

    // Check for conflicts
    const hasConflict = await this.hasSchedulingConflict(
      createAppointmentDto.vetClinicId,
      createAppointmentDto.scheduledDate,
      createAppointmentDto.duration || 30,
    );

    if (hasConflict) {
      throw new BadRequestException(
        'This time slot is already booked. Please choose another time.',
      );
    }

    const appointment = this.appointmentRepository.create({
      ...createAppointmentDto,
      duration: createAppointmentDto.duration || 30,
    });
    return await this.appointmentRepository.save(appointment);
  }

  /**
   * Get all appointments
   */
  async findAll(): Promise<Appointment[]> {
    return await this.appointmentRepository.find({
      relations: ['pet', 'vetClinic', 'reminder'],
      order: { scheduledDate: 'ASC' },
    });
  }

  /**
   * Get appointments by pet
   */
  async findByPet(petId: string): Promise<Appointment[]> {
    return await this.appointmentRepository.find({
      where: { petId },
      relations: ['vetClinic', 'reminder'],
      order: { scheduledDate: 'ASC' },
    });
  }

  /**
   * Get appointments by clinic
   */
  async findByClinic(vetClinicId: string): Promise<Appointment[]> {
    return await this.appointmentRepository.find({
      where: { vetClinicId },
      relations: ['pet', 'reminder'],
      order: { scheduledDate: 'ASC' },
    });
  }

  /**
   * Get appointments for a specific date range
   */
  async findByDateRange(
    startDate: Date,
    endDate: Date,
    vetClinicId?: string,
  ): Promise<Appointment[]> {
    const where: any = {
      scheduledDate: Between(startDate, endDate),
    };

    if (vetClinicId) {
      where.vetClinicId = vetClinicId;
    }

    return await this.appointmentRepository.find({
      where,
      relations: ['pet', 'vetClinic'],
      order: { scheduledDate: 'ASC' },
    });
  }

  /**
   * Get upcoming appointments
   */
  async findUpcoming(petId?: string): Promise<Appointment[]> {
    const now = new Date();
    const where: any = {
      scheduledDate: MoreThanOrEqual(now),
      status: AppointmentStatus.SCHEDULED,
    };

    if (petId) {
      where.petId = petId;
    }

    return await this.appointmentRepository.find({
      where,
      relations: ['pet', 'vetClinic', 'reminder'],
      order: { scheduledDate: 'ASC' },
    });
  }

  /**
   * Get a single appointment
   */
  async findOne(id: string): Promise<Appointment> {
    const appointment = await this.appointmentRepository.findOne({
      where: { id },
      relations: ['pet', 'vetClinic', 'reminder'],
    });
    if (!appointment) {
      throw new NotFoundException(`Appointment with ID ${id} not found`);
    }
    return appointment;
  }

  /**
   * Update an appointment
   */
  async update(
    id: string,
    updateAppointmentDto: UpdateAppointmentDto,
  ): Promise<Appointment> {
    const appointment = await this.findOne(id);

    // If rescheduling, check for conflicts
    if (
      updateAppointmentDto.scheduledDate &&
      updateAppointmentDto.scheduledDate !== appointment.scheduledDate
    ) {
      const hasConflict = await this.hasSchedulingConflict(
        updateAppointmentDto.vetClinicId || appointment.vetClinicId,
        updateAppointmentDto.scheduledDate,
        updateAppointmentDto.duration || appointment.duration || 30,
        id,
      );

      if (hasConflict) {
        throw new BadRequestException(
          'This time slot is already booked. Please choose another time.',
        );
      }
    }

    Object.assign(appointment, updateAppointmentDto);
    return await this.appointmentRepository.save(appointment);
  }

  /**
   * Confirm an appointment
   */
  async confirm(id: string): Promise<Appointment> {
    const appointment = await this.findOne(id);
    appointment.status = AppointmentStatus.CONFIRMED;
    return await this.appointmentRepository.save(appointment);
  }

  /**
   * Complete an appointment
   */
  async complete(id: string): Promise<Appointment> {
    const appointment = await this.findOne(id);
    appointment.status = AppointmentStatus.COMPLETED;
    return await this.appointmentRepository.save(appointment);
  }

  /**
   * Cancel an appointment
   */
  async cancel(id: string): Promise<Appointment> {
    const appointment = await this.findOne(id);
    appointment.status = AppointmentStatus.CANCELLED;
    return await this.appointmentRepository.save(appointment);
  }

  /**
   * Delete an appointment
   */
  async remove(id: string): Promise<void> {
    const appointment = await this.findOne(id);
    await this.appointmentRepository.remove(appointment);
  }

  /**
   * Check for scheduling conflicts
   */
  private async hasSchedulingConflict(
    vetClinicId: string,
    scheduledDate: Date,
    duration: number,
    excludeAppointmentId?: string,
  ): Promise<boolean> {
    const startTime = new Date(scheduledDate);
    const endTime = new Date(startTime.getTime() + duration * 60000);

    const query = this.appointmentRepository
      .createQueryBuilder('appointment')
      .where('appointment.vetClinicId = :vetClinicId', { vetClinicId })
      .andWhere('appointment.status NOT IN (:...excludedStatuses)', {
        excludedStatuses: [AppointmentStatus.CANCELLED],
      })
      .andWhere(
        '(appointment.scheduledDate < :endTime AND ' +
          "(appointment.scheduledDate + (appointment.duration || 30) * INTERVAL '1 minute') > :startTime)",
        { startTime, endTime },
      );

    if (excludeAppointmentId) {
      query.andWhere('appointment.id != :excludeId', {
        excludeId: excludeAppointmentId,
      });
    }

    const count = await query.getCount();
    return count > 0;
  }
}
