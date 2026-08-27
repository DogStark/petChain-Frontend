import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Surgery, SurgeryStatus } from './entities/surgery.entity';
import { CreateSurgeryDto } from './dto/create-surgery.dto';
import { UpdateSurgeryDto } from './dto/update-surgery.dto';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class SurgeriesService {
  private readonly logger = new Logger(SurgeriesService.name);

  constructor(
    @InjectRepository(Surgery)
    private surgeriesRepository: Repository<Surgery>,
    private readonly storageService: StorageService,
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
    const storageKey = this.storageService.generateKey({
      prefix: 'uploads',
      filename: file.originalname,
      variant: 'surgeries',
    });

    try {
      await this.storageService.upload({
        key: storageKey,
        body: file.buffer,
        contentType: file.mimetype,
        metadata: {
          originalFilename: file.originalname,
          uploadedAt: new Date().toISOString(),
        },
      });

      const publicUrl = this.storageService.getPublicUrl(storageKey);
      if (!publicUrl) {
        this.logger.warn(
          `No public URL available for surgery photo: ${storageKey}`,
        );
        return storageKey;
      }

      return publicUrl;
    } catch (error) {
      this.logger.error(`Failed to save surgery photo: ${file.originalname}`, error);
      throw error;
    }
  }
}
