import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AuditLog } from './audit.entity';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
  ) {}

  generateHash(data: any): string {
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(data))
      .digest('hex');
  }

  async logAction(payload: Partial<AuditLog>) {
    const hash = this.generateHash(payload);

    const log = this.auditRepo.create({
      ...payload,
      hash,
    });

    return this.auditRepo.save(log);
  }

  async findAll() {
    return this.auditRepo.find({
      order: { createdAt: 'DESC' },
    });
  }
}
