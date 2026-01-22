import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Pet } from './entities/pet.entity';
import { CreatePetDto } from './dto/create-pet.dto';
import { UpdatePetDto } from './dto/update-pet.dto';

@Injectable()
export class PetsService {
  constructor(
    @InjectRepository(Pet)
    private readonly petRepository: Repository<Pet>,
  ) {}

  /**
   * Create a new pet
   */
  async create(createPetDto: CreatePetDto): Promise<Pet> {
    const pet = this.petRepository.create(createPetDto);
    return await this.petRepository.save(pet);
  }

  /**
   * Get all pets
   */
  async findAll(): Promise<Pet[]> {
    return await this.petRepository.find({
      relations: ['breed', 'owner'],
    });
  }

  /**
   * Get pets by owner ID
   */
  async findByOwner(ownerId: string): Promise<Pet[]> {
    return await this.petRepository.find({
      where: { ownerId },
      relations: ['breed'],
    });
  }

  /**
   * Get a single pet by ID
   */
  async findOne(id: string): Promise<Pet> {
    const pet = await this.petRepository.findOne({
      where: { id },
      relations: ['breed', 'owner'],
    });
    if (!pet) {
      throw new NotFoundException(`Pet with ID ${id} not found`);
    }
    return pet;
  }

  /**
   * Update a pet
   */
  async update(id: string, updatePetDto: UpdatePetDto): Promise<Pet> {
    const pet = await this.findOne(id);
    Object.assign(pet, updatePetDto);
    return await this.petRepository.save(pet);
  }

  /**
   * Delete a pet
   */
  async remove(id: string): Promise<void> {
    const pet = await this.findOne(id);
    await this.petRepository.remove(pet);
  }

  /**
   * Calculate pet's age in weeks (for vaccination scheduling)
   */
  calculateAgeInWeeks(dateOfBirth: Date): number {
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - dateOfBirth.getTime());
    const diffWeeks = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7));
    return diffWeeks;
  }
}
