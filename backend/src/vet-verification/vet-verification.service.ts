import { Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { VerificationStatus } from './vet-verification.entity';
import { VetVerification } from './vet-verification.entity';

@Injectable()
export class VetVerificationService {
  private records: VetVerification[] = [];

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
    // TODO: Replace with real API
    return licenseNumber.startsWith('VET');
  }

  async autoVerify(record: any) {
    const isValid = await this.validateLicense(record.licenseNumber);

    if (isValid) {
      record.status = VerificationStatus.VERIFIED;
    }

    return record;
  }

  async getStatus(id: string) {
    return this.records.find((r) => r.id === id);
  }

  async manualReview(id: string, status: VerificationStatus) {
    const record = this.records.find((r) => r.id === id);

    if (!record) return null;

    record.status = status;
    record.updatedAt = new Date();

    return record;
  }
}
