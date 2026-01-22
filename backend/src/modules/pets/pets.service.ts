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

  async create(createPetDto: CreatePetDto): Promise<Pet> {
    const pet = this.petRepository.create(createPetDto);
    return await this.petRepository.save(pet);
  }

  async findAll(ownerId?: string): Promise<Pet[]> {
    if (ownerId) {
      return await this.petRepository.find({ where: { ownerId } });
    }
    return await this.petRepository.find();
  }

  async findOne(id: string): Promise<Pet> {
    const pet = await this.petRepository.findOne({ where: { id } });
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
}
