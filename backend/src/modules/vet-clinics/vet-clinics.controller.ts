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
import { VetClinicsService } from './vet-clinics.service';
import { CreateVetClinicDto } from './dto/create-vet-clinic.dto';
import { UpdateVetClinicDto } from './dto/update-vet-clinic.dto';
import { VetClinic } from './entities/vet-clinic.entity';

@Controller('vet-clinics')
export class VetClinicsController {
  constructor(private readonly vetClinicsService: VetClinicsService) {}

  /**
   * Create a new vet clinic
   * POST /vet-clinics
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createVetClinicDto: CreateVetClinicDto,
  ): Promise<VetClinic> {
    return await this.vetClinicsService.create(createVetClinicDto);
  }

  /**
   * Get all vet clinics
   * GET /vet-clinics
   */
  @Get()
  async findAll(@Query('city') city?: string): Promise<VetClinic[]> {
    if (city) {
      return await this.vetClinicsService.findByCity(city);
    }
    return await this.vetClinicsService.findAll();
  }

  /**
   * Get a single vet clinic
   * GET /vet-clinics/:id
   */
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<VetClinic> {
    return await this.vetClinicsService.findOne(id);
  }

  /**
   * Update a vet clinic
   * PATCH /vet-clinics/:id
   */
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateVetClinicDto: UpdateVetClinicDto,
  ): Promise<VetClinic> {
    return await this.vetClinicsService.update(id, updateVetClinicDto);
  }

  /**
   * Delete a vet clinic
   * DELETE /vet-clinics/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    return await this.vetClinicsService.remove(id);
  }
}
