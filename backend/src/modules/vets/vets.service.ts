import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { Vet } from './entities/vet.entity';
import { CreateVetDto } from './dto/create-vet.dto';
import { UpdateVetDto } from './dto/update-vet.dto';

@Injectable()
export class VetsService {
  constructor(
    @InjectRepository(Vet)
    private readonly vetRepository: Repository<Vet>,
  ) {}

  async create(createVetDto: CreateVetDto): Promise<Vet> {
    const vet = this.vetRepository.create(createVetDto);
    return await this.vetRepository.save(vet);
  }

  async findAll(search?: string): Promise<Vet[]> {
    if (search) {
      return await this.vetRepository.find({
        where: [
          { vetName: Like(`%${search}%`) },
          { clinicName: Like(`%${search}%`) },
          { city: Like(`%${search}%`) },
        ],
      });
    }
    return await this.vetRepository.find();
  }

  async findOne(id: string): Promise<Vet> {
    const vet = await this.vetRepository.findOne({ where: { id } });
    if (!vet) {
      throw new NotFoundException(`Vet with ID ${id} not found`);
    }
    return vet;
  }

  async update(id: string, updateVetDto: UpdateVetDto): Promise<Vet> {
    const vet = await this.findOne(id);
    Object.assign(vet, updateVetDto);
    return await this.vetRepository.save(vet);
  }

  async remove(id: string): Promise<void> {
    const vet = await this.findOne(id);
    await this.vetRepository.remove(vet);
  }
}
