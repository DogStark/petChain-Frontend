import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { Pet } from '../entities/pet.entity';
import { TimelineShare } from '../entities/timeline-share.entity';
import { Vaccination } from '../../vaccinations/entities/vaccination.entity';
import { MedicalRecord } from '../../medical-records/entities/medical-record.entity';
import { Prescription } from '../../prescriptions/entities/prescription.entity';
import { Appointment } from '../../appointments/entities/appointment.entity';
import { Allergy } from '../../allergies/entities/allergy.entity';
import {
  GetTimelineQueryDto,
  ShareTimelineDto,
  TimelineEventType,
  TimelineEventDto,
  PetTimelineResponseDto,
  TimelineSortOrder,
} from '../dto/pet-timeline.dto';

@Injectable()
export class PetTimelineService {
  constructor(
    @InjectRepository(Pet)
    private readonly petRepository: Repository<Pet>,
    @InjectRepository(TimelineShare)
    private readonly timelineShareRepository: Repository<TimelineShare>,
    @InjectRepository(Vaccination)
    private readonly vaccinationRepository: Repository<Vaccination>,
    @InjectRepository(MedicalRecord)
    private readonly medicalRecordRepository: Repository<MedicalRecord>,
    @InjectRepository(Prescription)
    private readonly prescriptionRepository: Repository<Prescription>,
    @InjectRepository(Appointment)
    private readonly appointmentRepository: Repository<Appointment>,
    @InjectRepository(Allergy)
    private readonly allergyRepository: Repository<Allergy>,
  ) {}

