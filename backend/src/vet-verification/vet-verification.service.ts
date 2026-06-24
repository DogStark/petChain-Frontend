import { Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { VerificationStatus } from './vet-verification.entity';
import { VetVerification } from './vet-verification.entity';
import { CacheService, CacheKeys, CacheTTL } from '../modules/cache/cache.service';

@Injectable()
export class VetVerificationService {
  private records: VetVerification[] = [];

  constructor(private readonly cacheService: CacheService) {}

  async create(data: any) {
    const record = {
      id: uuid(),
      ...data,
      status: VerificationStatus.PENDING,
      createdAt: new Date(),
    };
    this.records.push(record);
    return record;
  }

  async validateLicense(licenseNumber: string) {
    return licenseNumber.startsWith('VET');
  }

  async autoVerify(record: any) {
    const isValid = await this.validateLicense(record.licenseNumber);
    if (isValid) record.status = VerificationStatus.VERIFIED;
    await this.cacheService.invalidateVetVerification(record.id);
    return record;
  }

  async getStatus(id: string) {
    return this.cacheService.getOrSet(
      CacheKeys.vetVerification(id),
      () => Promise.resolve(this.records.find((r) => r.id === id)),
      CacheTTL.VET_VERIFICATION,
    );
  }

  async manualReview(id: string, status: VerificationStatus) {
    const record = this.records.find((r) => r.id === id);
    if (!record) return null;
    record.status = status;
    record.updatedAt = new Date();
    await this.cacheService.invalidateVetVerification(id);
    return record;
  }
}
