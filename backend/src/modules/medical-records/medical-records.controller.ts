import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { MedicalRecordsService } from './medical-records.service';
import { CreateMedicalRecordDto } from './dto/create-medical-record.dto';
import { UpdateMedicalRecordDto } from './dto/update-medical-record.dto';
import { MedicalRecord } from './entities/medical-record.entity';

@Controller('medical-records')
export class MedicalRecordsController {
  constructor(
    private readonly medicalRecordsService: MedicalRecordsService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createMedicalRecordDto: CreateMedicalRecordDto,
  ): Promise<MedicalRecord> {
    return await this.medicalRecordsService.create(createMedicalRecordDto);
  }

  @Get()
  async findAll(@Query('petId') petId?: string): Promise<MedicalRecord[]> {
    if (petId) {
      return await this.medicalRecordsService.findByPet(petId);
    }
    return await this.medicalRecordsService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<MedicalRecord> {
    return await this.medicalRecordsService.findOne(id);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateMedicalRecordDto: UpdateMedicalRecordDto,
  ): Promise<MedicalRecord> {
    return await this.medicalRecordsService.update(id, updateMedicalRecordDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    return await this.medicalRecordsService.remove(id);
  }
}
