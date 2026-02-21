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
import { AppointmentWaitlistService } from './appointment-waitlist.service';
import { CreateAppointmentWaitlistEntryDto } from './dto/create-appointment-waitlist-entry.dto';
import { UpdateAppointmentWaitlistEntryDto } from './dto/update-appointment-waitlist-entry.dto';
import { AppointmentWaitlistEntry } from './entities/appointment-waitlist-entry.entity';

@Controller('appointment-waitlist')
export class AppointmentWaitlistController {
  constructor(
    private readonly appointmentWaitlistService: AppointmentWaitlistService,
  ) {}

  /**
   * Join the waitlist
   * POST /appointment-waitlist
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async join(
    @Body() dto: CreateAppointmentWaitlistEntryDto,
  ): Promise<AppointmentWaitlistEntry> {
    return await this.appointmentWaitlistService.join(dto);
  }

  /**
   * List waitlist entries (filter by clinic or pet)
   * GET /appointment-waitlist
   */
  @Get()
  async findAll(
    @Query('vetClinicId') vetClinicId?: string,
    @Query('petId') petId?: string,
    @Query('includeExpired') includeExpired?: string,
  ): Promise<AppointmentWaitlistEntry[]> {
    return await this.appointmentWaitlistService.findAll({
      vetClinicId,
      petId,
      includeExpired: includeExpired === 'true',
    });
  }

  /**
   * Get a single waitlist entry
   * GET /appointment-waitlist/:id
   */
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<AppointmentWaitlistEntry> {
    return await this.appointmentWaitlistService.findOne(id);
  }

  /**
   * Update priority or expiry
   * PATCH /appointment-waitlist/:id
   */
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateAppointmentWaitlistEntryDto,
  ): Promise<AppointmentWaitlistEntry> {
    return await this.appointmentWaitlistService.update(id, dto);
  }

  /**
   * Remove from waitlist
   * DELETE /appointment-waitlist/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    return await this.appointmentWaitlistService.remove(id);
  }
}
