import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LostPetReport, LostPetStatus } from './entities/lost-pet-report.entity';
import { ReportLostPetDto } from './dto/report-lost-pet.dto';
import { ReportFoundPetDto } from './dto/report-found-pet.dto';
import { UpdateLostMessageDto } from './dto/update-lost-message.dto';
import { UpdateUserLocationDto } from './dto/update-user-location.dto';
import { PetsService } from '../pets/pets.service';
import { QRCodesService } from '../qrcodes/qrcodes.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationCategory } from '../notifications/entities/notification.entity';
import { UserLocation } from '../users/entities/user-location.entity';

const DEFAULT_ALERT_RADIUS_KM = 10;

@Injectable()
export class LostPetsService {
  constructor(
    @InjectRepository(LostPetReport)
    private readonly lostPetReportRepository: Repository<LostPetReport>,
    @InjectRepository(UserLocation)
    private readonly userLocationRepository: Repository<UserLocation>,
    private readonly petsService: PetsService,
    private readonly qrcodesService: QRCodesService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async reportLost(
    petId: string,
    ownerId: string,
    dto: ReportLostPetDto,
  ): Promise<LostPetReport> {
    await this.verifyPetOwnership(petId, ownerId);

    const existing = await this.lostPetReportRepository.findOne({
      where: { petId, status: LostPetStatus.LOST },
    });
    if (existing) {
      throw new BadRequestException('Pet is already reported as lost');
    }

    const report = this.lostPetReportRepository.create({
      petId,
      status: LostPetStatus.LOST,
      reportedDate: new Date(),
      lastSeenLatitude: dto.lastSeenLatitude ?? null,
      lastSeenLongitude: dto.lastSeenLongitude ?? null,
      lastSeenDate: dto.lastSeenDate ? new Date(dto.lastSeenDate) : null,
      customMessage: dto.customMessage ?? null,
      contactInfo: dto.contactInfo ?? null,
    });

    const saved = await this.lostPetReportRepository.save(report);

    await this.updateQRCodeLostMessage(petId, dto.customMessage, dto.contactInfo);
    await this.notifyNearbyUsers(petId, saved, ownerId);

    return this.findOneWithRelations(saved.id);
  }

  async reportFound(
    petId: string,
    ownerId: string,
    dto: ReportFoundPetDto,
  ): Promise<LostPetReport> {
    await this.verifyPetOwnership(petId, ownerId);

    const report = await this.lostPetReportRepository.findOne({
      where: { petId, status: LostPetStatus.LOST },
    });
    if (!report) {
      throw new NotFoundException('No active lost report found for this pet');
    }

    report.status = LostPetStatus.FOUND;
    report.foundDate = new Date();
    report.foundLatitude = dto.foundLatitude ?? null;
    report.foundLongitude = dto.foundLongitude ?? null;
    report.foundLocation = dto.foundLocation ?? null;
    report.foundDetails = dto.foundDetails ?? null;

    await this.lostPetReportRepository.save(report);
    await this.clearQRCodeLostMessage(petId);

    return this.findOneWithRelations(report.id);
  }

  async updateLostMessage(
    petId: string,
    ownerId: string,
    dto: UpdateLostMessageDto,
  ): Promise<LostPetReport> {
    await this.verifyPetOwnership(petId, ownerId);

    const report = await this.lostPetReportRepository.findOne({
      where: { petId, status: LostPetStatus.LOST },
    });
    if (!report) {
      throw new NotFoundException('No active lost report found for this pet');
    }

    if (dto.customMessage !== undefined) report.customMessage = dto.customMessage;
    if (dto.contactInfo !== undefined) report.contactInfo = dto.contactInfo;

    await this.lostPetReportRepository.save(report);
    await this.updateQRCodeLostMessage(
      petId,
      report.customMessage,
      report.contactInfo,
    );

    return this.findOneWithRelations(report.id);
  }

  async findAllLost(): Promise<LostPetReport[]> {
    return this.lostPetReportRepository.find({
      where: { status: LostPetStatus.LOST },
      relations: ['pet', 'pet.owner', 'pet.photos', 'pet.breed'],
      order: { reportedDate: 'DESC' },
    });
  }

  async findNearby(
    latitude: number,
    longitude: number,
    radiusKm: number = 10,
  ): Promise<LostPetReport[]> {
    const haversine =
      '(6371 * acos(cos(radians(:lat)) * cos(radians(report.lastSeenLatitude)) * cos(radians(report.lastSeenLongitude) - radians(:lng)) + sin(radians(:lat)) * sin(radians(report.lastSeenLatitude))))';

    return this.lostPetReportRepository
      .createQueryBuilder('report')
      .leftJoinAndSelect('report.pet', 'pet')
      .leftJoinAndSelect('pet.owner', 'owner')
      .leftJoinAndSelect('pet.photos', 'photos')
      .leftJoinAndSelect('pet.breed', 'breed')
      .where('report.status = :status', { status: LostPetStatus.LOST })
      .andWhere('report.lastSeenLatitude IS NOT NULL')
      .andWhere('report.lastSeenLongitude IS NOT NULL')
      .andWhere(`${haversine} <= :radius`, {
        lat: latitude,
        lng: longitude,
        radius: radiusKm,
      })
      .addSelect(haversine, 'distance')
      .orderBy('distance', 'ASC')
      .getMany();
  }

  async updateUserLocation(
    userId: string,
    dto: UpdateUserLocationDto,
  ): Promise<UserLocation> {
    let location = await this.userLocationRepository.findOne({
      where: { userId },
    });
    if (!location) {
      location = this.userLocationRepository.create({
        userId,
        latitude: dto.latitude,
        longitude: dto.longitude,
        receiveLostPetAlerts: dto.receiveLostPetAlerts ?? true,
      });
    } else {
      location.latitude = dto.latitude;
      location.longitude = dto.longitude;
      if (dto.receiveLostPetAlerts !== undefined) {
        location.receiveLostPetAlerts = dto.receiveLostPetAlerts;
      }
    }
    return this.userLocationRepository.save(location);
  }

  async getReportByPetId(petId: string): Promise<LostPetReport | null> {
    return this.lostPetReportRepository.findOne({
      where: { petId, status: LostPetStatus.LOST },
      relations: ['pet', 'pet.owner', 'pet.photos', 'pet.breed'],
    });
  }

  private async verifyPetOwnership(
    petId: string,
    ownerId: string,
  ): Promise<void> {
    const isOwner = await this.petsService.verifyOwnership(petId, ownerId);
    if (!isOwner) {
      throw new NotFoundException('Pet not found or you are not the owner');
    }
  }

  private async updateQRCodeLostMessage(
    petId: string,
    customMessage?: string | null,
    contactInfo?: string | null,
  ): Promise<void> {
    try {
      const qrcodes = await this.qrcodesService.findByPetId(petId);
      if (qrcodes.length > 0) {
        const activeQR = qrcodes.find((q) => q.isActive) ?? qrcodes[0];
        const lostMessage = customMessage
          ? `${customMessage}${contactInfo ? ` Contact: ${contactInfo}` : ''}`
          : null;
        await this.qrcodesService.update(activeQR.qrCodeId, {
          customMessage: lostMessage ?? undefined,
        });
      }
    } catch {
      // QR code might not exist; continue without failing the main flow
    }
  }

  private async clearQRCodeLostMessage(petId: string): Promise<void> {
    try {
      const qrcodes = await this.qrcodesService.findByPetId(petId);
      if (qrcodes.length > 0) {
        const activeQR = qrcodes.find((q) => q.isActive) ?? qrcodes[0];
        await this.qrcodesService.update(activeQR.qrCodeId, {
          customMessage: '',
        });
      }
    } catch {
      // QR code might not exist
    }
  }

  private async notifyNearbyUsers(
    petId: string,
    report: LostPetReport,
    excludeOwnerId: string,
  ): Promise<void> {
    const lat = report.lastSeenLatitude;
    const lng = report.lastSeenLongitude;

    if (lat == null || lng == null) return;

    const pet = await this.petsService.findOne(petId);
    const message = report.customMessage || `${pet.name} has been reported lost. Please help spread the word!`;

    const nearbyUserIds = await this.findUserIdsWithinRadius(
      Number(lat),
      Number(lng),
      DEFAULT_ALERT_RADIUS_KM,
      excludeOwnerId,
    );

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const actionUrl = `${frontendUrl}/lost-pets/${report.id}`;

    for (const userId of nearbyUserIds) {
      try {
        await this.notificationsService.create({
          userId,
          title: `Lost Pet Alert: ${pet.name}`,
          message,
          category: NotificationCategory.LOST_PET,
          actionUrl,
          metadata: {
            petId,
            reportId: report.id,
            petName: pet.name,
            lastSeenLatitude: lat,
            lastSeenLongitude: lng,
          },
        });
      } catch {
        // Continue if one notification fails
      }
    }
  }

  private async findUserIdsWithinRadius(
    latitude: number,
    longitude: number,
    radiusKm: number,
    excludeUserId: string,
  ): Promise<string[]> {
    const locations = await this.userLocationRepository
      .createQueryBuilder('ul')
      .select('ul.userId')
      .where('ul.receiveLostPetAlerts = :enabled', { enabled: true })
      .andWhere('ul.userId != :excludeUserId', { excludeUserId })
      .andWhere(
        `(
          6371 * acos(
            cos(radians(:lat)) * cos(radians(ul.latitude)) *
            cos(radians(ul.longitude) - radians(:lng)) +
            sin(radians(:lat)) * sin(radians(ul.latitude))
          )
        ) <= :radius`,
        {
          lat: latitude,
          lng: longitude,
          radius: radiusKm,
        },
      )
      .getRawMany<{ userId: string }>();

    return locations.map((l) => l.userId);
  }

  private async findOneWithRelations(id: string): Promise<LostPetReport> {
    const report = await this.lostPetReportRepository.findOne({
      where: { id },
      relations: ['pet', 'pet.owner', 'pet.photos', 'pet.breed'],
    });
    if (!report) {
      throw new NotFoundException('Lost pet report not found');
    }
    return report;
  }
}
