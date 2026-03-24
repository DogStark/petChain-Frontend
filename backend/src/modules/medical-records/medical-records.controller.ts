import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
} from '@nestjs/common';
import { StreamableFile } from '@nestjs/common/file-stream';
import { FilesInterceptor } from '@nestjs/platform-express';
import { MedicalRecordsService } from './medical-records.service';
import { MedicalRecordsExportService } from './medical-records-export.service';
import { CreateMedicalRecordDto } from './dto/create-medical-record.dto';
import { UpdateMedicalRecordDto } from './dto/update-medical-record.dto';
import { VerifyRecordDto, RevokeVerificationDto } from './dto/verify-record.dto';
import {
  ExportMedicalRecordsDto,
  EmailExportMedicalRecordsDto,
  ExportFormat,
} from './dto/export-medical-records.dto';
import { RecordType } from './entities/medical-record.entity';
import { PetSpecies } from '../pets/entities/pet.entity';

@Controller('medical-records')
export class MedicalRecordsController {
  constructor(
    private readonly medicalRecordsService: MedicalRecordsService,
    private readonly exportService: MedicalRecordsExportService,
  ) { }

  @Post()
  @UseInterceptors(FilesInterceptor('files', 10))
  async create(
    @Body() createMedicalRecordDto: CreateMedicalRecordDto,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    // Handle file uploads
    if (files && files.length > 0) {
      const attachments = await Promise.all(
        files.map((file) => this.medicalRecordsService.saveAttachment(file)),
      );
      createMedicalRecordDto.attachments = attachments;
    }

    return this.medicalRecordsService.create(createMedicalRecordDto);
  }

  @Get()
  findAll(
    @Query('petId') petId?: string,
    @Query('recordType') recordType?: RecordType,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.medicalRecordsService.findAll(
      petId,
      recordType,
      startDate,
      endDate,
    );
  }

  @Get('templates/:petType')
  getTemplates(@Param('petType') petType: PetSpecies) {
    return this.medicalRecordsService.getTemplatesByPetType(petType);
  }

  @Post('templates')
  createTemplate(
    @Body('petType') petType: PetSpecies,
    @Body('recordType') recordType: RecordType,
    @Body('templateFields') templateFields: Record<string, any>,
    @Body('description') description?: string,
  ) {
    return this.medicalRecordsService.createTemplate(
      petType,
      recordType,
      templateFields,
      description,
    );
  }

  /**
   * Export medical records as PDF, CSV, or FHIR.
   * GET: use query params (format, petId, recordType, startDate, endDate).
   * POST: use body for full options including recordIds for batch export.
   */
  @Get('export')
  async exportGet(
    @Query('format') format: ExportFormat,
    @Query('recordIds') recordIdsStr?: string,
    @Query('petId') petId?: string,
    @Query('recordType') recordType?: RecordType,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('includeAttachments') includeAttachments?: string,
  ) {
    const recordIds = recordIdsStr
      ? recordIdsStr
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      : undefined;
    const dto: ExportMedicalRecordsDto = {
      format,
      recordIds,
      petId,
      recordType,
      startDate,
      endDate,
      includeAttachments:
        includeAttachments === 'true' || includeAttachments === undefined,
    };
    const result = await this.exportService.export(dto);
    return new StreamableFile(result.buffer, {
      type: result.contentType,
      disposition: `attachment; filename="${result.filename}"`,
    });
  }

  @Post('export')
  async exportPost(@Body() dto: ExportMedicalRecordsDto) {
    const result = await this.exportService.export(dto);
    return new StreamableFile(result.buffer, {
      type: result.contentType,
      disposition: `attachment; filename="${result.filename}"`,
    });
  }

  /**
   * Generate export and send it by email.
   * Requires MAIL_HOST, MAIL_PORT, MAIL_USER, MAIL_PASS to be set.
   */
  @Post('export/email')
  async exportEmail(
    @Body() dto: EmailExportMedicalRecordsDto,
    @Query('userEmail') userEmail?: string,
  ) {
    const recipient = dto.to || userEmail;
    if (!recipient) {
      throw new BadRequestException(
        'Provide "to" in body or userEmail query param.',
      );
    }
    return this.exportService.sendExportByEmail(dto, recipient);
  }

  // --- Vet Verification / Signature ---

  @Post(':id/verify')
  verifyRecord(
    @Param('id') id: string,
    @Body() verifyRecordDto: VerifyRecordDto,
  ) {
    return this.medicalRecordsService.verifyRecord(id, verifyRecordDto);
  }

  @Post(':id/revoke-verification')
  revokeVerification(
    @Param('id') id: string,
    @Body() revokeDto: RevokeVerificationDto,
  ) {
    return this.medicalRecordsService.revokeVerification(id, revokeDto);
  }

  // --- Record Versioning ---

  @Get(':id/versions')
  getVersions(@Param('id') id: string) {
    return this.medicalRecordsService.getRecordVersions(id);
  }

  @Get(':id/versions/:versionId')
  getVersion(
    @Param('id') id: string,
    @Param('versionId') versionId: string,
  ) {
    return this.medicalRecordsService.getRecordVersion(id, versionId);
  }

  // --- Core record endpoints ---

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.medicalRecordsService.findOne(id);
  }

  @Get(':id/qr')
  getQRCode(@Param('id') id: string) {
    return this.medicalRecordsService.getQRCode(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateMedicalRecordDto: UpdateMedicalRecordDto,
  ) {
    return this.medicalRecordsService.update(id, updateMedicalRecordDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.medicalRecordsService.remove(id);
  }
}
