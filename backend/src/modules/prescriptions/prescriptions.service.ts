import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, LessThanOrEqual, Between } from 'typeorm';
import {
  Prescription,
  PrescriptionStatus,
} from './entities/prescription.entity';
import { PrescriptionRefill } from './entities/prescription-refill.entity';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { UpdatePrescriptionDto } from './dto/update-prescription.dto';
import { DosageCalculationService } from './services/dosage-calculation.service';
import {
  DrugInteractionService,
  InteractionResult,
} from '../prescriptions/services/drug-interaction.service';
import { DrugInteractionService } from '../prescriptions/services/drug-interaction.service';
import { NotificationsService } from '../notifications/notifications.service';

export interface RefillReminder {
  prescriptionId: string;
  medication: string;
  frequency: string;
  refillsRemaining: number;
  daysUntilRefill: number;
  estimatedRefillDate: Date;
  petName: string;
  petId: string;
}

export interface PrescriptionHistory {
  id: string;
  medication: string;
  dosage: string;
  frequency: string;
  startDate: Date;
  endDate: Date;
  status: PrescriptionStatus;
  refillsRemaining: number;
  refillsUsed: number;
  createdAt: Date;
}

export interface PrescriptionCreateResult {
  prescription: Prescription;
  warnings?: InteractionResult[];
}

