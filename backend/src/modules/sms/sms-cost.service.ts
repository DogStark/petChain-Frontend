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
    const where = userId === null
      ? { userId: IsNull(), month, year }
      : { userId, month, year };
    let cost = await this.smsCostRepository.findOne({ where });
    if (!cost) {
      const defaultLimit = this.configService.get<number>('sms.defaultSpendingLimitCents');
      const monthlyLimit = this.configService.get<number>('sms.monthlyLimitCents');
      cost = this.smsCostRepository.create({
        userId: userId ?? null,
        month,
        year,
        totalSent: 0,
        totalDelivered: 0,
        totalFailed: 0,
        totalCostCents: '0',
        spendingLimitCents: userId != null ? String(defaultLimit ?? 1000) : String(monthlyLimit ?? 5000),
      });
      await this.smsCostRepository.save(cost);
    }
    return cost;
  }

  async canSendSms(userId: string): Promise<{ allowed: boolean; reason?: string }> {
    const now = new Date();
    const cost = await this.getOrCreateMonthlyCost(
      userId,
      now.getMonth() + 1,
      now.getFullYear(),
    );
    const limit = cost.spendingLimitCents ? parseFloat(cost.spendingLimitCents) : 0;
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

    const limit = cost.spendingLimitCents ? parseFloat(cost.spendingLimitCents) : 0;
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
  ): Promise<{ sent: number; delivered: number; failed: number; costCents: number; limitCents: number | null }> {
    const now = new Date();
    const m = month ?? now.getMonth() + 1;
    const y = year ?? now.getFullYear();
    const cost = await this.getOrCreateMonthlyCost(userId, m, y);
    return {
      sent: cost.totalSent,
      delivered: cost.totalDelivered,
      failed: cost.totalFailed,
      costCents: parseFloat(cost.totalCostCents),
      limitCents: cost.spendingLimitCents ? parseFloat(cost.spendingLimitCents) : null,
    };
  }

  async getGlobalUsage(month?: number, year?: number): Promise<{
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

  async getAdminStats(month?: number, year?: number): Promise<{
    global: { sent: number; delivered: number; failed: number; costCents: number; limitCents: number | null };
    byUser: Array<{ userId: string; sent: number; delivered: number; failed: number; costCents: number; limitCents: number | null }>;
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
        userId: c.userId!,
        sent: c.totalSent,
        delivered: c.totalDelivered,
        failed: c.totalFailed,
        costCents: parseFloat(c.totalCostCents),
        limitCents: c.spendingLimitCents ? parseFloat(c.spendingLimitCents) : null,
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
