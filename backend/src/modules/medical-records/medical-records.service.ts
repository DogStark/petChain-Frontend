import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, ILike, FindOptionsWhere } from 'typeorm';
import * as QRCode from 'qrcode';
import * as crypto from 'crypto';
import { MedicalRecord } from './entities/medical-record.entity';
import { RecordTemplate } from './entities/record-template.entity';
import { RecordVersion } from './entities/record-version.entity';
import { CreateMedicalRecordDto } from './dto/create-medical-record.dto';
import { UpdateMedicalRecordDto } from './dto/update-medical-record.dto';
import { AppendRecordDto } from './dto/append-record.dto';
import { SearchMedicalRecordsDto } from './dto/search-medical-records.dto';
import { VerifyRecordDto, RevokeVerificationDto } from './dto/verify-record.dto';
import { PetSpecies } from '../pets/entities/pet.entity';
import { RecordType } from './entities/medical-record.entity';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import { HashAnchoringService } from '../blockchain/hash-anchoring.service';

@Injectable()
export class MedicalRecordsService {
  constructor(
    @InjectRepository(MedicalRecord)
    private readonly medicalRecordRepository: Repository<MedicalRecord>,
    @InjectRepository(RecordTemplate)
    private readonly templateRepository: Repository<RecordTemplate>,
    @InjectRepository(RecordVersion)
    private readonly versionRepository: Repository<RecordVersion>,
    private readonly auditService: AuditService,
    @Optional() private readonly hashAnchoringService?: HashAnchoringService,
  ) { }

  async create(
    createMedicalRecordDto: CreateMedicalRecordDto,
    userId?: string,
  ): Promise<MedicalRecord> {
    const record = this.medicalRecordRepository.create(createMedicalRecordDto);
    const savedRecord = await this.medicalRecordRepository.save(record);

    // Generate QR code
    await this.generateQRCode(savedRecord.id);

    // Create initial version snapshot
    await this.createVersionSnapshot(savedRecord.id, 1, userId, 'Initial creation');

    // Audit log
    if (userId) {
      await this.auditService.log(
        userId,
        'medical_record',
        savedRecord.id,
        AuditAction.CREATE,
      );
    }

    // Queue blockchain anchor (fire-and-forget)
    this.hashAnchoringService?.queueAnchor(savedRecord.id).catch(() => null);

    return this.findOne(savedRecord.id);
  }

  async findAll(
    petId?: string,
    recordType?: RecordType,
    startDate?: string,
    endDate?: string,
  ): Promise<MedicalRecord[]> {
    return this.search({ petId, recordType, startDate, endDate });
  }

  async search(dto: SearchMedicalRecordsDto): Promise<MedicalRecord[]> {
    const { petId, recordType, accessLevel, startDate, endDate, q, vetId, verified } = dto;

    const baseWhere: FindOptionsWhere<MedicalRecord> = {};
    if (petId) baseWhere.petId = petId;
    if (recordType) baseWhere.recordType = recordType;
    if (accessLevel) baseWhere.accessLevel = accessLevel;
    if (vetId) baseWhere.vetId = vetId;
    if (verified !== undefined) baseWhere.verified = verified;
    if (startDate && endDate)
      baseWhere.visitDate = Between(new Date(startDate), new Date(endDate)) as any;

    const whereConditions: FindOptionsWhere<MedicalRecord>[] = q
      ? [
          { ...baseWhere, diagnosis: ILike(`%${q}%`) },
          { ...baseWhere, treatment: ILike(`%${q}%`) },
          { ...baseWhere, notes: ILike(`%${q}%`) },
        ]
      : [baseWhere];

    return this.medicalRecordRepository.find({
      where: whereConditions,
      relations: ['pet', 'vet', 'verifiedByVet'],
      order: { visitDate: 'DESC' },
    });
  }

  /** Append-only: adds a timestamped observation to notes, snapshots version */
  async append(id: string, dto: AppendRecordDto, userId?: string): Promise<MedicalRecord> {
    const record = await this.findOne(id);
    await this.createVersionSnapshot(id, record.version, userId, 'Observation appended');

    const entry = `[${new Date().toISOString()}${userId ? ` by ${userId}` : ''}]: ${dto.observation}`;
    record.notes = record.notes ? `${record.notes}\n${entry}` : entry;

    const saved = await this.medicalRecordRepository.save(record);
    if (userId) await this.auditService.log(userId, 'medical_record', id, AuditAction.UPDATE);
    this.hashAnchoringService?.queueAnchor(id).catch(() => null);
    return saved;
  }

  async findOne(id: string): Promise<MedicalRecord> {
    const record = await this.medicalRecordRepository.findOne({
      where: { id },
      relations: ['pet', 'vet', 'verifiedByVet'],
    });

    if (!record) {
      throw new NotFoundException(`Medical record with ID ${id} not found`);
    }

    return record;
  }

  async findByIds(ids: string[]): Promise<MedicalRecord[]> {
    if (!ids.length) return [];
    const records = await this.medicalRecordRepository.find({
      where: ids.map((id) => ({ id })),
      relations: ['pet', 'vet', 'verifiedByVet'],
      order: { visitDate: 'DESC' },
    });
    return records;
  }

