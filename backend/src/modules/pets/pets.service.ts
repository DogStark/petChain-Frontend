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

<<<<<<< HEAD
=======
  /**
   * Create a new pet
   */
>>>>>>> 2740dfc9f1ae7475a6ba260b78e15df3336d9c8b
  async create(createPetDto: CreatePetDto): Promise<Pet> {
    const pet = this.petRepository.create(createPetDto);
    return await this.petRepository.save(pet);
  }

<<<<<<< HEAD
  async findAll(ownerId?: string): Promise<Pet[]> {
    if (ownerId) {
      return await this.petRepository.find({ where: { ownerId } });
    }
    return await this.petRepository.find();
  }

  async findOne(id: string): Promise<Pet> {
    const pet = await this.petRepository.findOne({ where: { id } });
=======
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
>>>>>>> 2740dfc9f1ae7475a6ba260b78e15df3336d9c8b
    if (!pet) {
      throw new NotFoundException(`Pet with ID ${id} not found`);
    }
    return pet;
  }

<<<<<<< HEAD
=======
  /**
   * Update a pet
   */
>>>>>>> 2740dfc9f1ae7475a6ba260b78e15df3336d9c8b
  async update(id: string, updatePetDto: UpdatePetDto): Promise<Pet> {
    const pet = await this.findOne(id);
    Object.assign(pet, updatePetDto);
    return await this.petRepository.save(pet);
  }

<<<<<<< HEAD
=======
  /**
   * Delete a pet
   */
>>>>>>> 2740dfc9f1ae7475a6ba260b78e15df3336d9c8b
  async remove(id: string): Promise<void> {
    const pet = await this.findOne(id);
    await this.petRepository.remove(pet);
  }

<<<<<<< HEAD
  async verifyOwnership(petId: string, ownerId: string): Promise<boolean> {
    const pet = await this.petRepository.findOne({
      where: { id: petId, ownerId },
    });
    return !!pet;
=======
  /**
   * Calculate pet's age in weeks (for vaccination scheduling)
   */
  calculateAgeInWeeks(dateOfBirth: Date): number {
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - dateOfBirth.getTime());
    const diffWeeks = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7));
    return diffWeeks;
>>>>>>> 2740dfc9f1ae7475a6ba260b78e15df3336d9c8b
  }
}