@Injectable()
export class PrescriptionsService {
  private readonly logger = new Logger(PrescriptionsService.name);
  constructor(
    @InjectRepository(Prescription)
    private readonly prescriptionRepository: Repository<Prescription>,
    @InjectRepository(PrescriptionRefill)
    private readonly refillRepository: Repository<PrescriptionRefill>,
    private readonly dosageCalculationService: DosageCalculationService,
    private readonly drugInteractionService: DrugInteractionService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(
    createPrescriptionDto: CreatePrescriptionDto,
  ): Promise<Prescription | PrescriptionCreateResult> {
    const activePrescriptions = await this.getActivePrescriptions(
      createPrescriptionDto.petId,
    );
    const activeMedicationNames = activePrescriptions
      .map((prescription) => prescription.medication)
      .filter(Boolean);

    const interactionResults = await this.drugInteractionService.check(
      createPrescriptionDto.medication,
      activeMedicationNames,
    );

    const severeInteractions = interactionResults.filter(
      (interaction) =>
        interaction.severity === 'CONTRAINDICATED' ||
        interaction.severity === 'SEVERE',
    );

    if (severeInteractions.length > 0) {
      throw new BadRequestException({
        message:
          'Prescription cannot be created because the new medication has a high-risk interaction with existing therapy.',
        interactions: severeInteractions,
      });
    }

    const moderateInteractions = interactionResults.filter(
      (interaction) => interaction.severity === 'MODERATE',
    );
    const mildInteractions = interactionResults.filter(
      (interaction) => interaction.severity === 'MILD',
    );

    if (mildInteractions.length > 0) {
      this.logger.warn(
        `MILD interaction detected while creating prescription for pet ${createPrescriptionDto.petId}: ${mildInteractions
          .map((r) => `${r.drug1}/${r.drug2}`)
          .join(', ')}`,
      );
    }
    // Auto-calculate endDate if duration is provided
    let prescription = this.prescriptionRepository.create(
      createPrescriptionDto,
    );

    if (createPrescriptionDto.duration && !createPrescriptionDto.endDate) {
      const endDate = new Date(createPrescriptionDto.startDate);
      endDate.setDate(endDate.getDate() + createPrescriptionDto.duration);
      prescription.endDate = endDate;
    }

    // Set status based on dates
    prescription = this.updatePrescriptionStatus(prescription);

    const savedPrescription = await this.prescriptionRepository.save(prescription);

    if (moderateInteractions.length > 0) {
      return {
        prescription: savedPrescription,
        warnings: moderateInteractions,
      };
    }

    return savedPrescription;
  }

  async findAll(petId?: string): Promise<Prescription[]> {
    const where: any = {};
    if (petId) {
      where.petId = petId;
    }

    return await this.prescriptionRepository.find({
      where,
      relations: ['pet', 'vet', 'refills'],
      order: { startDate: 'DESC' },
    });
  }

  async checkDrugInteractions(
    petId: string,
    medication: string,
  ): Promise<InteractionResult[]> {
    const activePrescriptions = await this.getActivePrescriptions(petId);
    const activeMedicationNames = activePrescriptions
      .map((prescription) => prescription.medication)
      .filter(Boolean);

    return this.drugInteractionService.check(medication, activeMedicationNames);
  }

  async findOne(id: string): Promise<Prescription> {
    const prescription = await this.prescriptionRepository.findOne({
      where: { id },
      relations: ['pet', 'vet', 'refills'],
    });

    if (!prescription) {
      throw new NotFoundException(`Prescription with ID ${id} not found`);
    }

    return prescription;
  }

  async update(
    id: string,
    updatePrescriptionDto: UpdatePrescriptionDto,
  ): Promise<Prescription> {
    const prescription = await this.findOne(id);
    Object.assign(prescription, updatePrescriptionDto);

    // Recalculate endDate if duration changed
    if (updatePrescriptionDto.duration && !updatePrescriptionDto.endDate) {
      const endDate = new Date(prescription.startDate);
      endDate.setDate(endDate.getDate() + updatePrescriptionDto.duration);
      prescription.endDate = endDate;
    }

    // Update status
    const updatedPrescription = this.updatePrescriptionStatus(prescription);

    return await this.prescriptionRepository.save(updatedPrescription);
  }

  async remove(id: string): Promise<void> {
    const prescription = await this.findOne(id);
    await this.prescriptionRepository.remove(prescription);
  }

  /**
   * Get active prescriptions for a pet
   */
  async getActivePrescriptions(petId: string): Promise<Prescription[]> {
    const today = new Date();

    return await this.prescriptionRepository.find({
      where: {
        petId,
        status: PrescriptionStatus.ACTIVE,
        startDate: LessThanOrEqual(today),
      },
      relations: ['pet', 'vet', 'refills'],
      order: { startDate: 'DESC' },
    });
  }

  /**
   * Get expired prescriptions for a pet
   */
  async getExpiredPrescriptions(petId: string): Promise<Prescription[]> {
    const today = new Date();

    return await this.prescriptionRepository.find({
      where: {
        petId,
        status: PrescriptionStatus.EXPIRED,
        endDate: LessThanOrEqual(today),
      },
      relations: ['pet', 'vet', 'refills'],
      order: { endDate: 'DESC' },
    });
  }

  /**
   * Get prescription history for a pet
   */
  async getPrescriptionHistory(petId: string): Promise<PrescriptionHistory[]> {
    const prescriptions = await this.prescriptionRepository.find({
      where: { petId },
      relations: ['pet', 'vet', 'refills'],
      order: { startDate: 'DESC' },
    });

    return prescriptions.map((p) => ({
      id: p.id,
      medication: p.medication,
      dosage: p.dosage,
      frequency: p.frequency,
      startDate: p.startDate,
      endDate: p.endDate,
      status: p.status,
      refillsRemaining: p.refillsRemaining,
      refillsUsed: p.refillsUsed,
      createdAt: p.createdAt,
    }));
  }

  /**
   * Get prescriptions by status
   */
  async getPrescriptionsByStatus(
    petId: string,
    status: PrescriptionStatus,
  ): Promise<Prescription[]> {
    return await this.prescriptionRepository.find({
      where: { petId, status },
      relations: ['pet', 'vet', 'refills'],
      order: { startDate: 'DESC' },
    });
  }

  /**
   * Get upcoming refill reminders
   */
  async getRefillReminders(daysWindow: number = 7): Promise<RefillReminder[]> {
    const today = new Date();
    const windowEnd = new Date();
    windowEnd.setDate(windowEnd.getDate() + daysWindow);

    const prescriptions = await this.prescriptionRepository.find({
      where: {
        status: PrescriptionStatus.ACTIVE,
        refillsRemaining: MoreThanOrEqual(1),
        startDate: LessThanOrEqual(today),
      },
      relations: ['pet', 'vet', 'refills'],
    });

    const reminders: RefillReminder[] = [];

    for (const prescription of prescriptions) {
      const lastRefill = prescription.refills?.[0];
      const estimatedRefillDate = this.calculateNextRefillDate(
        lastRefill?.refillDate || prescription.startDate,
        prescription.frequency,
      );

      const daysUntilRefill = Math.ceil(
        (estimatedRefillDate.getTime() - today.getTime()) /
          (1000 * 60 * 60 * 24),
      );

      if (daysUntilRefill <= daysWindow && daysUntilRefill >= 0) {
        reminders.push({
          prescriptionId: prescription.id,
          medication: prescription.medication,
          frequency: prescription.frequency,
          refillsRemaining: prescription.refillsRemaining,
          daysUntilRefill,
          estimatedRefillDate,
          petName: prescription.pet.name,
          petId: prescription.petId,
        });
      }
    }

    return reminders.sort((a, b) => a.daysUntilRefill - b.daysUntilRefill);
  }

  /**
   * Record a prescription refill
   */
  async recordRefill(
    prescriptionId: string,
    quantity: number,
    pharmacyName?: string,
  ): Promise<PrescriptionRefill> {
    const prescription = await this.findOne(prescriptionId);

    if (prescription.refillsRemaining <= 0) {
      throw new Error('No refills remaining for this prescription');
    }

    const refill = this.refillRepository.create({
      prescriptionId,
      refillDate: new Date(),
      quantity,
      pharmacyName,
      expirationDate: this.calculateRefillExpiration(
        new Date(),
        prescription.duration,
      ),
    });

    const savedRefill = await this.refillRepository.save(refill);

    // Update prescription
    prescription.refillsRemaining -= 1;
    prescription.refillsUsed = (prescription.refillsUsed || 0) + 1;

    if (prescription.refillsRemaining === 0) {
      prescription.status = PrescriptionStatus.COMPLETED;
    }

    await this.prescriptionRepository.save(prescription);

    return savedRefill;
  }

  /**
   * Get refill history for a prescription
   */
  async getRefillHistory(
    prescriptionId: string,
  ): Promise<PrescriptionRefill[]> {
    return await this.refillRepository.find({
      where: { prescriptionId },
      order: { refillDate: 'DESC' },
    });
  }

  /**
   * Get all refills for a pet
   */
  async getPetRefillHistory(petId: string): Promise<PrescriptionRefill[]> {
    return await this.refillRepository
      .createQueryBuilder('refill')
      .leftJoinAndSelect('refill.prescription', 'prescription')
      .where('prescription.petId = :petId', { petId })
      .orderBy('refill.refillDate', 'DESC')
      .getMany();
  }

  /**
   * Check if prescription needs refill
   */
  async checkRefillNeeded(prescriptionId: string): Promise<boolean> {
    const prescription = await this.findOne(prescriptionId);
    return (
      prescription.refillsRemaining > 0 &&
      prescription.status === PrescriptionStatus.ACTIVE
    );
  }

  /**
   * Get prescriptions expiring soon
   */
  async getExpiringPrescriptions(
    daysWindow: number = 30,
  ): Promise<Prescription[]> {
    const today = new Date();
    const windowEnd = new Date();
    windowEnd.setDate(windowEnd.getDate() + daysWindow);

    return await this.prescriptionRepository.find({
      where: {
        status: PrescriptionStatus.ACTIVE,
        endDate: Between(today, windowEnd),
      },
      relations: ['pet', 'vet', 'refills'],
      order: { endDate: 'ASC' },
    });
  }

  /**
   * Discontinue a prescription
   */
  async discontinuePrescription(
    prescriptionId: string,
    reason?: string,
  ): Promise<Prescription> {
    const prescription = await this.findOne(prescriptionId);
    prescription.status = PrescriptionStatus.DISCONTINUED;
    prescription.notes =
      (prescription.notes || '') +
      `\nDiscontinued: ${reason || 'No reason provided'}`;
    return await this.prescriptionRepository.save(prescription);
  }

  /**
   * Private helper methods
   */
  private updatePrescriptionStatus(prescription: Prescription): Prescription {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startDate = new Date(prescription.startDate);
    startDate.setHours(0, 0, 0, 0);

    const endDate = prescription.endDate
      ? new Date(prescription.endDate)
      : null;
    if (endDate) {
      endDate.setHours(0, 0, 0, 0);
    }

    if (prescription.status === PrescriptionStatus.DISCONTINUED) {
      return prescription;
    }

    if (endDate && today > endDate) {
      prescription.status = PrescriptionStatus.EXPIRED;
    } else if (today < startDate) {
      prescription.status = PrescriptionStatus.PENDING;
    } else if (!endDate || today <= endDate) {
      prescription.status = PrescriptionStatus.ACTIVE;
    }

    return prescription;
  }

  private calculateNextRefillDate(lastDate: Date, frequency: string): Date {
    const nextRefill = new Date(lastDate);

    // Estimate based on frequency
    if (frequency.includes('once daily')) {
      nextRefill.setDate(nextRefill.getDate() + 30); // Typical 30-day supply
    } else if (frequency.includes('twice daily') || frequency.includes('2x')) {
      nextRefill.setDate(nextRefill.getDate() + 15); // Typical 15-day supply
    } else if (frequency.includes('three times') || frequency.includes('3x')) {
      nextRefill.setDate(nextRefill.getDate() + 10); // Typical 10-day supply
    } else {
      nextRefill.setDate(nextRefill.getDate() + 30); // Default to 30 days
    }

    return nextRefill;
  }

  private calculateRefillExpiration(
    refillDate: Date,
    durationDays?: number,
  ): Date {
    const expiration = new Date(refillDate);
    const days = durationDays || 30; // Default 30-day supply
    expiration.setDate(expiration.getDate() + days);
    return expiration;
  }
}

