import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

export class TooManyRequestsException extends HttpException {
  constructor(message = 'Too Many Requests') {
    super(message, HttpStatus.TOO_MANY_REQUESTS);
  }
}
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, MoreThan } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { UserConsent, ConsentType } from './entities/user-consent.entity';
import {
  DataDeletionRequest,
  DeletionStatus,
} from './entities/data-deletion-request.entity';
import {
  GdprRequest,
  GdprRequestStatus,
  GdprRequestType,
} from './entities/gdpr-request.entity';
import { UpdateConsentDto, RequestDeletionDto } from './dto/gdpr.dto';
import { StorageService } from '../storage/storage.service';
import { PasswordUtil } from '../../auth/utils/password.util';
import { GdprJobData } from './gdpr.processor';

const RATE_LIMIT_HOURS = 24;

@Injectable()
export class GdprService {
  private readonly logger = new Logger(GdprService.name);

  constructor(
    @InjectRepository(UserConsent)
    private readonly consentRepo: Repository<UserConsent>,
    @InjectRepository(DataDeletionRequest)
    private readonly deletionRepo: Repository<DataDeletionRequest>,
    @InjectRepository(GdprRequest)
    private readonly gdprRequestRepo: Repository<GdprRequest>,
    private readonly dataSource: DataSource,
    private readonly storageService: StorageService,
    @InjectQueue('gdpr') private readonly gdprQueue: Queue<GdprJobData>,
  ) {}

  // ── Consent Management ────────────────────────────────────────────────────

  async getConsents(userId: string): Promise<UserConsent[]> {
    return this.consentRepo.find({ where: { userId }, order: { type: 'ASC' } });
  }