  /**
   * Get chronological timeline of all medical events for a pet
   */
  async getTimeline(
    petId: string,
    query: GetTimelineQueryDto,
  ): Promise<PetTimelineResponseDto> {
    // Verify pet exists
    const pet = await this.petRepository.findOne({ where: { id: petId } });
    if (!pet) {
      throw new NotFoundException(`Pet with ID ${petId} not found`);
    }

    const events: TimelineEventDto[] = [];
    const { 
      eventType, 
      startDate, 
      endDate, 
      sortOrder, 
      limit = 50, 
      offset = 0 
    } = query;

    // Build date filter
    const dateFilter = this.buildDateFilter(startDate, endDate);

    // Fetch events based on type filter
    if (eventType === TimelineEventType.ALL || eventType === TimelineEventType.VACCINATION) {
      const vaccinations = await this.fetchVaccinations(petId, dateFilter);
      events.push(...vaccinations);
    }

    if (eventType === TimelineEventType.ALL || eventType === TimelineEventType.MEDICAL_RECORD) {
      const records = await this.fetchMedicalRecords(petId, dateFilter);
      events.push(...records);
    }

    if (eventType === TimelineEventType.ALL || eventType === TimelineEventType.PRESCRIPTION) {
      const prescriptions = await this.fetchPrescriptions(petId, dateFilter);
      events.push(...prescriptions);
    }

    if (eventType === TimelineEventType.ALL || eventType === TimelineEventType.APPOINTMENT) {
      const appointments = await this.fetchAppointments(petId, dateFilter);
      events.push(...appointments);
    }

    if (eventType === TimelineEventType.ALL || eventType === TimelineEventType.ALLERGY) {
      const allergies = await this.fetchAllergies(petId, dateFilter);
      events.push(...allergies);
    }

    // Sort events by date
    events.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return sortOrder === TimelineSortOrder.ASC ? dateA - dateB : dateB - dateA;
    });

    // Apply pagination
    const totalEvents = events.length;
    const paginatedEvents = events.slice(offset, offset + limit);

    return {
      petId,
      petName: pet.name,
      totalEvents,
      events: paginatedEvents,
      filters: {
        eventType: eventType || TimelineEventType.ALL,
        startDate,
        endDate,
      },
      pagination: {
        limit,
        offset,
        hasMore: offset + limit < totalEvents,
      },
    };
  }

  /**
   * Get timeline summary statistics
   */
  async getTimelineSummary(petId: string): Promise<{
    totalEvents: number;
    byType: Record<string, number>;
    lastEvent?: TimelineEventDto;
    upcomingAppointments: number;
  }> {
    const pet = await this.petRepository.findOne({ where: { id: petId } });
    if (!pet) {
      throw new NotFoundException(`Pet with ID ${petId} not found`);
    }

    const [
      vaccinationCount,
      medicalRecordCount,
      prescriptionCount,
      appointmentCount,
      allergyCount,
      upcomingAppointments,
    ] = await Promise.all([
      this.vaccinationRepository.count({ where: { petId } }),
      this.medicalRecordRepository.count({ where: { petId } }),
      this.prescriptionRepository.count({ where: { petId } }),
      this.appointmentRepository.count({ where: { petId } }),
      this.allergyRepository.count({ where: { petId } }),
      this.appointmentRepository.count({
        where: {
          petId,
          appointmentDate: MoreThanOrEqual(new Date()),
        },
      }),
    ]);

    // Get most recent event
    const timeline = await this.getTimeline(petId, {
      limit: 1,
      offset: 0,
      sortOrder: TimelineSortOrder.DESC,
    });

    return {
      totalEvents: vaccinationCount + medicalRecordCount + prescriptionCount + appointmentCount + allergyCount,
      byType: {
        [TimelineEventType.VACCINATION]: vaccinationCount,
        [TimelineEventType.MEDICAL_RECORD]: medicalRecordCount,
        [TimelineEventType.PRESCRIPTION]: prescriptionCount,
        [TimelineEventType.APPOINTMENT]: appointmentCount,
        [TimelineEventType.ALLERGY]: allergyCount,
      },
      lastEvent: timeline.events[0],
      upcomingAppointments,
    };
  }

  /**
   * Build date filter for queries
   */
  private buildDateFilter(startDate?: string, endDate?: string): Record<string, any> {
    if (startDate && endDate) {
      return { date: Between(new Date(startDate), new Date(endDate)) };
    }
    if (startDate) {
      return { date: MoreThanOrEqual(new Date(startDate)) };
    }
    if (endDate) {
      return { date: LessThanOrEqual(new Date(endDate)) };
    }
    return {};
  }

  /**
   * Fetch and transform vaccinations
   */
  private async fetchVaccinations(petId: string, dateFilter: Record<string, any>): Promise<TimelineEventDto[]> {
    const where: any = { petId };
    if (dateFilter.date) {
      where.administeredDate = dateFilter.date;
    }

    const vaccinations = await this.vaccinationRepository.find({
      where,
      relations: ['vetClinic'],
      order: { administeredDate: 'DESC' },
    });

    return vaccinations.map((v) => ({
      id: v.id,
      type: TimelineEventType.VACCINATION,
      title: `Vaccination: ${v.vaccineName}`,
      description: `Administered by ${v.veterinarianName}${v.vetClinic ? ` at ${v.vetClinic.name}` : ''}`,
      date: v.administeredDate,
      icon: '💉',
      metadata: {
        vaccineName: v.vaccineName,
        batchNumber: v.batchNumber,
        veterinarianName: v.veterinarianName,
        nextDueDate: v.nextDueDate,
        certificateUrl: v.certificateUrl,
      },
    }));
  }

  /**
   * Fetch and transform medical records
   */
  private async fetchMedicalRecords(petId: string, dateFilter: Record<string, any>): Promise<TimelineEventDto[]> {
    const where: any = { petId };
    if (dateFilter.date) {
      where.date = dateFilter.date;
    }

    const records = await this.medicalRecordRepository.find({
      where,
      relations: ['vet'],
      order: { date: 'DESC' },
    });

    return records.map((r) => ({
      id: r.id,
      type: TimelineEventType.MEDICAL_RECORD,
      title: `${r.recordType.charAt(0).toUpperCase() + r.recordType.slice(1)}: ${r.diagnosis.substring(0, 50)}`,
      description: r.treatment,
      date: r.date,
      icon: '📋',
      metadata: {
        recordType: r.recordType,
        diagnosis: r.diagnosis,
        treatment: r.treatment,
        notes: r.notes,
        vetName: r.vet?.vetName,
        attachments: r.attachments,
      },
    }));
  }

  /**
   * Fetch and transform prescriptions
   */
  private async fetchPrescriptions(petId: string, dateFilter: Record<string, any>): Promise<TimelineEventDto[]> {
    const where: any = { petId };
    if (dateFilter.date) {
      where.createdAt = dateFilter.date;
    }

    const prescriptions = await this.prescriptionRepository.find({
      where,
      relations: ['vet'],
      order: { createdAt: 'DESC' },
    });

    return prescriptions.map((p) => ({
      id: p.id,
      type: TimelineEventType.PRESCRIPTION,
      title: `Prescription: ${p.medication}`,
      description: `${p.dosage}, ${p.frequency}`,
      date: p.createdAt,
      icon: '💊',
      severity: p.status,
      metadata: {
        medication: p.medication,
        dosage: p.dosage,
        frequency: p.frequency,
        status: p.status,
        vetName: p.vet?.vetName,
      },
    }));
  }

  /**
   * Fetch and transform appointments
   */
  private async fetchAppointments(petId: string, dateFilter: Record<string, any>): Promise<TimelineEventDto[]> {
    const where: any = { petId };
    if (dateFilter.date) {
      where.appointmentDate = dateFilter.date;
    }

    const appointments = await this.appointmentRepository.find({
      where,
      relations: ['vet'],
      order: { appointmentDate: 'DESC' },
    });

    return appointments.map((a) => ({
      id: a.id,
      type: TimelineEventType.APPOINTMENT,
      title: `Appointment: ${a.reason}`,
      description: `${a.appointmentTime} with ${a.vet?.vetName || 'Vet'}`,
      date: a.appointmentDate,
      icon: '📅',
      severity: a.status,
      metadata: {
        reason: a.reason,
        time: a.appointmentTime,
        status: a.status,
        vetName: a.vet?.vetName,
      },
    }));
  }

  /**
   * Fetch and transform allergies
   */
  private async fetchAllergies(petId: string, dateFilter: Record<string, any>): Promise<TimelineEventDto[]> {
    const where: any = { petId };
    if (dateFilter.date) {
      where.discoveredDate = dateFilter.date;
    }

    const allergies = await this.allergyRepository.find({
      where,
      order: { discoveredDate: 'DESC' },
    });

    return allergies.map((a) => ({
      id: a.id,
      type: TimelineEventType.ALLERGY,
      title: `Allergy Discovered: ${a.allergen}`,
      description: a.reactionNotes || `Severity: ${a.severity}`,
      date: a.discoveredDate,
      icon: '⚠️',
      severity: a.severity,
      metadata: {
        allergen: a.allergen,
        severity: a.severity,
        reactionNotes: a.reactionNotes,
      },
    }));
  }

  // ============================================
  // Timeline Sharing Methods
  // ============================================

  /**
   * Create a shareable link for a pet's timeline
   */
  async createTimelineShare(
    petId: string,
    ownerId: string,
    dto: ShareTimelineDto,
  ): Promise<TimelineShare> {
    // Verify pet exists
    const pet = await this.petRepository.findOne({ where: { id: petId } });
    if (!pet) {
      throw new NotFoundException(`Pet with ID ${petId} not found`);
    }

    // Generate secure share token
    const shareToken = this.generateShareToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + (dto.expiresInHours || 168));

    const share = this.timelineShareRepository.create({
      petId,
      ownerId,
      shareToken,
      recipientEmail: dto.recipientEmail || null,
      eventTypeFilter: dto.eventType || 'all',
      startDateFilter: dto.startDate ? new Date(dto.startDate) : null,
      endDateFilter: dto.endDate ? new Date(dto.endDate) : null,
      message: dto.message || null,
      expiresAt,
    });

    return this.timelineShareRepository.save(share);
  }

  /**
   * Get timeline by share token (public access)
   */
  async getTimelineByShareToken(
    shareToken: string,
    query: GetTimelineQueryDto,
  ): Promise<PetTimelineResponseDto> {
    const share = await this.timelineShareRepository.findOne({
      where: { shareToken },
      relations: ['pet'],
    });

    if (!share) {
      throw new NotFoundException('Share link not found');
    }

    if (!share.isValid()) {
      throw new ForbiddenException('Share link has expired or been revoked');
    }

    // Update access tracking
    share.accessCount += 1;
    share.lastAccessedAt = new Date();
    await this.timelineShareRepository.save(share);

    // Apply share filters
    const timelineQuery: GetTimelineQueryDto = {
      ...query,
      eventType: share.eventTypeFilter as TimelineEventType || query.eventType,
      startDate: share.startDateFilter?.toISOString() || query.startDate,
      endDate: share.endDateFilter?.toISOString() || query.endDate,
    };

    return this.getTimeline(share.petId, timelineQuery);
  }

  /**
   * Get all shares for a pet
   */
  async getTimelineShares(petId: string, ownerId: string): Promise<TimelineShare[]> {
    return this.timelineShareRepository.find({
      where: { petId, ownerId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Revoke a timeline share
   */
  async revokeTimelineShare(shareId: string, ownerId: string): Promise<void> {
    const share = await this.timelineShareRepository.findOne({
      where: { id: shareId, ownerId },
    });

    if (!share) {
      throw new NotFoundException('Share not found');
    }

    share.isRevoked = true;
    await this.timelineShareRepository.save(share);
  }

  /**
   * Generate a cryptographically secure share token
   */
  private generateShareToken(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < 32; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
  }
}
