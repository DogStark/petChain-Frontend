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
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { MedicalRecordsService } from './medical-records.service';
import { CreateMedicalRecordDto } from './dto/create-medical-record.dto';
import { UpdateMedicalRecordDto } from './dto/update-medical-record.dto';
import { RecordType } from './entities/medical-record.entity';
import { PetSpecies } from '../pets/entities/pet.entity';

@Controller('medical-records')
export class MedicalRecordsController {
  constructor(
    private readonly medicalRecordsService: MedicalRecordsService,
  ) {}

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
