import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, FindOptionsWhere } from 'typeorm';
import { AuditLog, AuditAction } from './entities/audit-log.entity';
import { AuditQueryDto } from './dto/audit-query.dto';

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  async log(
    userId: string,
    entityType: string,
    entityId: string,
    action: AuditAction,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuditLog> {
    const auditLog = this.auditLogRepository.create({
      userId,
      entityType,
      entityId,
      action,
      ipAddress,
      userAgent,
    });
    return this.auditLogRepository.save(auditLog);
  }

  async findAll(query: AuditQueryDto): Promise<PaginatedResult<AuditLog>> {
    const { userId, entityType, action, dateFrom, dateTo, order = 'DESC', page = 1, limit = 20 } = query;

    const where: FindOptionsWhere<AuditLog> = {};
    if (userId) where.userId = userId;
    if (entityType) where.entityType = entityType;
    if (action) where.action = action;
    if (dateFrom || dateTo) {
      where.timestamp = Between(
        dateFrom ? new Date(dateFrom) : new Date(0),
        dateTo ? new Date(dateTo) : new Date(),
      );
    }

    const [data, total] = await this.auditLogRepository.findAndCount({
      where,
      order: { timestamp: order },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total, page, limit };
  }

  async findByEntity(entityType: string, entityId: string): Promise<AuditLog[]> {
    return this.auditLogRepository.find({
      where: { entityType, entityId },
      order: { timestamp: 'DESC' },
    });
  }

  async findByUser(userId: string): Promise<AuditLog[]> {
    return this.auditLogRepository.find({
      where: { userId },
      order: { timestamp: 'DESC' },
    });
  }

  async exportCsv(query: AuditQueryDto): Promise<Buffer> {
    const { data } = await this.findAll({ ...query, limit: 10000, page: 1 });
    const header = 'id,userId,entityType,entityId,action,ipAddress,userAgent,timestamp\n';
    const rows = data.map((r) =>
      [r.id, r.userId, r.entityType, r.entityId, r.action, r.ipAddress ?? '', r.userAgent ?? '', r.timestamp.toISOString()]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(','),
    );
    return Buffer.from(header + rows.join('\n'));
  }
}
