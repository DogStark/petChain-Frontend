import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { UserActivityLog, ActivityType } from './entities/user-activity-log.entity';

export interface CreateActivityLogDto {
  userId: string;
  activityType: ActivityType;
  description?: string;
  ipAddress?: string;
  userAgent?: string;
  deviceId?: string;
  metadata?: Record<string, any>;
  isSuspicious?: boolean;
}

@Injectable()
export class UserActivityLogService {
  constructor(
    @InjectRepository(UserActivityLog)
    private readonly activityLogRepository: Repository<UserActivityLog>,
  ) {}

  /**
   * Log user activity
   */
  async logActivity(createActivityDto: CreateActivityLogDto): Promise<UserActivityLog> {
    const log = this.activityLogRepository.create(createActivityDto);
    return await this.activityLogRepository.save(log);
  }

  /**
   * Get user activity logs
   */
  async getUserActivity(
    userId: string,
    limit: number = 50,
    offset: number = 0,
  ): Promise<UserActivityLog[]> {
    return await this.activityLogRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
  }

  /**
   * Get activity logs by type
   */
  async getActivityByType(
    userId: string,
    activityType: ActivityType,
    limit: number = 50,
  ): Promise<UserActivityLog[]> {
    return await this.activityLogRepository.find({
      where: { userId, activityType },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Get activity logs for date range
   */
  async getActivityByDateRange(
    userId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<UserActivityLog[]> {
    return await this.activityLogRepository.find({
      where: {
        userId,
        createdAt: Between(startDate, endDate),
      },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get suspicious activities
   */
  async getSuspiciousActivities(
    userId: string,
  ): Promise<UserActivityLog[]> {
    return await this.activityLogRepository.find({
      where: { userId, isSuspicious: true },
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  /**
   * Get login history
   */
  async getLoginHistory(
    userId: string,
    limit: number = 20,
  ): Promise<UserActivityLog[]> {
    return await this.activityLogRepository.find({
      where: { userId, activityType: ActivityType.LOGIN },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Delete old activity logs
   */
  async deleteOldLogs(beforeDate: Date): Promise<void> {
    await this.activityLogRepository.delete({
      createdAt: LessThan(beforeDate),
    });
  }

  /**
   * Delete user activity logs on account deletion
   */
  async deleteUserActivityLogs(userId: string): Promise<void> {
    await this.activityLogRepository.delete({ userId });
  }

  /**
   * Get activity summary for user
   */
  async getActivitySummary(userId: string) {
    const totalLogins = await this.activityLogRepository.count({
      where: { userId, activityType: ActivityType.LOGIN },
    });

    const recentActivity = await this.activityLogRepository.findOne({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    const suspiciousCount = await this.activityLogRepository.count({
      where: { userId, isSuspicious: true },
    });

    return {
      totalLogins,
      lastActivity: recentActivity?.createdAt,
      suspiciousActivities: suspiciousCount,
    };
  }
}

// Import for LessThan
import { LessThan } from 'typeorm';