  async update(
    id: string,
    updateMedicalRecordDto: UpdateMedicalRecordDto,
    userId?: string,
  ): Promise<MedicalRecord> {
    const record = await this.findOne(id);

    // If verified, prevent modification unless explicitly allowed
    if (record.verified) {
      throw new ForbiddenException(
        'Cannot modify a verified medical record. Revoke verification first.',
      );
    }

    // Save version snapshot before updating
    const { changeReason, ...updateData } = updateMedicalRecordDto;
    await this.createVersionSnapshot(
      id,
      record.version,
      userId,
      changeReason || 'Record updated',
    );

    Object.assign(record, updateData);
    const updated = await this.medicalRecordRepository.save(record);

    // Audit log
    if (userId) {
      await this.auditService.log(
        userId,
        'medical_record',
        id,
        AuditAction.UPDATE,
      );
    }

    // Re-anchor updated record (fire-and-forget)
    this.hashAnchoringService?.queueAnchor(id).catch(() => null);

    return updated;
  }

  async remove(id: string, userId?: string): Promise<void> {
    const record = await this.findOne(id);

    if (record.verified) {
      throw new ForbiddenException(
        'Cannot delete a verified medical record. Revoke verification first.',
      );
    }

    await this.medicalRecordRepository.softRemove(record);

    // Audit log
    if (userId) {
      await this.auditService.log(
        userId,
        'medical_record',
        id,
        AuditAction.DELETE,
      );
    }
  }

  // --- Vet Verification / Signature ---

  async verifyRecord(
    id: string,
    verifyRecordDto: VerifyRecordDto,
    userId?: string,
  ): Promise<MedicalRecord> {
    const record = await this.findOne(id);

    if (record.verified) {
      throw new BadRequestException('Record is already verified.');
    }

    // Generate cryptographic signature hash
    const signaturePayload = [
      record.id,
      record.petId,
      record.vetId,
      record.diagnosis,
      record.treatment,
      record.visitDate,
      verifyRecordDto.vetId,
      verifyRecordDto.digitalSignature,
    ].join('|');

    const signatureHash = crypto
      .createHash('sha256')
      .update(signaturePayload)
      .digest('hex');

    record.verified = true;
    record.verifiedAt = new Date();
    record.verifiedByVetId = verifyRecordDto.vetId;
    record.digitalSignature = signatureHash;

    if (verifyRecordDto.notes) {
      record.notes = record.notes
        ? `${record.notes}\n[Verification Note]: ${verifyRecordDto.notes}`
        : `[Verification Note]: ${verifyRecordDto.notes}`;
    }

    const saved = await this.medicalRecordRepository.save(record);

    // Audit log
    if (userId) {
      await this.auditService.log(
        userId,
        'medical_record',
        id,
        AuditAction.UPDATE,
      );
    }

    return saved;
  }

  async revokeVerification(
    id: string,
    revokeDto: RevokeVerificationDto,
    userId?: string,
  ): Promise<MedicalRecord> {
    const record = await this.findOne(id);

    if (!record.verified) {
      throw new BadRequestException('Record is not currently verified.');
    }

    // Save version snapshot before revoking
    await this.createVersionSnapshot(
      id,
      record.version,
      userId,
      `Verification revoked: ${revokeDto.reason}`,
    );

    record.verified = false;
    record.verifiedAt = null;
    record.verifiedByVetId = null;
    record.digitalSignature = null;

    const saved = await this.medicalRecordRepository.save(record);

    // Audit log
    if (userId) {
      await this.auditService.log(
        userId,
        'medical_record',
        id,
        AuditAction.UPDATE,
      );
    }

    return saved;
  }

  // --- Record Versioning ---

  private async createVersionSnapshot(
    recordId: string,
    version: number,
    changedBy?: string,
    changeReason?: string,
  ): Promise<RecordVersion> {
    const record = await this.medicalRecordRepository.findOne({
      where: { id: recordId },
    });

    if (!record) {
      throw new NotFoundException(`Medical record with ID ${recordId} not found`);
    }

    const snapshot = { ...record };
    delete (snapshot as any).deletedAt;

    const versionEntry = this.versionRepository.create({
      recordId,
      version,
      snapshot,
      changedBy: changedBy || null,
      changeReason: changeReason || null,
    });

    return await this.versionRepository.save(versionEntry);
  }

  async getRecordVersions(recordId: string): Promise<RecordVersion[]> {
    // Ensure the record exists
    await this.findOne(recordId);

    return await this.versionRepository.find({
      where: { recordId },
      order: { version: 'DESC' },
    });
  }

  async getRecordVersion(
    recordId: string,
    versionId: string,
  ): Promise<RecordVersion> {
    const version = await this.versionRepository.findOne({
      where: { id: versionId, recordId },
    });

    if (!version) {
      throw new NotFoundException(
        `Version ${versionId} not found for record ${recordId}`,
      );
    }

    return version;
  }

  // --- QR Code ---

  async generateQRCode(recordId: string): Promise<string> {
    const record = await this.findOne(recordId);

    // Create shareable URL
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

  // --- Record Templates ---

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

  // --- Attachments ---

  async saveAttachment(file: Express.Multer.File): Promise<string> {
    // Validate file type for HIPAA compliance
    const allowedMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'application/dicom',
      'text/plain',
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `File type ${file.mimetype} is not allowed. Allowed types: ${allowedMimeTypes.join(', ')}`,
      );
    }

    // Validate file size (max 50MB)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new BadRequestException(
        `File size exceeds maximum allowed size of 50MB.`,
      );
    }

    // Generate unique filename with encryption-safe naming
    const filename = `${crypto.randomUUID()}-${file.originalname}`;
    const filepath = `uploads/medical-records/${filename}`;

    // In production, upload to encrypted cloud storage here
    return filepath;
  }
}
