import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Allergy } from './entities/allergy.entity';
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
}