  async updateConsent(
    userId: string,
    dto: UpdateConsentDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<UserConsent> {
    let consent = await this.consentRepo.findOne({
      where: { userId, type: dto.type },
    });
    if (!consent) {
      consent = this.consentRepo.create({ userId, type: dto.type });
    }
    consent.granted = dto.granted;
    consent.ipAddress = ipAddress ?? null;
    consent.userAgent = userAgent ?? null;
    return this.consentRepo.save(consent);
  }

  async initDefaultConsents(userId: string): Promise<UserConsent[]> {
    const existing = await this.consentRepo.find({ where: { userId } });
    const existingTypes = new Set(existing.map((c) => c.type));

    const defaults = Object.values(ConsentType).filter(
      (t) => !existingTypes.has(t),
    );
    if (!defaults.length) return existing;

    const entities = defaults.map((type) =>
      this.consentRepo.create({
        userId,
        type,
        granted: type === ConsentType.ESSENTIAL, // essential always on
      }),
    );
    await this.consentRepo.save(entities);
    return this.consentRepo.find({ where: { userId } });
  }

  // ── Right to be Forgotten ─────────────────────────────────────────────────

  async requestDeletion(
    userId: string,
    dto: RequestDeletionDto,
  ): Promise<DataDeletionRequest> {
    const pending = await this.deletionRepo.findOne({
      where: { userId, status: DeletionStatus.PENDING },
    });
    if (pending)
      throw new ConflictException('A deletion request is already pending');

    const request = this.deletionRepo.create({
      userId,
      reason: dto.reason ?? null,
      status: DeletionStatus.PENDING,
    });
    return this.deletionRepo.save(request);
  }

  async processDeletion(requestId: string): Promise<DataDeletionRequest> {
    const request = await this.deletionRepo.findOne({
      where: { id: requestId },
    });
    if (!request)
      throw new NotFoundException(`Deletion request ${requestId} not found`);

    request.status = DeletionStatus.PROCESSING;
    await this.deletionRepo.save(request);

    const deletedEntities: Record<string, number> = {};

    try {
      await this.dataSource.transaction(async (em) => {
        const userId = request.userId;

        // Delete in dependency order — pets cascade to vaccinations, records, etc.
        const tables: Array<{ table: string; col: string }> = [
          { table: 'vaccination_adverse_reactions', col: 'vaccination_id' },
          { table: 'vaccinations', col: 'pet_id' },
          { table: 'medical_records', col: 'pet_id' },
          { table: 'prescriptions', col: 'pet_id' },
          { table: 'surgeries', col: 'pet_id' },
          { table: 'allergies', col: 'pet_id' },
          { table: 'conditions', col: 'pet_id' },
          { table: 'reminders', col: 'pet_id' },
          { table: 'zkp_proofs', col: 'pet_id' },
          { table: 'pets', col: 'owner_id' },
          { table: 'user_consents', col: 'user_id' },
          { table: 'user_sessions', col: 'user_id' },
          { table: 'user_activity_logs', col: 'user_id' },
          { table: 'user_preferences', col: 'user_id' },
          { table: 'notifications', col: 'user_id' },
          { table: 'reminders', col: 'user_id' },
        ];

        for (const { table, col } of tables) {
          try {
            const result = await em.query(
              `DELETE FROM "${table}" WHERE "${col}" = $1`,
              [userId],
            );
            deletedEntities[table] = result[1] ?? 0;
          } catch {
            // table may not exist in all environments — skip
          }
        }

        // Anonymise user row instead of hard-deleting (audit trail)
        await em.query(
          `UPDATE users SET
            email = $1,
            first_name = 'Deleted',
            last_name = 'User',
            phone = NULL,
            avatar_url = NULL,
            address = NULL,
            city = NULL,
            country = NULL,
            date_of_birth = NULL,
            is_active = false,
            deleted_at = NOW()
          WHERE id = $2`,
          [`deleted-${userId}@deleted.invalid`, userId],
        );
        deletedEntities['users'] = 1;
      });

      request.status = DeletionStatus.COMPLETED;
      request.completedAt = new Date();
      request.deletedEntities = deletedEntities;
    } catch (err) {
      this.logger.error(
        `Deletion failed for request ${requestId}: ${err.message}`,
      );
      request.status = DeletionStatus.FAILED;
    }

    return this.deletionRepo.save(request);
  }

  async getDeletionStatus(userId: string): Promise<DataDeletionRequest | null> {
    return this.deletionRepo.findOne({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  // ── Data Portability (Export) ─────────────────────────────────────────────

  async exportUserData(userId: string): Promise<Record<string, unknown>> {
    const rows = await this.dataSource.query(
      `SELECT id, email, first_name, last_name, phone, city, country, created_at
       FROM users WHERE id = $1`,
      [userId],
    );
    if (!rows.length) throw new NotFoundException('User not found');

    const [pets] = await Promise.all([
      this.dataSource.query(`SELECT * FROM pets WHERE owner_id = $1`, [userId]),
    ]);

    const petIds: string[] = pets.map((p: { id: string }) => p.id);

    const [vaccinations, medicalRecords, prescriptions, consents] =
      await Promise.all([
        petIds.length
          ? this.dataSource.query(
              `SELECT * FROM vaccinations WHERE pet_id = ANY($1)`,
              [petIds],
            )
          : Promise.resolve([]),
        petIds.length
          ? this.dataSource.query(
              `SELECT * FROM medical_records WHERE pet_id = ANY($1)`,
              [petIds],
            )
          : Promise.resolve([]),
        petIds.length
          ? this.dataSource.query(
              `SELECT * FROM prescriptions WHERE pet_id = ANY($1)`,
              [petIds],
            )
          : Promise.resolve([]),
        this.dataSource.query(
          `SELECT type, granted, created_at FROM user_consents WHERE user_id = $1`,
          [userId],
        ),
      ]);

    return {
      exportedAt: new Date().toISOString(),
      profile: rows[0],
      pets,
      vaccinations,
      medicalRecords,
      prescriptions,
      consents,
    };
  }

  // ── GDPR Request: Export ──────────────────────────────────────────────────

  async requestExport(userId: string): Promise<GdprRequest> {
    await this.enforceRateLimit(userId, GdprRequestType.EXPORT);

    const request = this.gdprRequestRepo.create({
      userId,
      type: GdprRequestType.EXPORT,
      status: GdprRequestStatus.PENDING,
    });
    const saved = await this.gdprRequestRepo.save(request);

    await this.gdprQueue.add('gdpr-job', {
      requestId: saved.id,
      userId,
      type: GdprRequestType.EXPORT,
    });

    return saved;
  }

  async processExportJob(userId: string, requestId: string): Promise<string> {
    const data = await this.exportUserData(userId);
    const json = JSON.stringify(data, null, 2);
    const key = `gdpr-exports/${userId}/${requestId}.json`;

    const result = await this.storageService.upload({
      key,
      body: Buffer.from(json),
      contentType: 'application/json',
    });

    return result.url;
  }

  // ── GDPR Request: Erasure ─────────────────────────────────────────────────

  async requestErasure(userId: string, password: string): Promise<GdprRequest> {
    await this.enforceRateLimit(userId, GdprRequestType.ERASURE);

    const [userRow] = await this.dataSource.query(
      `SELECT password FROM users WHERE id = $1`,
      [userId],
    );
    if (!userRow) throw new NotFoundException('User not found');

    const valid = await PasswordUtil.comparePassword(password, userRow.password);
    if (!valid) throw new UnauthorizedException('Invalid password');

    const request = this.gdprRequestRepo.create({
      userId,
      type: GdprRequestType.ERASURE,
      status: GdprRequestStatus.PENDING,
    });
    const saved = await this.gdprRequestRepo.save(request);

    await this.gdprQueue.add(
      'gdpr-job',
      { requestId: saved.id, userId, type: GdprRequestType.ERASURE },
      { delay: 0 },
    );

    return saved;
  }

  async processErasureJob(userId: string, _requestId: string): Promise<void> {
    const pending = await this.deletionRepo.findOne({
      where: { userId, status: DeletionStatus.PENDING },
    });
    const deletionReq =
      pending ??
      (await this.requestDeletion(userId, { reason: 'gdpr-erasure' }));
    await this.processDeletion(deletionReq.id);

    await this.dataSource.query(
      `DELETE FROM user_sessions WHERE user_id = $1`,
      [userId],
    );

    this.logger.log(`GDPR erasure complete for user ${userId}`);
    this.dataSource.query(
      `INSERT INTO user_activity_logs(user_id, action, created_at) VALUES ($1, $2, NOW()) ON CONFLICT DO NOTHING`,
      [userId, 'user.erased'],
    ).catch(() => {});
  }

  async getGdprRequest(requestId: string, userId: string): Promise<GdprRequest> {
    const req = await this.gdprRequestRepo.findOne({
      where: { id: requestId, userId },
    });
    if (!req) throw new NotFoundException('GDPR request not found');
    return req;
  }

  private async enforceRateLimit(userId: string, type: GdprRequestType): Promise<void> {
    const since = new Date(Date.now() - RATE_LIMIT_HOURS * 60 * 60 * 1000);
    const recent = await this.gdprRequestRepo.findOne({
      where: { userId, type, requestedAt: MoreThan(since) },
    });
    if (recent) {
      throw new TooManyRequestsException(
        `Only one ${type} request is allowed per ${RATE_LIMIT_HOURS} hours`,
      );
    }
  }

  // ── Retention Policy ──────────────────────────────────────────────────────

  /** Purge soft-deleted users older than retentionDays (default 90) */
  async purgeExpiredData(retentionDays = 90): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    const result = await this.dataSource.query(
      `SELECT id FROM users WHERE deleted_at IS NOT NULL AND deleted_at < $1`,
      [cutoff],
    );

    let purged = 0;
    for (const { id } of result) {
      const req = await this.requestDeletion(id, {
        reason: 'retention-policy',
      }).catch(() => null);
      if (req) {
        await this.processDeletion(req.id);
        purged++;
      }
    }
    this.logger.log(`Retention purge: ${purged} users processed`);
    return purged;
  }
}
