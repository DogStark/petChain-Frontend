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
import { VaccinationSchedulesService } from './vaccination-schedules.service';
import { CreateVaccinationScheduleDto } from './dto/create-vaccination-schedule.dto';
import { UpdateVaccinationScheduleDto } from './dto/update-vaccination-schedule.dto';
import { VaccinationSchedule } from './entities/vaccination-schedule.entity';

@Controller('vaccination-schedules')
export class VaccinationSchedulesController {
  constructor(private readonly schedulesService: VaccinationSchedulesService) {}

  /**
   * Create a new vaccination schedule
   * POST /vaccination-schedules
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createScheduleDto: CreateVaccinationScheduleDto,
  ): Promise<VaccinationSchedule> {
    return await this.schedulesService.create(createScheduleDto);
  }

  /**
   * Get all vaccination schedules
   * GET /vaccination-schedules
   */
  @Get()
  async findAll(): Promise<VaccinationSchedule[]> {
    return await this.schedulesService.findAll();
  }

  /**
   * Get vaccination schedules by breed
   * GET /vaccination-schedules/breed/:breedId
   */
  @Get('breed/:breedId')
  async findByBreed(
    @Param('breedId') breedId: string,
  ): Promise<VaccinationSchedule[]> {
    return await this.schedulesService.findByBreed(breedId);
  }

  /**
   * Get general (non-breed-specific) schedules
   * GET /vaccination-schedules/general
   */
  @Get('general')
  async findGeneral(): Promise<VaccinationSchedule[]> {
    return await this.schedulesService.findGeneral();
  }

  /**
   * Seed default dog vaccination schedules
   * POST /vaccination-schedules/seed/dogs
   */
  @Post('seed/dogs')
  async seedDogSchedules(): Promise<VaccinationSchedule[]> {
    return await this.schedulesService.seedDefaultDogSchedules();
  }

  /**
   * Seed default cat vaccination schedules
   * POST /vaccination-schedules/seed/cats
   */
  @Post('seed/cats')
  async seedCatSchedules(): Promise<VaccinationSchedule[]> {
    return await this.schedulesService.seedDefaultCatSchedules();
  }

  /**
   * Get a single schedule by ID
   * GET /vaccination-schedules/:id
   */
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<VaccinationSchedule> {
    return await this.schedulesService.findOne(id);
  }

  /**
   * Update a vaccination schedule
   * PATCH /vaccination-schedules/:id
   */
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateScheduleDto: UpdateVaccinationScheduleDto,
  ): Promise<VaccinationSchedule> {
    return await this.schedulesService.update(id, updateScheduleDto);
  }

  /**
   * Delete a vaccination schedule
   * DELETE /vaccination-schedules/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    return await this.schedulesService.remove(id);
  }
}
