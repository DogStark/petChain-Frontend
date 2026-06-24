import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { VetClinicsService } from './vet-clinics.service';
import { AppointmentsService } from './appointments.service';
import { CreateVetClinicDto } from './dto/create-vet-clinic.dto';
import { UpdateVetClinicDto } from './dto/update-vet-clinic.dto';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { VetClinic } from './entities/vet-clinic.entity';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RoleName } from '../../auth/constants/roles.enum';

@Controller('vet-clinics')
export class VetClinicsController {
  constructor(
    private readonly vetClinicsService: VetClinicsService,
    private readonly appointmentsService: AppointmentsService,
  ) {}

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

  /**
   * GET /vet-clinics/:id/availability?date=YYYY-MM-DD
   * Returns available ISO datetime slots after subtracting booked appointments.
   */
  @Get(':id/availability')
  async getAvailability(
    @Param('id') clinicId: string,
    @Query('date') date: string,
  ): Promise<string[]> {
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new BadRequestException('date query param must be YYYY-MM-DD');
    }
    const booked = await this.appointmentsService.getBookedTimesForClinicOnDate(clinicId, date);
    return this.vetClinicsService.getAvailableSlots(clinicId, date, booked);
  }

  /**
   * POST /vet-clinics/:id/schedule  (VET or ADMIN only)
   */
  @Post(':id/schedule')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.Veterinarian, RoleName.Admin)
  async createSchedule(
    @Param('id') clinicId: string,
    @Body() dto: CreateScheduleDto,
  ) {
    return this.vetClinicsService.createSchedule(clinicId, dto);
  }

  /**
   * PUT /vet-clinics/:id/schedule/:scheduleId  (VET or ADMIN only)
   */
  @Patch(':id/schedule/:scheduleId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.Veterinarian, RoleName.Admin)
  async updateSchedule(
    @Param('id') clinicId: string,
    @Param('scheduleId') scheduleId: string,
    @Body() dto: Partial<CreateScheduleDto>,
  ) {
    return this.vetClinicsService.updateSchedule(clinicId, scheduleId, dto);
  }

  /**
   * DELETE /vet-clinics/:id/schedule/:scheduleId  (VET or ADMIN only)
   */
  @Delete(':id/schedule/:scheduleId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.Veterinarian, RoleName.Admin)
  async removeSchedule(
    @Param('id') clinicId: string,
    @Param('scheduleId') scheduleId: string,
  ): Promise<void> {
    return this.vetClinicsService.removeSchedule(clinicId, scheduleId);
  }
}
