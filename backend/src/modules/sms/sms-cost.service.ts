import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { SmsCost } from './entities/sms-cost.entity';
import { SmsLog, SmsStatus } from './entities/sms-log.entity';

@Injectable()
export class SmsCostService {
  private readonly logger = new Logger(SmsCostService.name);

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(SmsCost)
    private readonly smsCostRepository: Repository<SmsCost>,
    @InjectRepository(SmsLog)
    private readonly smsLogRepository: Repository<SmsLog>,
  ) {}

  async getOrCreateMonthlyCost(
    userId: string | null,
    month: number,
    year: number,
  ): Promise<SmsCost> {
    const where =
      userId === null
        ? { userId: IsNull(), month, year }
        : { userId, month, year };
    let cost = await this.smsCostRepository.findOne({ where });
    if (!cost) {
      const defaultLimit = this.configService.get<number>(
        'sms.defaultSpendingLimitCents',
      );
      const monthlyLimit = this.configService.get<number>(
        'sms.monthlyLimitCents',
      );
      cost = this.smsCostRepository.create({
        userId: userId ?? null,
        month,
        year,
        totalSent: 0,
        totalDelivered: 0,
        totalFailed: 0,
        totalCostCents: '0',
        spendingLimitCents:
          userId != null
            ? String(defaultLimit ?? 1000)
            : String(monthlyLimit ?? 5000),
      });
      await this.smsCostRepository.save(cost);
    }
    return cost;
  }

  async canSendSms(
    userId: string,
  ): Promise<{ allowed: boolean; reason?: string }> {
    const now = new Date();
    const cost = await this.getOrCreateMonthlyCost(
      userId,
      now.getMonth() + 1,
      now.getFullYear(),
    );
    const limit = cost.spendingLimitCents
      ? parseFloat(cost.spendingLimitCents)
      : 0;
    const current = parseFloat(cost.totalCostCents);
    if (limit > 0 && current >= limit) {
      return { allowed: false, reason: 'MONTHLY_LIMIT_REACHED' };
    }
    return { allowed: true };
  }

  async recordSend(
    userId: string,
    logId: string,
    estimatedCents: number = 0,
  ): Promise<void> {
    const now = new Date();
    const cost = await this.getOrCreateMonthlyCost(
      userId,
      now.getMonth() + 1,
      now.getFullYear(),
    );
    cost.totalSent += 1;
    cost.totalCostCents = String(
      (parseFloat(cost.totalCostCents) + estimatedCents).toFixed(4),
    );
    await this.smsCostRepository.save(cost);

    const limit = cost.spendingLimitCents
      ? parseFloat(cost.spendingLimitCents)
      : 0;
    const current = parseFloat(cost.totalCostCents);
    if (limit > 0) {
      const pct = (current / limit) * 100;
      if (pct >= 100) {
        this.logger.warn(`SMS spending limit reached for user ${userId}`);
      } else if (pct >= 80) {
        this.logger.warn(
          `SMS spending at ${pct.toFixed(0)}% of limit for user ${userId}`,
        );
      }
    }
  }

  async recordDeliveryUpdate(
    log: SmsLog,
    newStatus: SmsStatus,
    costCents?: number,
  ): Promise<void> {
    const now = new Date();
    const cost = await this.getOrCreateMonthlyCost(
      log.userId,
      now.getMonth() + 1,
      now.getFullYear(),
    );
    if (newStatus === SmsStatus.DELIVERED) {
      cost.totalDelivered += 1;
    }
    if (newStatus === SmsStatus.FAILED) {
      cost.totalFailed += 1;
    }
    if (costCents !== undefined && costCents > 0) {
      const previousLogCents = parseFloat(log.costInCents || '0');
      cost.totalCostCents = String(
        (
          parseFloat(cost.totalCostCents) -
          previousLogCents +
          costCents
        ).toFixed(4),
      );
    }
    await this.smsCostRepository.save(cost);
  }

  async getUserUsage(
    userId: string,
    month?: number,
    year?: number,
  ): Promise<{
    sent: number;
    delivered: number;
    failed: number;
    costCents: number;
    limitCents: number | null;
  }> {
    const now = new Date();
    const m = month ?? now.getMonth() + 1;
    const y = year ?? now.getFullYear();
    const cost = await this.getOrCreateMonthlyCost(userId, m, y);
    return {
      sent: cost.totalSent,
      delivered: cost.totalDelivered,
      failed: cost.totalFailed,
      costCents: parseFloat(cost.totalCostCents),
      limitCents: cost.spendingLimitCents
        ? parseFloat(cost.spendingLimitCents)
        : null,
    };
  }

  async getGlobalUsage(
    month?: number,
    year?: number,
  ): Promise<{
    totalSent: number;
    totalDelivered: number;
    totalFailed: number;
    totalCostCents: number;
    limitCents: number | null;
  }> {
    const now = new Date();
    const m = month ?? now.getMonth() + 1;
    const y = year ?? now.getFullYear();
    const global = await this.getOrCreateMonthlyCost(null, m, y);
    return {
      totalSent: global.totalSent,
      totalDelivered: global.totalDelivered,
      totalFailed: global.totalFailed,
      totalCostCents: parseFloat(global.totalCostCents),
      limitCents: global.spendingLimitCents
        ? parseFloat(global.spendingLimitCents)
        : null,
    };
  }

  async getAdminStats(
    month?: number,
    year?: number,
  ): Promise<{
    global: {
      sent: number;
      delivered: number;
      failed: number;
      costCents: number;
      limitCents: number | null;
    };
    byUser: Array<{
      userId: string;
      sent: number;
      delivered: number;
      failed: number;
      costCents: number;
      limitCents: number | null;
    }>;
  }> {
    const now = new Date();
    const m = month ?? now.getMonth() + 1;
    const y = year ?? now.getFullYear();
    const global = await this.getGlobalUsage(m, y);
    const costs = await this.smsCostRepository.find({
      where: { month: m, year: y },
      order: { totalCostCents: 'DESC' },
    });
    const byUser = costs
      .filter((c) => c.userId)
      .map((c) => ({
        userId: c.userId,
        sent: c.totalSent,
        delivered: c.totalDelivered,
        failed: c.totalFailed,
        costCents: parseFloat(c.totalCostCents),
        limitCents: c.spendingLimitCents
          ? parseFloat(c.spendingLimitCents)
          : null,
      }));
    return {
      global: {
        sent: global.totalSent,
        delivered: global.totalDelivered,
        failed: global.totalFailed,
        costCents: global.totalCostCents,
        limitCents: global.limitCents,
      },
      byUser,
    };
  }

  async getDeliveryStats(
    startDate?: string,
    endDate?: string,
  ): Promise<{
    range: { startDate: string; endDate: string };
    totals: {
      sent: number;
      delivered: number;
      failed: number;
      pending: number;
    };
    trend: Array<{
      date: string;
      sent: number;
      delivered: number;
      failed: number;
      pending: number;
      deliveryRate: number;
    }>;
  }> {
    const toISODate = (date: Date): string =>
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
        date.getDate(),
      ).padStart(2, '0')}`;

    const now = new Date();
    const parsedStart = startDate ? new Date(`${startDate}T00:00:00.000Z`) : null;
    const parsedEnd = endDate ? new Date(`${endDate}T00:00:00.000Z`) : null;
    const start =
      parsedStart && !isNaN(parsedStart.getTime())
        ? parsedStart
        : new Date(now.getFullYear(), now.getMonth(), 1);
    const end =
      parsedEnd && !isNaN(parsedEnd.getTime())
        ? parsedEnd
        : new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const rangeStart = start <= end ? start : end;
    const rangeEnd = start <= end ? end : start;

    const logs = await this.smsLogRepository
      .createQueryBuilder('log')
      .select('log.status', 'status')
      .addSelect('DATE(log.createdAt)', 'day')
      .addSelect('COUNT(*)', 'count')
      .where('log.createdAt >= :from', {
        from: new Date(
          rangeStart.getFullYear(),
          rangeStart.getMonth(),
          rangeStart.getDate(),
        ),
      })
      .andWhere('log.createdAt < :to', {
        to: new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), rangeEnd.getDate() + 1),
      })
      .groupBy('log.status')
      .addGroupBy('DATE(log.createdAt)')
      .getRawMany<{ status: SmsStatus; day: string; count: string }>();

    const buckets = new Map<
      string,
      { sent: number; delivered: number; failed: number; pending: number }
    >();
    const cursor = new Date(
      rangeStart.getFullYear(),
      rangeStart.getMonth(),
      rangeStart.getDate(),
    );
    const last = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), rangeEnd.getDate());
    while (cursor <= last) {
      buckets.set(toISODate(cursor), { sent: 0, delivered: 0, failed: 0, pending: 0 });
      cursor.setDate(cursor.getDate() + 1);
    }

    for (const row of logs) {
      const day = String(row.day).slice(0, 10);
      const bucket = buckets.get(day);
      if (!bucket) continue;
      const count = parseInt(row.count, 10) || 0;
      switch (row.status) {
        case SmsStatus.DELIVERED:
          bucket.delivered += count;
          break;
        case SmsStatus.FAILED:
          bucket.failed += count;
          break;
        case SmsStatus.SENT:
          bucket.sent += count;
          break;
        default:
          bucket.pending += count;
      }
    }

    const trend = Array.from(buckets.entries()).map(([date, counts]) => {
      const sent = counts.sent + counts.delivered + counts.failed;
      return {
        date,
        ...counts,
        deliveryRate: sent > 0 ? (counts.delivered / sent) * 100 : 0,
      };
    });

    const totals = trend.reduce(
      (acc, point) => ({
        sent: acc.sent + point.sent,
        delivered: acc.delivered + point.delivered,
        failed: acc.failed + point.failed,
        pending: acc.pending + point.pending,
      }),
      { sent: 0, delivered: 0, failed: 0, pending: 0 },
    );

    return {
      range: { startDate: toISODate(rangeStart), endDate: toISODate(rangeEnd) },
      totals,
      trend,
    };
  }

  async setUserSpendingLimit(
    userId: string,
    limitCents: number,
    month?: number,
    year?: number,
  ): Promise<SmsCost> {
    const now = new Date();
    const m = month ?? now.getMonth() + 1;
    const y = year ?? now.getFullYear();
    const cost = await this.getOrCreateMonthlyCost(userId, m, y);
    cost.spendingLimitCents = String(limitCents);
    return this.smsCostRepository.save(cost);
  }
}
