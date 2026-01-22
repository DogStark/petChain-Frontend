import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Pet } from './entities/pet.entity';
import { CreatePetDto } from './dto/create-pet.dto';
import { UpdatePetDto } from './dto/update-pet.dto';
import { PetSpecies } from './entities/pet-species.enum';

@Injectable()
export class PetsService {
  constructor(
    @InjectRepository(Pet)
    private readonly petRepository: Repository<Pet>,
  ) {}

  async create(createPetDto: CreatePetDto): Promise<Pet> {
    const pet = this.petRepository.create(createPetDto);
    return await this.petRepository.save(pet);
  }

  async findAll(ownerId?: string): Promise<Pet[]> {
    const where = ownerId ? { ownerId } : {};
    return await this.petRepository.find({
      where,
      relations: ['breed', 'owner', 'photos'],
    });
  }

  async findOne(id: string): Promise<Pet> {
    const pet = await this.petRepository.findOne({
      where: { id },
      relations: ['breed', 'owner', 'photos'],
    });
    if (!pet) {
      throw new NotFoundException(`Pet with ID ${id} not found`);
    }
    return pet;
  }

  async update(id: string, updatePetDto: UpdatePetDto): Promise<Pet> {
    const pet = await this.findOne(id);
    Object.assign(pet, updatePetDto);
    return await this.petRepository.save(pet);
  }

  async remove(id: string): Promise<void> {
    const pet = await this.findOne(id);
    await this.petRepository.remove(pet);
  }

  async verifyOwnership(petId: string, ownerId: string): Promise<boolean> {
    const pet = await this.petRepository.findOne({
      where: { id: petId, ownerId },
    });
    return !!pet;
  }

  calculateAge(dateOfBirth: Date): { years: number; months: number } {
    const now = new Date();
    const dob = new Date(dateOfBirth);
    let years = now.getFullYear() - dob.getFullYear();
    let months = now.getMonth() - dob.getMonth();

    if (months < 0 || (months === 0 && now.getDate() < dob.getDate())) {
      years--;
      months += 12;
    }
    
    // Adjust months if days are less
    if (now.getDate() < dob.getDate()) {
        months--;
    }
    if (months < 0) {
        months += 12;
    }
    
    return { years, months };
  }

  calculateAgeInWeeks(dateOfBirth: Date): number {
    const now = new Date();
    const dob = new Date(dateOfBirth);
    const diffTime = Math.abs(now.getTime() - dob.getTime());
    const diffWeeks = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7));
    return diffWeeks;
  }

  getLifeStage(dateOfBirth: Date, species: PetSpecies): string {
    const { years } = this.calculateAge(dateOfBirth);
    
    if (species === PetSpecies.DOG || species === PetSpecies.CAT) {
      if (years < 1) return 'Junior'; // Puppy/Kitten
      if (years < 7) return 'Adult';
      return 'Senior';
    }
    
    // Generic
    if (years < 1) return 'Young';
    if (years < 5) return 'Adult';
    return 'Senior';
  }
}
