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
  UseGuards,
} from '@nestjs/common';
import { StreamableFile } from '@nestjs/common/file-stream';
import { FilesInterceptor } from '@nestjs/platform-express';
import { MedicalRecordsService } from './medical-records.service';
import { MedicalRecordsExportService } from './medical-records-export.service';
import { CreateMedicalRecordDto } from './dto/create-medical-record.dto';
import { UpdateMedicalRecordDto } from './dto/update-medical-record.dto';
import { AppendRecordDto } from './dto/append-record.dto';
import { SearchMedicalRecordsDto } from './dto/search-medical-records.dto';
import { VerifyRecordDto, RevokeVerificationDto } from './dto/verify-record.dto';
import {
  ExportMedicalRecordsDto,
  EmailExportMedicalRecordsDto,
  ExportFormat,
} from './dto/export-medical-records.dto';
import { RecordType } from './entities/medical-record.entity';
import { PetSpecies } from '../pets/entities/pet.entity';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { RoleName } from '../../auth/constants/roles.enum';
import { Permission } from '../../auth/constants/permissions.enum';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('medical-records')
export class MedicalRecordsController {
  constructor(
    private readonly medicalRecordsService: MedicalRecordsService,
    private readonly exportService: MedicalRecordsExportService,
  ) {}

  @Post()
  @Permissions(Permission.CREATE_MEDICAL_RECORDS)
  @UseInterceptors(FilesInterceptor('files', 10))
  async create(
    @Body() createMedicalRecordDto: CreateMedicalRecordDto,
    @CurrentUser('id') userId: string,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    if (files?.length) {
      createMedicalRecordDto.attachments = await Promise.all(
        files.map((f) => this.medicalRecordsService.saveAttachment(f)),
      );
    }
    return this.medicalRecordsService.create(createMedicalRecordDto, userId);
  }

  /** Rich search: ?q=text&petId=&recordType=&accessLevel=&vetId=&verified=&startDate=&endDate= */
  @Get('search')
  @Permissions(Permission.READ_MEDICAL_RECORDS)
  search(@Query() dto: SearchMedicalRecordsDto) {
    return this.medicalRecordsService.search(dto);
  }

  @Get()
  @Permissions(Permission.READ_MEDICAL_RECORDS)
  findAll(
    @Query('petId') petId?: string,
    @Query('recordType') recordType?: RecordType,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.medicalRecordsService.findAll(petId, recordType, startDate, endDate);
  }

  @Get('templates/:petType')
  @Permissions(Permission.READ_MEDICAL_RECORDS)
  getTemplates(@Param('petType') petType: PetSpecies) {
    return this.medicalRecordsService.getTemplatesByPetType(petType);
  }

  @Post('templates')
  @Roles(RoleName.Veterinarian, RoleName.Admin)
  createTemplate(
    @Body('petType') petType: PetSpecies,
    @Body('recordType') recordType: RecordType,
    @Body('templateFields') templateFields: Record<string, any>,
    @Body('description') description?: string,
  ) {
    return this.medicalRecordsService.createTemplate(petType, recordType, templateFields, description);
  }

  @Get('export')
  @Permissions(Permission.READ_MEDICAL_RECORDS)
  async exportGet(
    @Query('format') format: ExportFormat,
    @Query('recordIds') recordIdsStr?: string,
    @Query('petId') petId?: string,
    @Query('recordType') recordType?: RecordType,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('includeAttachments') includeAttachments?: string,
  ) {
    const recordIds = recordIdsStr?.split(',').map((s) => s.trim()).filter(Boolean);
    const dto: ExportMedicalRecordsDto = {
      format, recordIds, petId, recordType, startDate, endDate,
      includeAttachments: includeAttachments !== 'false',
    };
    const result = await this.exportService.export(dto);
    return new StreamableFile(result.buffer, {
      type: result.contentType,
      disposition: `attachment; filename="${result.filename}"`,
    });
  }

  @Post('export')
  @Permissions(Permission.READ_MEDICAL_RECORDS)
  async exportPost(@Body() dto: ExportMedicalRecordsDto) {
    const result = await this.exportService.export(dto);
    return new StreamableFile(result.buffer, {
      type: result.contentType,
      disposition: `attachment; filename="${result.filename}"`,
    });
  }

  @Post('export/email')
  @Permissions(Permission.READ_MEDICAL_RECORDS)
  async exportEmail(
    @Body() dto: EmailExportMedicalRecordsDto,
    @Query('userEmail') userEmail?: string,
  ) {
    const recipient = dto.to || userEmail;
    if (!recipient) throw new BadRequestException('Provide "to" in body or userEmail query param.');
    return this.exportService.sendExportByEmail(dto, recipient);
  }

  // --- Vet Verification ---

  @Post(':id/verify')
  @Roles(RoleName.Veterinarian, RoleName.Admin)
  verifyRecord(
    @Param('id') id: string,
    @Body() dto: VerifyRecordDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.medicalRecordsService.verifyRecord(id, dto, userId);
  }

  @Post(':id/revoke-verification')
  @Roles(RoleName.Veterinarian, RoleName.Admin)
  revokeVerification(
    @Param('id') id: string,
    @Body() dto: RevokeVerificationDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.medicalRecordsService.revokeVerification(id, dto, userId);
  }

  // --- Append-only observation ---

  @Post(':id/append')
  @Permissions(Permission.CREATE_MEDICAL_RECORDS)
  appendObservation(
    @Param('id') id: string,
    @Body() dto: AppendRecordDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.medicalRecordsService.append(id, dto, userId);
  }

  // --- Versioning / history ---

  @Get(':id/history')
  @Permissions(Permission.READ_MEDICAL_RECORDS)
  getHistory(@Param('id') id: string) {
    return this.medicalRecordsService.getRecordVersions(id);
  }

  @Get(':id/versions')
  @Permissions(Permission.READ_MEDICAL_RECORDS)
  getVersions(@Param('id') id: string) {
    return this.medicalRecordsService.getRecordVersions(id);
  }

  @Get(':id/versions/:versionId')
  @Permissions(Permission.READ_MEDICAL_RECORDS)
  getVersion(@Param('id') id: string, @Param('versionId') versionId: string) {
    return this.medicalRecordsService.getRecordVersion(id, versionId);
  }

  // --- Core CRUD ---

  @Get(':id')
  @Permissions(Permission.READ_MEDICAL_RECORDS)
  findOne(@Param('id') id: string) {
    return this.medicalRecordsService.findOne(id);
  }

  @Get(':id/qr')
  @Permissions(Permission.READ_MEDICAL_RECORDS)
  getQRCode(@Param('id') id: string) {
    return this.medicalRecordsService.getQRCode(id);
  }

  @Patch(':id')
  @Permissions(Permission.UPDATE_MEDICAL_RECORDS)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateMedicalRecordDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.medicalRecordsService.update(id, dto, userId);
  }

  @Delete(':id')
  @Permissions(Permission.DELETE_MEDICAL_RECORDS)
  remove(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.medicalRecordsService.remove(id, userId);
  }
}
