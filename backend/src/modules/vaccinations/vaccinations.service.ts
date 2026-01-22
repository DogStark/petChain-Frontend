import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { Vaccination } from './entities/vaccination.entity';
import { CreateVaccinationDto } from './dto/create-vaccination.dto';
import { UpdateVaccinationDto } from './dto/update-vaccination.dto';

@Injectable()
export class VaccinationsService {
  constructor(
    @InjectRepository(Vaccination)
    private readonly vaccinationRepository: Repository<Vaccination>,
  ) {}

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

  async update(
    id: string,
    updateVaccinationDto: UpdateVaccinationDto,
  ): Promise<Vaccination> {
    const vaccination = await this.findOne(id);
    Object.assign(vaccination, updateVaccinationDto);
    return await this.vaccinationRepository.save(vaccination);
  }

  async remove(id: string): Promise<void> {
    const vaccination = await this.findOne(id);
    await this.vaccinationRepository.remove(vaccination);
  }

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
  }
}
