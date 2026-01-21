import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VetClinic } from './entities/vet-clinic.entity';
import { CreateVetClinicDto } from './dto/create-vet-clinic.dto';
import { UpdateVetClinicDto } from './dto/update-vet-clinic.dto';

@Injectable()
export class VetClinicsService {
  constructor(
    @InjectRepository(VetClinic)
    private readonly vetClinicRepository: Repository<VetClinic>,
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
