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
import { ReminderService } from './reminder.service';
import { BatchProcessingService } from './batch-processing.service';
import { CreateReminderDto } from './dto/create-reminder.dto';
import { UpdateReminderDto } from './dto/update-reminder.dto';
import { SnoozeReminderDto } from './dto/snooze-reminder.dto';
import { SetReminderIntervalsDto } from './dto/set-reminder-intervals.dto';
import { VaccinationReminder } from './entities/vaccination-reminder.entity';

@Controller('reminders')
export class RemindersController {
  constructor(
    private readonly reminderService: ReminderService,
    private readonly batchProcessingService: BatchProcessingService,
  ) {}

  /**
   * Create a new reminder
   * POST /reminders
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createReminderDto: CreateReminderDto,
  ): Promise<VaccinationReminder> {
    return await this.reminderService.create(createReminderDto);
  }

  /**
   * Get all reminders
   * GET /reminders
   */
  @Get()
  async findAll(
    @Query('ownerId') ownerId?: string,
  ): Promise<VaccinationReminder[]> {
    if (ownerId) {
      return await this.reminderService.findByOwner(ownerId);
    }
    return await this.reminderService.findAll();
  }

  /**
   * Get reminders by pet
   * GET /reminders/pet/:petId
   */
  @Get('pet/:petId')
  async findByPet(
    @Param('petId') petId: string,
  ): Promise<VaccinationReminder[]> {
    return await this.reminderService.findByPet(petId);
  }

  /**
   * Get upcoming reminders
   * GET /reminders/upcoming
   */
  @Get('upcoming')
  async findUpcoming(
    @Query('days') days?: string,
  ): Promise<VaccinationReminder[]> {
    const daysAhead = days ? parseInt(days, 10) : 30;
    return await this.reminderService.findUpcoming(daysAhead);
  }

  /**
   * Get reminder statistics
   * GET /reminders/stats
   */
  @Get('stats')
  async getStatistics() {
    return await this.batchProcessingService.getStatistics();
  }

  /**
   * Generate reminders for a pet
   * POST /reminders/generate/:petId
   */
  @Post('generate/:petId')
  async generateForPet(
    @Param('petId') petId: string,
  ): Promise<VaccinationReminder[]> {
    return await this.reminderService.generateRemindersForPet(petId);
  }

  /**
   * Trigger batch processing of all reminders
   * POST /reminders/batch/process
   */
  @Post('batch/process')
  async batchProcess() {
    return await this.batchProcessingService.processAllPendingReminders();
  }

  /**
   * Generate reminders for all pets
   * POST /reminders/batch/generate
   */
  @Post('batch/generate')
  async batchGenerate() {
    return await this.batchProcessingService.generateRemindersForAllPets();
  }

  /**
   * Cleanup old reminders
   * POST /reminders/batch/cleanup
   */
  @Post('batch/cleanup')
  async batchCleanup(@Query('days') days?: string) {
    const olderThanDays = days ? parseInt(days, 10) : 365;
    const count =
      await this.batchProcessingService.cleanupExpiredReminders(olderThanDays);
    return { cleanedUp: count };
  }

  /**
   * Get a single reminder
   * GET /reminders/:id
   */
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<VaccinationReminder> {
    return await this.reminderService.findOne(id);
  }

  /**
   * Update a reminder
   * PATCH /reminders/:id
   */
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateReminderDto: UpdateReminderDto,
  ): Promise<VaccinationReminder> {
    return await this.reminderService.update(id, updateReminderDto);
  }

  /**
   * Mark reminder as complete
   * POST /reminders/:id/complete
   */
  @Post(':id/complete')
  async markComplete(
    @Param('id') id: string,
    @Query('vaccinationId') vaccinationId?: string,
  ): Promise<VaccinationReminder> {
    return await this.reminderService.markComplete(id, vaccinationId);
  }

  /**
   * Snooze a reminder
   * POST /reminders/:id/snooze
   */
  @Post(':id/snooze')
  async snooze(
    @Param('id') id: string,
    @Body() snoozeDto: SnoozeReminderDto,
  ): Promise<VaccinationReminder> {
    return await this.reminderService.snooze(id, snoozeDto.days || 1);
  }

  /**
   * Set custom reminder intervals
   * PATCH /reminders/:id/intervals
   */
  @Patch(':id/intervals')
  async setIntervals(
    @Param('id') id: string,
    @Body() intervalsDto: SetReminderIntervalsDto,
  ): Promise<VaccinationReminder> {
    return await this.reminderService.setCustomIntervals(
      id,
      intervalsDto.intervals,
    );
  }

  /**
   * Delete a reminder
   * DELETE /reminders/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    return await this.reminderService.remove(id);
  }
}
