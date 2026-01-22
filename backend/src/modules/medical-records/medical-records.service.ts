import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MedicalRecord } from './entities/medical-record.entity';
import { CreateMedicalRecordDto } from './dto/create-medical-record.dto';
import { UpdateMedicalRecordDto } from './dto/update-medical-record.dto';

@Injectable()
export class MedicalRecordsService {
  constructor(
    @InjectRepository(MedicalRecord)
    private readonly medicalRecordRepository: Repository<MedicalRecord>,
  ) {}

  async create(
    createMedicalRecordDto: CreateMedicalRecordDto,
  ): Promise<MedicalRecord> {
    const medicalRecord = this.medicalRecordRepository.create(
      createMedicalRecordDto,
    );
    return await this.medicalRecordRepository.save(medicalRecord);
  }

  async findAll(): Promise<MedicalRecord[]> {
    return await this.medicalRecordRepository.find({
      relations: ['pet', 'vet'],
    });
  }

  async findOne(id: string): Promise<MedicalRecord> {
    const medicalRecord = await this.medicalRecordRepository.findOne({
      where: { id },
      relations: ['pet', 'vet'],
    });
    if (!medicalRecord) {
      throw new NotFoundException(`Medical Record with ID ${id} not found`);
    }
    return medicalRecord;
  }

  async findByPet(petId: string): Promise<MedicalRecord[]> {
    return await this.medicalRecordRepository.find({
      where: { petId },
      relations: ['pet', 'vet'],
      order: { recordDate: 'DESC' },
    });
  }

  async update(
    id: string,
    updateMedicalRecordDto: UpdateMedicalRecordDto,
  ): Promise<MedicalRecord> {
    const medicalRecord = await this.findOne(id);
    Object.assign(medicalRecord, updateMedicalRecordDto);
    return await this.medicalRecordRepository.save(medicalRecord);
  }

  async remove(id: string): Promise<void> {
    const medicalRecord = await this.findOne(id);
    await this.medicalRecordRepository.remove(medicalRecord);
  }
}
