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
} from '@nestjs/common';
import { PrescriptionsService, RefillReminder } from './prescriptions.service';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { UpdatePrescriptionDto } from './dto/update-prescription.dto';
import { DosageCalculationService } from './services/dosage-calculation.service';
import type { DosageCalculationRequest, DosageResult } from './services/dosage-calculation.service';
import { DrugInteractionService } from '../prescriptions/services/drug-interaction.service';
import { PrescriptionStatus } from './entities/prescription.entity';

@Controller('prescriptions')
export class PrescriptionsController {
  constructor(
    private readonly prescriptionsService: PrescriptionsService,
    private readonly dosageCalculationService: DosageCalculationService,
    private readonly drugInteractionService: DrugInteractionService,
  ) {}

  @Post()
  create(@Body() createPrescriptionDto: CreatePrescriptionDto) {
    return this.prescriptionsService.create(createPrescriptionDto);
  }

  @Get()
  findAll(@Query('petId') petId?: string) {
    return this.prescriptionsService.findAll(petId);
  }

  @Get('pet/:petId/active')
  getActive(@Param('petId') petId: string) {
    return this.prescriptionsService.getActivePrescriptions(petId);
  }

  @Get('pet/:petId/expired')
  getExpired(@Param('petId') petId: string) {
    return this.prescriptionsService.getExpiredPrescriptions(petId);
  }

  @Get('pet/:petId/history')
  getHistory(@Param('petId') petId: string) {
    return this.prescriptionsService.getPrescriptionHistory(petId);
  }

  @Get('pet/:petId/expiring-soon')
  getExpiringSoon(
    @Param('petId') petId: string,
    @Query('days') days?: number,
  ) {
    return this.prescriptionsService.getExpiringPrescriptions(days ? +days : 30);
  }

  @Get('pet/:petId/status/:status')
  getByStatus(
    @Param('petId') petId: string,
    @Param('status') status: PrescriptionStatus,
  ) {
    return this.prescriptionsService.getPrescriptionsByStatus(petId, status);
  }

  @Get('reminders')
  getRefillReminders(@Query('days') days?: number) {
    return this.prescriptionsService.getRefillReminders(
      days ? +days : 7,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.prescriptionsService.findOne(id);
  }

  @Get(':id/refill-history')
  getRefillHistory(@Param('id') id: string) {
    return this.prescriptionsService.getRefillHistory(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updatePrescriptionDto: UpdatePrescriptionDto,
  ) {
    return this.prescriptionsService.update(id, updatePrescriptionDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.prescriptionsService.remove(id);
  }

  /**
   * Dosage Calculation Endpoints
   */
  @Post(':id/calculate-dosage')
  calculateDosage(
    @Param('id') id: string,
    @Body() request: DosageCalculationRequest,
  ): DosageResult {
    return this.dosageCalculationService.calculateDosage(request);
  }

  @Post('calculate-dosage/validate')
  validateDosage(
    @Body()
    body: {
      medicationName: string;
      dosage: number;
      petWeight: number;
    },
  ) {
    return this.dosageCalculationService.validateDosage(
      body.medicationName,
      body.dosage,
      body.petWeight,
    );
  }

  @Get('calculate-dosage/frequencies')
  getMedicationFrequencies() {
    return this.dosageCalculationService.getMedicationFrequencies();
  }

  /**
   * Refill Management Endpoints
   */
  @Post(':id/record-refill')
  @HttpCode(HttpStatus.CREATED)
  recordRefill(
    @Param('id') id: string,
    @Body() body: { quantity: number; pharmacyName?: string },
  ) {
    return this.prescriptionsService.recordRefill(
      id,
      body.quantity,
      body.pharmacyName,
    );
  }

  @Get(':id/check-refill-needed')
  checkRefillNeeded(@Param('id') id: string) {
    return this.prescriptionsService.checkRefillNeeded(id);
  }

  @Get('pet/:petId/refill-history')
  getPetRefillHistory(@Param('petId') petId: string) {
    return this.prescriptionsService.getPetRefillHistory(petId);
  }

  /**
   * Drug Interaction Endpoints
   */
  @Post('check-interactions')
  checkInteractions(@Body() body: { medicationNames: string[] }) {
    return this.drugInteractionService.checkInteractions(
      body.medicationNames,
    );
  }

  @Get(':id/interactions')
  getInteractions(@Param('id') id: string) {
    return this.drugInteractionService.getInteractionsByMedication(id);
  }

  /**
   * Prescription Status Management
   */
  @Patch(':id/discontinue')
  discontinue(
    @Param('id') id: string,
    @Body() body?: { reason?: string },
  ) {
    return this.prescriptionsService.discontinuePrescription(
      id,
      body?.reason,
    );
  }
}
