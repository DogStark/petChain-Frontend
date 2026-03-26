import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Allergy, AllergySeverity } from './entities/allergy.entity';
import { CreateAllergyDto } from './dto/create-allergy.dto';
import { UpdateAllergyDto } from './dto/update-allergy.dto';

@Injectable()
export class AllergiesService {
  constructor(
    @InjectRepository(Allergy)
    private readonly allergyRepository: Repository<Allergy>,
  ) {}

  async create(createAllergyDto: CreateAllergyDto): Promise<Allergy> {
    const allergy = this.allergyRepository.create(createAllergyDto);
    return await this.allergyRepository.save(allergy);
  }

  async findAll(petId?: string): Promise<Allergy[]> {
    const where: any = {};
    if (petId) {
      where.petId = petId;
    }

    return await this.allergyRepository.find({
      where,
      relations: ['pet'],
      order: { discoveredDate: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Allergy> {
    const allergy = await this.allergyRepository.findOne({
      where: { id },
      relations: ['pet'],
    });

    if (!allergy) {
      throw new NotFoundException(`Allergy with ID ${id} not found`);
    }

    return allergy;
  }

  async findByPet(petId: string): Promise<Allergy[]> {
    return await this.allergyRepository.find({
      where: { petId },
      relations: ['pet'],
      order: { severity: 'DESC', discoveredDate: 'DESC' },
    });
  }

  async update(
    id: string,
    updateAllergyDto: UpdateAllergyDto,
  ): Promise<Allergy> {
    const allergy = await this.findOne(id);
    Object.assign(allergy, updateAllergyDto);
    return await this.allergyRepository.save(allergy);
  }

  async remove(id: string): Promise<void> {
    const allergy = await this.findOne(id);
    await this.allergyRepository.remove(allergy);
  }

  async findAllergiesWithVetAlert(petId: string): Promise<Allergy[]> {
    return await this.allergyRepository.find({
      where: { petId, alertVeterinarian: true },
      relations: ['pet'],
      order: { severity: 'DESC' },
    });
  }

  async findSevereAllergies(petId: string): Promise<Allergy[]> {
    return await this.allergyRepository.find({
      where: [
        { petId, severity: AllergySeverity.SEVERE },
        { petId, severity: AllergySeverity.LIFE_THREATENING },
      ],
      relations: ['pet'],
      order: { discoveredDate: 'DESC' },
    });
  }

  async getAllergySummary(petId: string): Promise<{
    total: number;
    severe: number;
    withVetAlert: number;
    tested: number;
  }> {
    const allergies = await this.findByPet(petId);

    return {
      total: allergies.length,
      severe: allergies.filter(
        (a) =>
          a.severity === AllergySeverity.SEVERE ||
          a.severity === AllergySeverity.LIFE_THREATENING,
      ).length,
      withVetAlert: allergies.filter((a) => a.alertVeterinarian).length,
      tested: allergies.filter((a) => a.testingResults).length,
    };
  }
}
