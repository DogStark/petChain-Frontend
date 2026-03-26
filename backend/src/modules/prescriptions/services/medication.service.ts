import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Medication, MedicationType } from '../entities/medication.entity';
import { CreateMedicationDto } from '../dto/create-medication.dto';
import { UpdateMedicationDto } from '../dto/update-medication.dto';

@Injectable()
export class MedicationService {
  constructor(
    @InjectRepository(Medication)
    private readonly medicationRepository: Repository<Medication>,
  ) {}

  /**
   * Create a new medication
   */
  async create(createMedicationDto: CreateMedicationDto): Promise<Medication> {
    const medication = this.medicationRepository.create(createMedicationDto);
    return await this.medicationRepository.save(medication);
  }

  /**
   * Get all medications
   */
  async findAll(isActive?: boolean): Promise<Medication[]> {
    const where: any = {};
    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    return await this.medicationRepository.find({
      where,
      order: { name: 'ASC' },
    });
  }

  /**
   * Get medication by ID
   */
  async findOne(id: string): Promise<Medication> {
    const medication = await this.medicationRepository.findOne({
      where: { id },
    });

    if (!medication) {
      throw new NotFoundException(`Medication with ID ${id} not found`);
    }

    return medication;
  }

  /**
   * Find medication by name
   */
  async findByName(name: string): Promise<Medication | null> {
    return await this.medicationRepository.findOne({
      where: { name },
    });
  }

  /**
   * Find medication by generic name
   */
  async findByGenericName(genericName: string): Promise<Medication | null> {
    return await this.medicationRepository.findOne({
      where: { genericName },
    });
  }

  /**
   * Get medications by type
   */
  async findByType(type: MedicationType): Promise<Medication[]> {
    return await this.medicationRepository.find({
      where: { type, isActive: true },
      order: { name: 'ASC' },
    });
  }

  /**
   * Update a medication
   */
  async update(
    id: string,
    updateMedicationDto: UpdateMedicationDto,
  ): Promise<Medication> {
    const medication = await this.findOne(id);
    Object.assign(medication, updateMedicationDto);
    return await this.medicationRepository.save(medication);
  }

  /**
   * Delete a medication
   */
  async remove(id: string): Promise<void> {
    const medication = await this.findOne(id);
    await this.medicationRepository.remove(medication);
  }

  /**
   * Deactivate a medication
   */
  async deactivate(id: string): Promise<Medication> {
    const medication = await this.findOne(id);
    medication.isActive = false;
    return await this.medicationRepository.save(medication);
  }

  /**
   * Activate a medication
   */
  async activate(id: string): Promise<Medication> {
    const medication = await this.findOne(id);
    medication.isActive = true;
    return await this.medicationRepository.save(medication);
  }

  /**
   * Search medications by name or generic name
   */
  async search(query: string): Promise<Medication[]> {
    const lowerQuery = query.toLowerCase();
    return await this.medicationRepository
      .createQueryBuilder('medication')
      .where('LOWER(medication.name) LIKE :query', {
        query: `%${lowerQuery}%`,
      })
      .orWhere('LOWER(medication.genericName) LIKE :query', {
        query: `%${lowerQuery}%`,
      })
      .orWhere('LOWER(medication.brandNames) LIKE :query', {
        query: `%${lowerQuery}%`,
      })
      .where('medication.isActive = :active', { active: true })
      .orderBy('medication.name', 'ASC')
      .getMany();
  }

  /**
   * Get medication by multiple criteria
   */
  async findByCriteria(criteria: Partial<Medication>): Promise<Medication[]> {
    return await this.medicationRepository.find({
      where: criteria,
      order: { name: 'ASC' },
    });
  }

  /**
   * Get all medication types
   */
  getAllMedicationTypes(): MedicationType[] {
    return Object.values(MedicationType);
  }

  /**
   * Count total medications
   */
  async count(isActive?: boolean): Promise<number> {
    const where: any = {};
    if (isActive !== undefined) {
      where.isActive = isActive;
    }
    return await this.medicationRepository.count({ where });
  }
}
