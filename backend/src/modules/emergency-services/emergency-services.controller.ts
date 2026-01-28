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
} from '@nestjs/common';
import { EmergencyServicesService } from './emergency-services.service';
import { CreateEmergencyServiceDto } from './dto/create-emergency-service.dto';
import { UpdateEmergencyServiceDto } from './dto/update-emergency-service.dto';
import { EmergencyService } from './entities/emergency-service.entity';

@Controller('emergency-services')
export class EmergencyServicesController {
  constructor(
    private readonly emergencyServicesService: EmergencyServicesService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createEmergencyServiceDto: CreateEmergencyServiceDto,
  ): Promise<EmergencyService> {
    return await this.emergencyServicesService.create(
      createEmergencyServiceDto,
    );
  }

  @Get()
  async findAll(): Promise<EmergencyService[]> {
    return await this.emergencyServicesService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<EmergencyService> {
    return await this.emergencyServicesService.findOne(id);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateEmergencyServiceDto: UpdateEmergencyServiceDto,
  ): Promise<EmergencyService> {
    return await this.emergencyServicesService.update(
      id,
      updateEmergencyServiceDto,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    return await this.emergencyServicesService.remove(id);
  }
}
