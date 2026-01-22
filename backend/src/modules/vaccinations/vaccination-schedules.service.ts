import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { VaccinationSchedule } from './entities/vaccination-schedule.entity';
import { CreateVaccinationScheduleDto } from './dto/create-vaccination-schedule.dto';
import { UpdateVaccinationScheduleDto } from './dto/update-vaccination-schedule.dto';

@Injectable()
export class VaccinationSchedulesService {
  constructor(
    @InjectRepository(VaccinationSchedule)
    private readonly scheduleRepository: Repository<VaccinationSchedule>,
  ) {}

  /**
   * Create a new vaccination schedule
   */
  async create(
    createScheduleDto: CreateVaccinationScheduleDto,
  ): Promise<VaccinationSchedule> {
    const schedule = this.scheduleRepository.create(createScheduleDto);
    return await this.scheduleRepository.save(schedule);
  }

  /**
   * Get all vaccination schedules
   */
  async findAll(): Promise<VaccinationSchedule[]> {
    return await this.scheduleRepository.find({
      where: { isActive: true },
      order: { priority: 'DESC', recommendedAgeWeeks: 'ASC' },
    });
  }

  /**
   * Get vaccination schedules by breed
   */
  async findByBreed(breedId: string): Promise<VaccinationSchedule[]> {
    // Get breed-specific schedules and general schedules (breedId is null)
    return await this.scheduleRepository
      .createQueryBuilder('schedule')
      .where('schedule.breedId = :breedId OR schedule.breedId IS NULL', {
        breedId,
      })
      .andWhere('schedule.isActive = :isActive', { isActive: true })
      .orderBy('schedule.priority', 'DESC')
      .addOrderBy('schedule.recommendedAgeWeeks', 'ASC')
      .getMany();
  }

  /**
   * Get general schedules (not breed-specific)
   */
  async findGeneral(): Promise<VaccinationSchedule[]> {
    return await this.scheduleRepository
      .createQueryBuilder('schedule')
      .where('schedule.breedId IS NULL')
      .andWhere('schedule.isActive = :isActive', { isActive: true })
      .orderBy('schedule.priority', 'DESC')
      .addOrderBy('schedule.recommendedAgeWeeks', 'ASC')
      .getMany();
  }

  /**
   * Get a single schedule by ID
   */
  async findOne(id: string): Promise<VaccinationSchedule> {
    const schedule = await this.scheduleRepository.findOne({
      where: { id },
      relations: ['breed'],
    });
    if (!schedule) {
      throw new NotFoundException(
        `Vaccination schedule with ID ${id} not found`,
      );
    }
    return schedule;
  }

  /**
   * Update a vaccination schedule
   */
  async update(
    id: string,
    updateScheduleDto: UpdateVaccinationScheduleDto,
  ): Promise<VaccinationSchedule> {
    const schedule = await this.findOne(id);
    Object.assign(schedule, updateScheduleDto);
    return await this.scheduleRepository.save(schedule);
  }

  /**
   * Delete a vaccination schedule
   */
  async remove(id: string): Promise<void> {
    const schedule = await this.findOne(id);
    await this.scheduleRepository.remove(schedule);
  }

  /**
   * Seed default vaccination schedules for dogs
   */
  async seedDefaultDogSchedules(): Promise<VaccinationSchedule[]> {
    const defaultSchedules = [
      {
        vaccineName: 'Rabies',
        description:
          'Required by law in most areas. Protects against rabies virus.',
        recommendedAgeWeeks: 12,
        intervalWeeks: 52, // Annual
        dosesRequired: 1,
        isRequired: true,
        priority: 10,
      },
      {
        vaccineName: 'DHPP (Distemper, Hepatitis, Parvovirus, Parainfluenza)',
        description:
          'Core combination vaccine protecting against multiple diseases.',
        recommendedAgeWeeks: 6,
        intervalWeeks: 156, // Every 3 years after initial series
        dosesRequired: 3,
        isRequired: true,
        priority: 9,
      },
      {
        vaccineName: 'Bordetella (Kennel Cough)',
        description:
          'Recommended for dogs that visit boarding facilities or dog parks.',
        recommendedAgeWeeks: 8,
        intervalWeeks: 52,
        dosesRequired: 1,
        isRequired: false,
        priority: 7,
      },
      {
        vaccineName: 'Leptospirosis',
        description:
          'Protects against bacterial infection spread through water and soil.',
        recommendedAgeWeeks: 12,
        intervalWeeks: 52,
        dosesRequired: 2,
        isRequired: false,
        priority: 6,
      },
      {
        vaccineName: 'Lyme Disease',
        description: 'Recommended in areas with high tick populations.',
        recommendedAgeWeeks: 12,
        intervalWeeks: 52,
        dosesRequired: 2,
        isRequired: false,
        priority: 5,
      },
    ];

    const schedules: VaccinationSchedule[] = [];
    for (const scheduleData of defaultSchedules) {
      // Check if already exists
      const existing = await this.scheduleRepository
        .createQueryBuilder('schedule')
        .where('schedule.vaccineName = :vaccineName', {
          vaccineName: scheduleData.vaccineName,
        })
        .andWhere('schedule.breedId IS NULL')
        .getOne();
      if (!existing) {
        const schedule = this.scheduleRepository.create(scheduleData);
        schedules.push(await this.scheduleRepository.save(schedule));
      }
    }
    return schedules;
  }

  /**
   * Seed default vaccination schedules for cats
   */
  async seedDefaultCatSchedules(): Promise<VaccinationSchedule[]> {
    const defaultSchedules = [
      {
        vaccineName: 'Rabies',
        description:
          'Required by law in most areas. Protects against rabies virus.',
        recommendedAgeWeeks: 12,
        intervalWeeks: 52,
        dosesRequired: 1,
        isRequired: true,
        priority: 10,
      },
      {
        vaccineName:
          'FVRCP (Feline Viral Rhinotracheitis, Calicivirus, Panleukopenia)',
        description: 'Core combination vaccine for cats.',
        recommendedAgeWeeks: 6,
        intervalWeeks: 156,
        dosesRequired: 3,
        isRequired: true,
        priority: 9,
      },
      {
        vaccineName: 'FeLV (Feline Leukemia Virus)',
        description:
          'Recommended for outdoor cats or cats exposed to other cats.',
        recommendedAgeWeeks: 8,
        intervalWeeks: 52,
        dosesRequired: 2,
        isRequired: false,
        priority: 7,
      },
    ];

    const schedules: VaccinationSchedule[] = [];
    for (const scheduleData of defaultSchedules) {
      const existing = await this.scheduleRepository
        .createQueryBuilder('schedule')
        .where('schedule.vaccineName = :vaccineName', {
          vaccineName: scheduleData.vaccineName,
        })
        .andWhere('schedule.breedId IS NULL')
        .getOne();
      if (!existing) {
        const schedule = this.scheduleRepository.create(scheduleData);
        schedules.push(await this.scheduleRepository.save(schedule));
      }
    }
    return schedules;
  }
}
