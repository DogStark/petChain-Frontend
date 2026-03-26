import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MedicalRecord } from '../../modules/medical-records/entities/medical-record.entity';
import { EncryptionService } from './encryption.service';

@Injectable()
export class KeyRotationService implements OnModuleInit {
  private readonly logger = new Logger(KeyRotationService.name);

  constructor(
    @InjectRepository(MedicalRecord)
    private readonly medicalRecordRepo: Repository<MedicalRecord>,
    private readonly encryptionService: EncryptionService,
  ) {}

  onModuleInit() {
    this.logger.log('KeyRotationService initialized');
  }

  /**
   * Re-encrypts all medical records with the current (latest) key.
   * Runs weekly; can also be triggered manually via admin endpoint.
   */
  @Cron(CronExpression.EVERY_WEEK)
  async rotateKeys(): Promise<{ rotated: number }> {
    this.logger.log('Starting key rotation for medical records…');
    const records = await this.medicalRecordRepo.find();
    let rotated = 0;

    for (const record of records) {
      let dirty = false;

      for (const field of ['diagnosis', 'treatment', 'notes'] as const) {
        const val = record[field];
        if (!val) continue;
        const re = this.encryptionService.reEncrypt(val);
        if (re !== val) {
          (record as any)[field] = re;
          dirty = true;
        }
      }

      if (dirty) {
        await this.medicalRecordRepo.save(record);
        rotated++;
      }
    }

    this.logger.log(`Key rotation complete — ${rotated} records re-encrypted`);
    return { rotated };
  }
}
