import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
<<<<<<< HEAD
  Query,
=======
  HttpCode,
  HttpStatus,
>>>>>>> 2740dfc9f1ae7475a6ba260b78e15df3336d9c8b
} from '@nestjs/common';
import { VaccinationsService } from './vaccinations.service';
import { CreateVaccinationDto } from './dto/create-vaccination.dto';
import { UpdateVaccinationDto } from './dto/update-vaccination.dto';
<<<<<<< HEAD
=======
import { Vaccination } from './entities/vaccination.entity';
>>>>>>> 2740dfc9f1ae7475a6ba260b78e15df3336d9c8b

@Controller('vaccinations')
export class VaccinationsController {
  constructor(private readonly vaccinationsService: VaccinationsService) {}

<<<<<<< HEAD
  @Post()
  create(@Body() createVaccinationDto: CreateVaccinationDto) {
    return this.vaccinationsService.create(createVaccinationDto);
  }

  @Get()
  findAll(@Query('petId') petId?: string) {
    return this.vaccinationsService.findAll(petId);
  }

  @Get('reminders')
  getReminders(@Query('days') days?: number) {
    return this.vaccinationsService.getUpcomingReminders(days ? +days : 30);
  }

  @Get('overdue')
  getOverdue(@Query('petId') petId?: string) {
    return this.vaccinationsService.getOverdueVaccinations(petId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.vaccinationsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateVaccinationDto: UpdateVaccinationDto,
  ) {
    return this.vaccinationsService.update(id, updateVaccinationDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.vaccinationsService.remove(id);
=======
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
>>>>>>> 2740dfc9f1ae7475a6ba260b78e15df3336d9c8b
  }
}
