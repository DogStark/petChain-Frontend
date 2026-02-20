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
import { VaccinationsService } from './vaccinations.service';
import { CreateVaccinationDto } from './dto/create-vaccination.dto';
import { UpdateVaccinationDto } from './dto/update-vaccination.dto';
import { Vaccination } from './entities/vaccination.entity';

@Controller('vaccinations')
export class VaccinationsController {
  constructor(private readonly vaccinationsService: VaccinationsService) {}

  /**
   * Create a new vaccination record
   * POST /vaccinations
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createVaccinationDto: CreateVaccinationDto,
  ): Promise<Vaccination> {
    return await this.vaccinationsService.create(createVaccinationDto);
  }

  /**
   * Get all vaccinations
   * GET /vaccinations
   */
  @Get()
  async findAll(): Promise<Vaccination[]> {
    return await this.vaccinationsService.findAll();
  }

  /**
   * Get vaccinations by pet
   * GET /vaccinations/pet/:petId
   */
  @Get('pet/:petId')
  async findByPet(@Param('petId') petId: string): Promise<Vaccination[]> {
    return await this.vaccinationsService.findByPet(petId);
  }

  /**
   * Get vaccination statistics for a pet
   * GET /vaccinations/pet/:petId/stats
   */
  @Get('pet/:petId/stats')
  async getStats(@Param('petId') petId: string) {
    return await this.vaccinationsService.getVaccinationStats(petId);
  }

  /**
   * Get a single vaccination by ID
   * GET /vaccinations/:id
   */
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Vaccination> {
    return await this.vaccinationsService.findOne(id);
  }

  /**
   * Update a vaccination
   * PATCH /vaccinations/:id
   */
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateVaccinationDto: UpdateVaccinationDto,
  ): Promise<Vaccination> {
    return await this.vaccinationsService.update(id, updateVaccinationDto);
  }

  /**
   * Delete a vaccination
   * DELETE /vaccinations/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    return await this.vaccinationsService.remove(id);
  }
}
