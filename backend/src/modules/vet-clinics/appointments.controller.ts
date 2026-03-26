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
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { Appointment } from './entities/appointment.entity';

@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  /**
   * Create a new appointment
   * POST /appointments
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createAppointmentDto: CreateAppointmentDto,
  ): Promise<Appointment> {
    return await this.appointmentsService.create(createAppointmentDto);
  }

  /**
   * Get all appointments
   * GET /appointments
   */
  @Get()
  async findAll(): Promise<Appointment[]> {
    return await this.appointmentsService.findAll();
  }

  /**
   * Get appointments by pet
   * GET /appointments/pet/:petId
   */
  @Get('pet/:petId')
  async findByPet(@Param('petId') petId: string): Promise<Appointment[]> {
    return await this.appointmentsService.findByPet(petId);
  }

  /**
   * Get appointments by clinic
   * GET /appointments/clinic/:clinicId
   */
  @Get('clinic/:clinicId')
  async findByClinic(
    @Param('clinicId') clinicId: string,
  ): Promise<Appointment[]> {
    return await this.appointmentsService.findByClinic(clinicId);
  }

  /**
   * Get upcoming appointments
   * GET /appointments/upcoming
   */
  @Get('upcoming')
  async findUpcoming(@Query('petId') petId?: string): Promise<Appointment[]> {
    return await this.appointmentsService.findUpcoming(petId);
  }

  /**
   * Get a single appointment
   * GET /appointments/:id
   */
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Appointment> {
    return await this.appointmentsService.findOne(id);
  }

  /**
   * Update an appointment
   * PATCH /appointments/:id
   */
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateAppointmentDto: UpdateAppointmentDto,
  ): Promise<Appointment> {
    return await this.appointmentsService.update(id, updateAppointmentDto);
  }

  /**
   * Confirm an appointment
   * POST /appointments/:id/confirm
   */
  @Post(':id/confirm')
  async confirm(@Param('id') id: string): Promise<Appointment> {
    return await this.appointmentsService.confirm(id);
  }

  /**
   * Complete an appointment
   * POST /appointments/:id/complete
   */
  @Post(':id/complete')
  async complete(@Param('id') id: string): Promise<Appointment> {
    return await this.appointmentsService.complete(id);
  }

  /**
   * Cancel an appointment
   * POST /appointments/:id/cancel
   */
  @Post(':id/cancel')
  async cancel(@Param('id') id: string): Promise<Appointment> {
    return await this.appointmentsService.cancel(id);
  }

  /**
   * Delete an appointment
   * DELETE /appointments/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    return await this.appointmentsService.remove(id);
  }
}