  async getRefillReminders(daysWindow: number = 7): Promise<RefillReminder[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() + daysWindow);

    const prescriptions = await this.prescriptionRepository.find({
      where: {
        status: PrescriptionStatus.ACTIVE,
        refillsRemaining: MoreThanOrEqual(1),
      },
      relations: ['pet'],
    });

    const reminders: RefillReminder[] = [];

    for (const prescription of prescriptions) {
      // Calculate days until next refill based on frequency
      const frequencyDays = this.parseFrequencyToDays(prescription.frequency);
      if (!frequencyDays) continue;

      const lastRefill = await this.refillRepository.findOne({
        where: { prescriptionId: prescription.id },
        order: { refillDate: 'DESC' },
      });

      const lastRefillDate = lastRefill?.refillDate || prescription.startDate;
      const nextRefillDate = new Date(lastRefillDate);
      nextRefillDate.setDate(nextRefillDate.getDate() + frequencyDays);

      const daysUntilRefill = Math.ceil(
        (nextRefillDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysUntilRefill <= daysWindow && daysUntilRefill >= 0) {
        reminders.push({
          prescriptionId: prescription.id,
          medication: prescription.medication,
          frequency: prescription.frequency,
          refillsRemaining: prescription.refillsRemaining,
          daysUntilRefill,
          estimatedRefillDate: nextRefillDate,
          petName: prescription.pet.name,
          petId: prescription.pet.id,
        });
      }
    }

    return reminders;
  }

  private parseFrequencyToDays(frequency: string): number | null {
    const freq = frequency.toLowerCase();
    if (freq.includes('daily') || freq.includes('once a day')) return 1;
    if (freq.includes('twice a day') || freq.includes('bid')) return 0.5;
    if (freq.includes('three times') || freq.includes('tid')) return 0.33;
    if (freq.includes('weekly') || freq.includes('once a week')) return 7;
    if (freq.includes('monthly') || freq.includes('once a month')) return 30;
    
    // Try to extract number from frequency string
    const match = freq.match(/(\d+)\s*(day|week|month)/);
    if (match) {
      const num = parseInt(match[1]);
      const unit = match[2];
      if (unit === 'day') return num;
      if (unit === 'week') return num * 7;
      if (unit === 'month') return num * 30;
    }
    
    return null;
  }
}