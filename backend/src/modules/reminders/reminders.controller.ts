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
import { Reminder } from './entities/reminder.entity';

@Controller('reminders')
export class RemindersController {
  constructor(
    private readonly reminderService: ReminderService,
    private readonly batchProcessingService: BatchProcessingService,
  ) {}

  /**
   * Create a new reminder
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createReminderDto: CreateReminderDto,
  ): Promise<Reminder> {
    return await this.reminderService.create(createReminderDto);
  }

  /**
   * Get all reminders or by user
   */
  @Get()
  async findAll(@Query('userId') userId?: string): Promise<Reminder[]> {
    if (userId) {
      return await this.reminderService.findByUser(userId);
    }
    return await this.reminderService.findAll();
  }

  /**
   * Get reminders by pet
   */
  @Get('pet/:petId')
  async findByPet(@Param('petId') petId: string): Promise<Reminder[]> {
    return await this.reminderService.findByPet(petId);
  }

  /**
   * Get upcoming reminders
   */
  @Get('upcoming')
  async findUpcoming(@Query('days') days?: string): Promise<Reminder[]> {
    const daysAhead = days ? parseInt(days, 10) : 30;
    return await this.reminderService.findUpcoming(daysAhead);
  }

  /**
   * Get reminder statistics
   */
  @Get('statistics')
  async getStatistics() {
    return await this.batchProcessingService.getStatistics();
  }

  /**
   * Generate vaccination reminders for a pet
   */
  @Post('generate/vaccinations/:petId')
  async generateVaccinationsForPet(
    @Param('petId') petId: string,
  ): Promise<Reminder[]> {
    return await this.reminderService.generateVaccinationReminders(petId);
  }

  /**
   * Trigger batch processing of all reminders
   */
  @Post('batch/process')
  async batchProcess() {
    return await this.batchProcessingService.processAllPendingReminders();
  }

  /**
   * Generate reminders for all pets
   */
  @Post('batch/generate')
  async batchGenerate() {
    return await this.batchProcessingService.generateRemindersForAllPets();
  }

  /**
   * Get a single reminder
   */
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Reminder> {
    return await this.reminderService.findOne(id);
  }

  /**
   * Update a reminder
   */
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateReminderDto: UpdateReminderDto,
  ): Promise<Reminder> {
    return await this.reminderService.update(id, updateReminderDto);
  }

  /**
   * Mark reminder as complete
   */
  @Post(':id/complete')
  async markComplete(
    @Param('id') id: string,
    @Body() metadataUpdate?: any,
  ): Promise<Reminder> {
    return await this.reminderService.markComplete(id, metadataUpdate);
  }

  /**
   * Snooze a reminder
   */
  @Post(':id/snooze')
  async snooze(
    @Param('id') id: string,
    @Body() snoozeDto: SnoozeReminderDto,
  ): Promise<Reminder> {
    return await this.reminderService.snooze(id, snoozeDto.days || 1);
  }

  /**
   * Delete a reminder
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    return await this.reminderService.remove(id);
  }
}
