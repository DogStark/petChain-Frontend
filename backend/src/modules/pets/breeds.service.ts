import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Breed } from './entities/breed.entity';
import { CreateBreedDto } from './dto/create-breed.dto';
import { UpdateBreedDto } from './dto/update-breed.dto';
import { PetSpecies } from './entities/pet.entity';

@Injectable()
export class BreedsService {
  constructor(
    @InjectRepository(Breed)
    private readonly breedRepository: Repository<Breed>,
  ) {}

  /**
   * Create a new breed
   */
  async create(createBreedDto: CreateBreedDto): Promise<Breed> {
    const breed = this.breedRepository.create(createBreedDto);
    return await this.breedRepository.save(breed);
  }

  /**
   * Get all breeds
   */
  async findAll(): Promise<Breed[]> {
    return await this.breedRepository.find();
  }

  /**
   * Get breeds by species
   */
  async findBySpecies(species: PetSpecies): Promise<Breed[]> {
    return await this.breedRepository.find({
      where: { species },
    });
  }

  /**
   * Get a single breed by ID with vaccination schedules
   */
  async findOne(id: string): Promise<Breed> {
    const breed = await this.breedRepository.findOne({
      where: { id },
      relations: ['vaccinationSchedules'],
    });
    if (!breed) {
      throw new NotFoundException(`Breed with ID ${id} not found`);
    }
    return breed;
  }

  /**
   * Update a breed
   */
  async update(id: string, updateBreedDto: UpdateBreedDto): Promise<Breed> {
    const breed = await this.findOne(id);
    Object.assign(breed, updateBreedDto);
    return await this.breedRepository.save(breed);
  }

  /**
   * Delete a breed
   */
  async remove(id: string): Promise<void> {
    const breed = await this.findOne(id);
    await this.breedRepository.remove(breed);
  }
}
