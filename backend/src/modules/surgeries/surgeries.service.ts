import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { promises as fs } from 'fs';
import { join, extname } from 'path';
import { randomUUID } from 'crypto';
import { Surgery, SurgeryStatus } from './entities/surgery.entity';
import { CreateSurgeryDto } from './dto/create-surgery.dto';
import { UpdateSurgeryDto } from './dto/update-surgery.dto';

const SURGERY_PHOTOS_DIR = join(process.cwd(), 'uploads', 'surgeries');

@Injectable()
export class SurgeriesService {
  constructor(
    @InjectRepository(Surgery)
    private surgeriesRepository: Repository<Surgery>,
  ) {}

  async create(createSurgeryDto: CreateSurgeryDto): Promise<Surgery> {
    const surgery = this.surgeriesRepository.create(createSurgeryDto);
    return this.surgeriesRepository.save(surgery);
  }

  async findAll(petId?: string, status?: SurgeryStatus): Promise<Surgery[]> {
    const query = this.surgeriesRepository
      .createQueryBuilder('surgery')
      .leftJoinAndSelect('surgery.pet', 'pet')
      .leftJoinAndSelect('surgery.vet', 'vet');

    if (petId) {
      query.andWhere('surgery.petId = :petId', { petId });
    }

    if (status) {
      query.andWhere('surgery.status = :status', { status });
    }

    return query.orderBy('surgery.surgeryDate', 'DESC').getMany();
  }

  async findOne(id: string): Promise<Surgery> {
    const surgery = await this.surgeriesRepository.findOne({
      where: { id },
      relations: ['pet', 'vet'],
    });

    if (!surgery) {
      throw new NotFoundException(`Surgery with ID ${id} not found`);
    }

    return surgery;
  }

  async update(
    id: string,
    updateSurgeryDto: UpdateSurgeryDto,
  ): Promise<Surgery> {
    await this.findOne(id);
    await this.surgeriesRepository.update(id, updateSurgeryDto);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const result = await this.surgeriesRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Surgery with ID ${id} not found`);
    }
  }

  async savePhoto(file: Express.Multer.File): Promise<string> {
    await fs.mkdir(SURGERY_PHOTOS_DIR, { recursive: true });
    const filename = `${randomUUID()}${extname(file.originalname)}`;
    const filePath = join(SURGERY_PHOTOS_DIR, filename);
    await fs.writeFile(filePath, file.buffer);
    return `uploads/surgeries/${filename}`;
  }
}
