import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, IsNull, Not } from 'typeorm';
import * as QRCode from 'qrcode';
import * as crypto from 'crypto';
import { MedicalRecord } from './entities/medical-record.entity';
import { RecordTemplate } from './entities/record-template.entity';
import { CreateMedicalRecordDto } from './dto/create-medical-record.dto';
import { UpdateMedicalRecordDto } from './dto/update-medical-record.dto';
import { PetSpecies } from '../pets/entities/pet.entity';
import { RecordType } from './entities/medical-record.entity';

@Injectable()
export class MedicalRecordsService {
  constructor(
    @InjectRepository(MedicalRecord)
    private readonly medicalRecordRepository: Repository<MedicalRecord>,
    @InjectRepository(RecordTemplate)
    private readonly templateRepository: Repository<RecordTemplate>,
  ) {}

  async create(
    createMedicalRecordDto: CreateMedicalRecordDto,
  ): Promise<MedicalRecord> {
    const record = this.medicalRecordRepository.create(createMedicalRecordDto);
    const savedRecord = await this.medicalRecordRepository.save(record);

    // Generate QR code
    await this.generateQRCode(savedRecord.id);

    return this.findOne(savedRecord.id);
  }

  async findAll(
    petId?: string,
    recordType?: RecordType,
    startDate?: string,
    endDate?: string,
  ): Promise<MedicalRecord[]> {
    const where: any = {};

    if (petId) {
      where.petId = petId;
    }

    if (recordType) {
      where.recordType = recordType;
    }

    if (startDate && endDate) {
      where.date = Between(new Date(startDate), new Date(endDate));
    }

    return await this.medicalRecordRepository.find({
      where,
      relations: ['pet', 'vet'],
      order: { date: 'DESC' },
    });
  }

  async findOne(id: string): Promise<MedicalRecord> {
    const record = await this.medicalRecordRepository.findOne({
      where: { id },
      relations: ['pet', 'vet'],
    });

    if (!record) {
      throw new NotFoundException(`Medical record with ID ${id} not found`);
    }

    return record;
  }

  async update(
    id: string,
    updateMedicalRecordDto: UpdateMedicalRecordDto,
  ): Promise<MedicalRecord> {
    const record = await this.findOne(id);
    Object.assign(record, updateMedicalRecordDto);
    return await this.medicalRecordRepository.save(record);
  }

  async remove(id: string): Promise<void> {
    const record = await this.findOne(id);
    await this.medicalRecordRepository.softRemove(record);
  }

  async generateQRCode(recordId: string): Promise<string> {
    const record = await this.findOne(recordId);

    // Create shareable URL (you can customize this)
    const shareUrl = `${process.env.APP_URL || 'http://localhost:3000'}/medical-records/share/${recordId}`;

    // Generate QR code as data URL
    const qrCodeDataUrl = await QRCode.toDataURL(shareUrl);

    // Update record with QR code
    record.qrCode = qrCodeDataUrl;
    await this.medicalRecordRepository.save(record);

    return qrCodeDataUrl;
  }

  async getQRCode(recordId: string): Promise<string> {
    const record = await this.findOne(recordId);

    if (!record.qrCode) {
      return await this.generateQRCode(recordId);
    }

    return record.qrCode;
  }

  async getTemplatesByPetType(petType: PetSpecies): Promise<RecordTemplate[]> {
    return await this.templateRepository.find({
      where: { petType, isActive: true },
    });
  }

  async createTemplate(
    petType: PetSpecies,
    recordType: RecordType,
    templateFields: Record<string, any>,
    description?: string,
  ): Promise<RecordTemplate> {
    const template = this.templateRepository.create({
      petType,
      recordType,
      templateFields,
      description,
    });

    return await this.templateRepository.save(template);
  }

  async saveAttachment(file: Express.Multer.File): Promise<string> {
    // Generate unique filename
    const filename = `${crypto.randomUUID()}-${file.originalname}`;
    const filepath = `uploads/medical-records/${filename}`;

    // In production, you would upload to cloud storage here
    // For now, we'll just return the filepath
    return filepath;
  }
}
