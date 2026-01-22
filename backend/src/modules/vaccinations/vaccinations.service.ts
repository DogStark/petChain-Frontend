import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
<<<<<<< HEAD
import { Repository, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { Vaccination } from './entities/vaccination.entity';
import { CreateVaccinationDto } from './dto/create-vaccination.dto';
import { UpdateVaccinationDto } from './dto/update-vaccination.dto';
=======
import { Repository } from 'typeorm';
import { Vaccination } from './entities/vaccination.entity';
import { CreateVaccinationDto } from './dto/create-vaccination.dto';
import { UpdateVaccinationDto } from './dto/update-vaccination.dto';
import { v4 as uuidv4 } from 'uuid';
>>>>>>> 2740dfc9f1ae7475a6ba260b78e15df3336d9c8b

@Injectable()
export class VaccinationsService {
  constructor(
    @InjectRepository(Vaccination)
    private readonly vaccinationRepository: Repository<Vaccination>,
  ) {}

<<<<<<< HEAD
  async create(createVaccinationDto: CreateVaccinationDto): Promise<Vaccination> {
    const vaccination = this.vaccinationRepository.create(createVaccinationDto);
    return await this.vaccinationRepository.save(vaccination);
  }

  async findAll(petId?: string): Promise<Vaccination[]> {
    const where: any = {};
    if (petId) {
      where.petId = petId;
    }

    return await this.vaccinationRepository.find({
      where,
      relations: ['pet', 'vet'],
      order: { dateAdministered: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Vaccination> {
    const vaccination = await this.vaccinationRepository.findOne({
      where: { id },
      relations: ['pet', 'vet'],
    });

    if (!vaccination) {
      throw new NotFoundException(`Vaccination with ID ${id} not found`);
    }

    return vaccination;
  }

=======
  /**
   * Create a new vaccination record
   */
  async create(
    createVaccinationDto: CreateVaccinationDto,
  ): Promise<Vaccination> {
    const vaccination = this.vaccinationRepository.create({
      ...createVaccinationDto,
      certificateCode: this.generateCertificateCode(),
    });
    return await this.vaccinationRepository.save(vaccination);
  }

  /**
   * Get all vaccinations
   */
  async findAll(): Promise<Vaccination[]> {
    return await this.vaccinationRepository.find({
      relations: ['pet', 'vetClinic'],
      order: { administeredDate: 'DESC' },
    });
  }

  /**
   * Get vaccinations by pet ID
   */
  async findByPet(petId: string): Promise<Vaccination[]> {
    return await this.vaccinationRepository.find({
      where: { petId },
      relations: ['vetClinic'],
      order: { administeredDate: 'DESC' },
    });
  }

  /**
   * Get a single vaccination by ID
   */
  async findOne(id: string): Promise<Vaccination> {
    const vaccination = await this.vaccinationRepository.findOne({
      where: { id },
      relations: ['pet', 'vetClinic'],
    });
    if (!vaccination) {
      throw new NotFoundException(`Vaccination with ID ${id} not found`);
    }
    return vaccination;
  }

  /**
   * Find vaccination by certificate code
   */
  async findByCertificateCode(code: string): Promise<Vaccination> {
    const vaccination = await this.vaccinationRepository.findOne({
      where: { certificateCode: code },
      relations: ['pet', 'vetClinic'],
    });
    if (!vaccination) {
      throw new NotFoundException(
        `Vaccination with certificate code ${code} not found`,
      );
    }
    return vaccination;
  }

  /**
   * Update a vaccination
   */
>>>>>>> 2740dfc9f1ae7475a6ba260b78e15df3336d9c8b
  async update(
    id: string,
    updateVaccinationDto: UpdateVaccinationDto,
  ): Promise<Vaccination> {
    const vaccination = await this.findOne(id);
    Object.assign(vaccination, updateVaccinationDto);
    return await this.vaccinationRepository.save(vaccination);
  }

<<<<<<< HEAD
=======
  /**
   * Delete a vaccination
   */
>>>>>>> 2740dfc9f1ae7475a6ba260b78e15df3336d9c8b
  async remove(id: string): Promise<void> {
    const vaccination = await this.findOne(id);
    await this.vaccinationRepository.remove(vaccination);
  }

<<<<<<< HEAD
  async getUpcomingReminders(days: number = 30): Promise<Vaccination[]> {
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + days);

    return await this.vaccinationRepository.find({
      where: {
        nextDueDate: MoreThanOrEqual(today) && LessThanOrEqual(futureDate),
      },
      relations: ['pet', 'vet'],
      order: { nextDueDate: 'ASC' },
    });
  }

  async getOverdueVaccinations(petId?: string): Promise<Vaccination[]> {
    const today = new Date();
    const where: any = {
      nextDueDate: LessThanOrEqual(today),
    };

    if (petId) {
      where.petId = petId;
    }

    return await this.vaccinationRepository.find({
      where,
      relations: ['pet', 'vet'],
      order: { nextDueDate: 'ASC' },
    });
=======
  /**
   * Get vaccination statistics for a pet
   */
  async getVaccinationStats(petId: string): Promise<{
    total: number;
    upToDate: number;
    overdue: number;
    upcoming: number;
  }> {
    const vaccinations = await this.findByPet(petId);
    const now = new Date();

    let upToDate = 0;
    let overdue = 0;
    let upcoming = 0;

    vaccinations.forEach((v) => {
      if (v.nextDueDate) {
        const dueDate = new Date(v.nextDueDate);
        if (dueDate < now) {
          overdue++;
        } else {
          const daysUntilDue = Math.floor(
            (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
          );
          if (daysUntilDue <= 30) {
            upcoming++;
          } else {
            upToDate++;
          }
        }
      } else {
        upToDate++;
      }
    });

    return {
      total: vaccinations.length,
      upToDate,
      overdue,
      upcoming,
    };
  }

  /**
   * Generate a unique certificate code
   */
  private generateCertificateCode(): string {
    const uuid = uuidv4().replace(/-/g, '').substring(0, 12).toUpperCase();
    return `VAX-${uuid}`;
>>>>>>> 2740dfc9f1ae7475a6ba260b78e15df3336d9c8b
  }
}
