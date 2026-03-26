import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmergencyService } from './entities/emergency-service.entity';
import { CreateEmergencyServiceDto } from './dto/create-emergency-service.dto';
import { UpdateEmergencyServiceDto } from './dto/update-emergency-service.dto';

@Injectable()
export class EmergencyServicesService {
  constructor(
    @InjectRepository(EmergencyService)
    private readonly emergencyServiceRepository: Repository<EmergencyService>,
  ) {}

  async create(
    createEmergencyServiceDto: CreateEmergencyServiceDto,
  ): Promise<EmergencyService> {
    const emergencyService = this.emergencyServiceRepository.create(
      createEmergencyServiceDto,
    );
    return await this.emergencyServiceRepository.save(emergencyService);
  }

  async findAll(): Promise<EmergencyService[]> {
    return await this.emergencyServiceRepository.find();
  }

  async findOne(id: string): Promise<EmergencyService> {
    const emergencyService = await this.emergencyServiceRepository.findOne({
      where: { id },
    });
    if (!emergencyService) {
      throw new NotFoundException(
        `Emergency Service with ID ${id} not found`,
      );
    }
    return emergencyService;
  }

  async update(
    id: string,
    updateEmergencyServiceDto: UpdateEmergencyServiceDto,
  ): Promise<EmergencyService> {
    const emergencyService = await this.findOne(id);
    Object.assign(emergencyService, updateEmergencyServiceDto);
    return await this.emergencyServiceRepository.save(emergencyService);
  }

  async remove(id: string): Promise<void> {
    const emergencyService = await this.findOne(id);
    await this.emergencyServiceRepository.remove(emergencyService);
  }
}
