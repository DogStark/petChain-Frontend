import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { BlacklistedIp } from '../entities/blacklisted-ip.entity';
import { SECURITY_CONSTANTS } from '../constants/security.constants';

@Injectable()
export class IpBlacklistService {
  private readonly logger = new Logger(IpBlacklistService.name);

  constructor(
    @InjectRepository(BlacklistedIp)
    private blacklistRepository: Repository<BlacklistedIp>,
    @Inject(CACHE_MANAGER)
    private cacheManager: Cache,
  ) {}

  async isBlacklisted(ipAddress: string): Promise<boolean> {
    const cacheKey = `blacklist:${ipAddress}`;
    const cached = await this.cacheManager.get<boolean>(cacheKey);

    if (cached !== undefined) return cached;

    const blacklisted = await this.blacklistRepository.findOne({
      where: { ipAddress },
    });

    const isBlocked =
      blacklisted !== null &&
      (blacklisted.isPermanent ||
        (blacklisted.expiresAt && blacklisted.expiresAt > new Date()));

    await this.cacheManager.set(cacheKey, isBlocked, 300000); // 5 min cache
    return isBlocked;
  }

  async blacklistIp(
    ipAddress: string,
    reason: string,
    threatScore: number,
    durationMinutes?: number,
  ): Promise<BlacklistedIp> {
    const existing = await this.blacklistRepository.findOne({
      where: { ipAddress },
    });

    if (existing) {
      existing.reason = reason;
      existing.threatScore = threatScore;
      if (durationMinutes) {
        existing.expiresAt = new Date(Date.now() + durationMinutes * 60000);
        existing.isPermanent = false;
      }
      const saved = await this.blacklistRepository.save(existing);
      await this.cacheManager.del(`blacklist:${ipAddress}`);
      return saved;
    }

    const blacklisted = this.blacklistRepository.create({
      ipAddress,
      reason,
      threatScore,
      expiresAt: durationMinutes
        ? new Date(Date.now() + durationMinutes * 60000)
        : null,
      isPermanent: !durationMinutes,
    });

    const saved = await this.blacklistRepository.save(blacklisted);
    await this.cacheManager.del(`blacklist:${ipAddress}`);

    this.logger.warn(
      `IP ${ipAddress} blacklisted: ${reason} (Score: ${threatScore})`,
    );

    return saved;
  }

  async removeFromBlacklist(ipAddress: string): Promise<void> {
    await this.blacklistRepository.delete({ ipAddress });
    await this.cacheManager.del(`blacklist:${ipAddress}`);
    this.logger.log(`IP ${ipAddress} removed from blacklist`);
  }

  @Cron(CronExpression.EVERY_HOUR)
  async cleanupExpiredEntries() {
    const result = await this.blacklistRepository.delete({
      isPermanent: false,
      expiresAt: LessThan(new Date()),
    });

    if (result.affected && result.affected > 0) {
      this.logger.log(
        `Cleaned up ${result.affected} expired blacklist entries`,
      );
    }
  }

  async getBlacklistedIps(): Promise<BlacklistedIp[]> {
    return this.blacklistRepository.find({
      order: { blacklistedAt: 'DESC' },
    });
  }
}
