import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VetClinic } from './entities/vet-clinic.entity';
import { ClinicSchedule } from './entities/clinic-schedule.entity';
import { CreateVetClinicDto } from './dto/create-vet-clinic.dto';
import { UpdateVetClinicDto } from './dto/update-vet-clinic.dto';
import { CreateScheduleDto } from './dto/create-schedule.dto';

@Injectable()
export class VetClinicsService {
  constructor(
    @InjectRepository(VetClinic)
    private readonly vetClinicRepository: Repository<VetClinic>,
    @InjectRepository(ClinicSchedule)
    private readonly scheduleRepository: Repository<ClinicSchedule>,
  ) {}

  /**
   * Create a new vet clinic
   */
  async create(createVetClinicDto: CreateVetClinicDto): Promise<VetClinic> {
    const clinic = this.vetClinicRepository.create(createVetClinicDto);
    return await this.vetClinicRepository.save(clinic);
  }

  /**
   * Get all vet clinics
   */
  async findAll(): Promise<VetClinic[]> {
    return await this.vetClinicRepository.find({
      where: { isActive: true },
      order: { name: 'ASC' },
    });
  }

  /**
   * Search clinics by city
   */
  async findByCity(city: string): Promise<VetClinic[]> {
    return await this.vetClinicRepository
      .createQueryBuilder('clinic')
      .where('LOWER(clinic.city) LIKE LOWER(:city)', { city: `%${city}%` })
      .andWhere('clinic.isActive = :isActive', { isActive: true })
      .orderBy('clinic.name', 'ASC')
      .getMany();
  }

  /**
   * Get a single vet clinic
   */
  async findOne(id: string): Promise<VetClinic> {
    const clinic = await this.vetClinicRepository.findOne({
      where: { id },
    });
    if (!clinic) {
      throw new NotFoundException(`Vet clinic with ID ${id} not found`);
    }
    return clinic;
  }

  /**
   * Update a vet clinic
   */
  async update(
    id: string,
    updateVetClinicDto: UpdateVetClinicDto,
  ): Promise<VetClinic> {
    const clinic = await this.findOne(id);
    Object.assign(clinic, updateVetClinicDto);
    return await this.vetClinicRepository.save(clinic);
  }

  /**
   * Delete a vet clinic
   */
  async remove(id: string): Promise<void> {
    const clinic = await this.findOne(id);
    await this.vetClinicRepository.remove(clinic);
  }

  // ── Clinic Schedules ──────────────────────────────────────────────────────

  async createSchedule(clinicId: string, dto: CreateScheduleDto): Promise<ClinicSchedule> {
    await this.findOne(clinicId);
    const schedule = this.scheduleRepository.create({ clinicId, ...dto });
    return this.scheduleRepository.save(schedule);
  }

  async updateSchedule(
    clinicId: string,
    scheduleId: string,
    dto: Partial<CreateScheduleDto>,
  ): Promise<ClinicSchedule> {
    const schedule = await this.scheduleRepository.findOne({
      where: { id: scheduleId, clinicId },
    });
    if (!schedule) throw new NotFoundException(`Schedule ${scheduleId} not found`);
    Object.assign(schedule, dto);
    return this.scheduleRepository.save(schedule);
  }

  async removeSchedule(clinicId: string, scheduleId: string): Promise<void> {
    const schedule = await this.scheduleRepository.findOne({
      where: { id: scheduleId, clinicId },
    });
    if (!schedule) throw new NotFoundException(`Schedule ${scheduleId} not found`);
    await this.scheduleRepository.remove(schedule);
  }

  async getScheduleForDay(clinicId: string, dayOfWeek: number): Promise<ClinicSchedule | null> {
    return this.scheduleRepository.findOne({ where: { clinicId, dayOfWeek } });
  }

  /**
   * Generate all available ISO datetime slots for a clinic on a given date.
   * Subtracts already-booked confirmed/scheduled appointments.
   */
  async getAvailableSlots(
    clinicId: string,
    date: string,
    bookedTimes: Date[],
  ): Promise<string[]> {
    const target = new Date(date);
    if (isNaN(target.getTime())) return [];

    const dayOfWeek = target.getDay();
    const schedule = await this.scheduleRepository.findOne({ where: { clinicId, dayOfWeek } });
    if (!schedule) return [];

    const slots: string[] = [];
    const [openH, openM] = schedule.openTime.split(':').map(Number);
    const [closeH, closeM] = schedule.closeTime.split(':').map(Number);
    const openMinutes = openH * 60 + openM;
    const closeMinutes = closeH * 60 + closeM;

    const bookedMinutes = new Set(
      bookedTimes.map((d) => d.getHours() * 60 + d.getMinutes()),
    );

    for (let m = openMinutes; m + schedule.slotDurationMinutes <= closeMinutes; m += schedule.slotDurationMinutes) {
      if (!bookedMinutes.has(m)) {
        const slotDate = new Date(target);
        slotDate.setHours(Math.floor(m / 60), m % 60, 0, 0);
        slots.push(slotDate.toISOString());
      }
    }
    return slots;
  }

  /**
   * Check if clinic is open at a given time
   */
  isOpenAt(clinic: VetClinic, dateTime: Date): boolean {
    if (!clinic.operatingHours) return false;

    const dayNames = [
      'sunday',
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
    ];
    const dayName = dayNames[dateTime.getDay()];
    const hours = clinic.operatingHours[dayName];

    if (!hours) return false;

    const currentTime = dateTime.getHours() * 60 + dateTime.getMinutes();
    const [openHour, openMin] = hours.open.split(':').map(Number);
    const [closeHour, closeMin] = hours.close.split(':').map(Number);
    const openTime = openHour * 60 + openMin;
    const closeTime = closeHour * 60 + closeMin;

    return currentTime >= openTime && currentTime <= closeTime;
  }
}
