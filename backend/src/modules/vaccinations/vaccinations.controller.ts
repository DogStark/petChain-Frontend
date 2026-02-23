import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { VaccinationsService } from './vaccinations.service';
import { VaccinationCertificateService } from './services/vaccination-certificate.service';
import { VaccinationReminderService } from './services/vaccination-reminder.service';
import { CreateVaccinationDto } from './dto/create-vaccination.dto';
import { UpdateVaccinationDto } from './dto/update-vaccination.dto';
import { CreateVaccinationReactionDto } from './dto/create-vaccination-reaction.dto';
import { UpdateVaccinationReactionDto } from './dto/update-vaccination-reaction.dto';
import { Vaccination } from './entities/vaccination.entity';
import { VaccinationReaction } from './entities/vaccination-reaction.entity';

@Controller('vaccinations')
export class VaccinationsController {
  constructor(
    private readonly vaccinationsService: VaccinationsService,
    private readonly certificateService: VaccinationCertificateService,
    private readonly reminderService: VaccinationReminderService,
  ) {}

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
   * Get upcoming vaccination reminders
   * GET /vaccinations/reminders?days=30
   */
  @Get('reminders')
  async getReminders(@Query('days') days?: number) {
    return await this.vaccinationsService.getUpcomingReminders(
      days ? +days : 30,
    );
  }

  /**
   * Get overdue vaccinations
   * GET /vaccinations/overdue?petId=xxx
   */
  @Get('overdue')
  async getOverdue(@Query('petId') petId?: string) {
    return await this.vaccinationsService.getOverdueVaccinations(petId);
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
   * Get vaccination by certificate code
   * GET /vaccinations/certificate/:code
   */
  @Get('certificate/:code')
  async findByCertificateCode(
    @Param('code') code: string,
  ): Promise<Vaccination> {
    return await this.vaccinationsService.findByCertificateCode(code);
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

  /**
   * Mark reminder as sent for a vaccination
   * PATCH /vaccinations/:id/reminder-sent
   */
  @Patch(':id/reminder-sent')
  async markReminderSent(
    @Param('id') id: string,
  ): Promise<Vaccination> {
    return await this.vaccinationsService.markReminderSent(id);
  }

  // ============================================================================
  // VACCINATION CERTIFICATE ENDPOINTS
  // ============================================================================

  /**
   * Generate vaccination certificate PDF
   * POST /vaccinations/:id/certificate
   */
  @Post(':id/certificate')
  @HttpCode(HttpStatus.CREATED)
  async generateCertificate(
    @Param('id') vaccinationId: string,
  ): Promise<{ url: string; fileName: string }> {
    return await this.certificateService.generateAndSaveCertificate(
      vaccinationId,
    );
  }

  /**
   * Download vaccination certificate PDF
   * GET /vaccinations/:id/certificate/download
   */
  @Get(':id/certificate/download')
  async downloadCertificate(
    @Param('id') vaccinationId: string,
    @Res() res: Response,
  ): Promise<void> {
    const buffer = await this.certificateService.generateCertificate(
      vaccinationId,
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="vaccination-certificate-${vaccinationId}.pdf"`,
    );
    res.send(buffer);
  }

  /**
   * Get certificate file by filename
   * GET /vaccinations/certificate-file/:fileName
   */
  @Get('certificate-file/:fileName')
  async getCertificateFile(
    @Param('fileName') fileName: string,
    @Res() res: Response,
  ): Promise<void> {
    const buffer = await this.certificateService.getCertificateFile(fileName);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${fileName}"`,
    );
    res.send(buffer);
  }

  // ============================================================================
  // VACCINATION REMINDER ENDPOINTS
  // ============================================================================

  /**
   * Get reminder status for a vaccination
   * GET /vaccinations/:id/reminder-status
   */
  @Get(':id/reminder-status')
  async getReminderStatus(@Param('id') vaccinationId: string) {
    const vaccination = await this.vaccinationsService.findOne(vaccinationId);
    return this.reminderService.getReminderStatus(vaccination);
  }

  /**
   * Get vaccinations needing reminders
   * GET /vaccinations/reminders/needing-reminders?days=7
   */
  @Get('reminders/needing-reminders')
  async getVaccinationsNeedingReminders(
    @Query('days') days?: number,
  ): Promise<Vaccination[]> {
    return await this.reminderService.getVaccinationsNeedingReminders(
      days ? +days : 7,
    );
  }

  /**
   * Get overdue vaccinations for reminders
   * GET /vaccinations/reminders/overdue
   */
  @Get('reminders/overdue')
  async getOverdueForReminders(): Promise<Vaccination[]> {
    return await this.reminderService.getOverdueVaccinations();
  }

  /**
   * Send reminder for a vaccination
   * POST /vaccinations/:id/send-reminder
   */
  @Post(':id/send-reminder')
  async sendReminder(
    @Param('id') vaccinationId: string,
    @Query('userId') userId: string,
  ) {
    const vaccination = await this.vaccinationsService.findOne(vaccinationId);
    return await this.reminderService.sendReminder(vaccination, userId);
  }

  /**
   * Process reminders for a pet
   * POST /vaccinations/pet/:petId/process-reminders
   */
  @Post('pet/:petId/process-reminders')
  async processReminders(
    @Param('petId') petId: string,
  ): Promise<Vaccination[]> {
    return await this.reminderService.processRemindersForPet(petId);
  }

  /**
   * Send batch reminders
   * POST /vaccinations/reminders/send-batch
   */
  @Post('reminders/send-batch')
  async sendBatchReminders(
    @Query('days') days?: number,
    @Query('userId') userId?: string,
  ) {
    const vaccinations = await this.reminderService.getVaccinationsNeedingReminders(
      days ? +days : 7,
    );
    return await this.reminderService.sendBatchReminders(
      vaccinations,
      userId || 'system',
    );
  }

  // ============================================================================
  // VACCINATION REACTION ENDPOINTS
  // ============================================================================

  /**
   * Add an adverse reaction to a vaccination
   * POST /vaccinations/:id/reactions
   */
  @Post(':id/reactions')
  @HttpCode(HttpStatus.CREATED)
  async addReaction(
    @Param('id') vaccinationId: string,
    @Body() createReactionDto: CreateVaccinationReactionDto,
  ): Promise<VaccinationReaction> {
    return await this.vaccinationsService.addReaction(
      vaccinationId,
      createReactionDto,
    );
  }

  /**
   * Get reactions for a vaccination
   * GET /vaccinations/:id/reactions
   */
  @Get(':id/reactions')
  async getReactions(
    @Param('id') vaccinationId: string,
  ): Promise<VaccinationReaction[]> {
    return await this.vaccinationsService.getReactions(vaccinationId);
  }

  /**
   * Update a reaction
   * PATCH /vaccinations/reactions/:reactionId
   */
  @Patch('reactions/:reactionId')
  async updateReaction(
    @Param('reactionId') reactionId: string,
    @Body() updateReactionDto: UpdateVaccinationReactionDto,
  ): Promise<VaccinationReaction> {
    return await this.vaccinationsService.updateReaction(
      reactionId,
      updateReactionDto,
    );
  }

  /**
   * Delete a reaction
   * DELETE /vaccinations/reactions/:reactionId
   */
  @Delete('reactions/:reactionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeReaction(@Param('reactionId') reactionId: string): Promise<void> {
    return await this.vaccinationsService.removeReaction(reactionId);
  }
}
