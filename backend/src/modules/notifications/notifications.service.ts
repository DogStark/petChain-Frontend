import {
    Injectable,
    Logger,
    NotFoundException,
    ForbiddenException,
    forwardRef,
    Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import {
    Notification,
    NotificationCategory,
} from './entities/notification.entity';
import { NotificationSetting } from './entities/notification-setting.entity';
import { DeviceToken } from './entities/device-token.entity';
import { RegisterDeviceTokenDto } from './dto/device-token.dto';
import {
    CreateNotificationDto,
    NotificationQueryDto,
    BulkActionDto,
    BulkAction,
    UpdateNotificationSettingDto,
} from './dto/notifications.dto';
import { NotificationsGateway } from 'src/websocket/gateways/notifications.gateway';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

/** Maps NotificationCategory to the setting column name */
const CATEGORY_TO_SETTING: Record<NotificationCategory, keyof NotificationSetting> = {
    [NotificationCategory.APPOINTMENT]: 'appointment',
    [NotificationCategory.MEDICATION]: 'medication',
    [NotificationCategory.CONSULTATION]: 'consultation',
    [NotificationCategory.ALERT]: 'alert',
    [NotificationCategory.MESSAGE]: 'message',
    [NotificationCategory.VACCINATION]: 'vaccination',
    [NotificationCategory.LOST_PET]: 'lostPet',
    [NotificationCategory.MEDICAL_RECORD]: 'medicalRecord',
    [NotificationCategory.SYSTEM]: 'system',
};

@Injectable()
export class NotificationsService {
    private readonly logger = new Logger(NotificationsService.name);

    constructor(
        @InjectRepository(Notification)
        private readonly notificationRepo: Repository<Notification>,
        @InjectRepository(NotificationSetting)
        private readonly settingRepo: Repository<NotificationSetting>,
        @InjectRepository(DeviceToken)
        private readonly deviceTokenRepo: Repository<DeviceToken>,
        @Inject(forwardRef(() => NotificationsGateway))
        private readonly gateway: NotificationsGateway,
        @InjectQueue('push-notifications') private pushQueue: Queue,
    ) { }

    // ── Create ──────────────────────────────────────────────────────────────────

    async create(dto: CreateNotificationDto): Promise<Notification> {
        // Check user settings — skip if category is disabled
        const allowed = await this.isCategoryAllowed(dto.userId, dto.category);
        if (!allowed) {
            this.logger.log(
                `Notification skipped for user ${dto.userId} — category ${dto.category} disabled`,
            );
            // Return a transient (unsaved) object so callers don't break
            return this.notificationRepo.create({ ...dto, isRead: false });
        }

        const notification = this.notificationRepo.create({
            userId: dto.userId,
            title: dto.title,
            message: dto.message,
            category: dto.category,
            actionUrl: dto.actionUrl ?? null,
            metadata: dto.metadata ?? null,
            isRead: false,
        });

        await this.notificationRepo.save(notification);
        this.logger.log(`Created notification ${notification.id} for user ${dto.userId}`);

        // Push real-time via WebSocket
        await this.gateway.sendNotification(dto.userId, {
            type: dto.category as any,
            title: dto.title,
            message: dto.message,
            targetUserId: dto.userId,
            metadata: dto.metadata,
        });

        // Queue Push Notification via BullMQ
        const delay = dto.scheduledFor
            ? Math.max(0, new Date(dto.scheduledFor).getTime() - Date.now())
            : 0;

        await this.pushQueue.add('send-push', notification, {
             delay,
             removeOnComplete: true,
             removeOnFail: false,
        });

        return notification;
    }

    // ── Read ────────────────────────────────────────────────────────────────────

    async findAll(
        userId: string,
        query: NotificationQueryDto,
    ): Promise<{ data: Notification[]; total: number; unreadCount: number }> {
        const { category, isRead, page = 1, limit = 20 } = query;

        const qb = this.notificationRepo
            .createQueryBuilder('n')
            .where('n.userId = :userId', { userId })
            .orderBy('n.createdAt', 'DESC')
            .skip((page - 1) * limit)
            .take(limit);

        if (category) qb.andWhere('n.category = :category', { category });
        if (isRead !== undefined) qb.andWhere('n.isRead = :isRead', { isRead });

        const [data, total] = await qb.getManyAndCount();
        const unreadCount = await this.notificationRepo.count({
            where: { userId, isRead: false },
        });

        return { data, total, unreadCount };
    }

    async findOne(id: string, userId: string): Promise<Notification> {
        const notification = await this.notificationRepo.findOne({ where: { id } });
        if (!notification) throw new NotFoundException(`Notification ${id} not found`);
        if (notification.userId !== userId) throw new ForbiddenException();
        return notification;
    }

    // ── Mark read / unread ──────────────────────────────────────────────────────

    async markAsRead(id: string, userId: string): Promise<Notification> {
        const notification = await this.findOne(id, userId);
        if (notification.isRead) return notification;

        notification.isRead = true;
        notification.readAt = new Date();
        await this.notificationRepo.save(notification);

        await this.pushUnreadCount(userId);
        return notification;
    }

    async markAsUnread(id: string, userId: string): Promise<Notification> {
        const notification = await this.findOne(id, userId);
        if (!notification.isRead) return notification;

        notification.isRead = false;
        notification.readAt = null;
        await this.notificationRepo.save(notification);

        await this.pushUnreadCount(userId);
        return notification;
    }

    async markAllAsRead(userId: string): Promise<{ updated: number }> {
        const result = await this.notificationRepo.update(
            { userId, isRead: false },
            { isRead: true, readAt: new Date() },
        );
        await this.pushUnreadCount(userId);
        return { updated: result.affected ?? 0 };
    }

    // ── Bulk actions ────────────────────────────────────────────────────────────

    async bulkAction(userId: string, dto: BulkActionDto): Promise<{ affected: number }> {
        // Ensure all ids belong to the requesting user
        const owned = await this.notificationRepo.find({
            where: { id: In(dto.ids), userId },
            select: ['id'],
        });

        if (owned.length === 0) return { affected: 0 };
        const ownedIds = owned.map((n) => n.id);

        let affected = 0;

        switch (dto.action) {
            case BulkAction.MARK_READ: {
                const result = await this.notificationRepo.update(
                    { id: In(ownedIds), isRead: false },
                    { isRead: true, readAt: new Date() },
                );
                affected = result.affected ?? 0;
                break;
            }
            case BulkAction.MARK_UNREAD: {
                const result = await this.notificationRepo.update(
                    { id: In(ownedIds), isRead: true },
                    { isRead: false, readAt: null },
                );
                affected = result.affected ?? 0;
                break;
            }
            case BulkAction.DELETE: {
                const result = await this.notificationRepo.delete({ id: In(ownedIds) });
                affected = result.affected ?? 0;
                break;
            }
        }

        await this.pushUnreadCount(userId);
        this.logger.log(`Bulk ${dto.action} — ${affected} notifications for user ${userId}`);
        return { affected };
    }

    // ── Delete ──────────────────────────────────────────────────────────────────

    async remove(id: string, userId: string): Promise<void> {
        const notification = await this.findOne(id, userId);
        await this.notificationRepo.remove(notification);
        await this.pushUnreadCount(userId);
    }

    // ── Settings ────────────────────────────────────────────────────────────────

    async getSettings(userId: string): Promise<NotificationSetting> {
        let setting = await this.settingRepo.findOne({ where: { userId } });
        if (!setting) {
            setting = this.settingRepo.create({ userId });
            await this.settingRepo.save(setting);
        }
        return setting;
    }

    async updateSettings(
        userId: string,
        dto: UpdateNotificationSettingDto,
    ): Promise<NotificationSetting> {
        let setting = await this.settingRepo.findOne({ where: { userId } });
        if (!setting) {
            setting = this.settingRepo.create({ userId });
        }
        Object.assign(setting, dto);
        await this.settingRepo.save(setting);
        this.logger.log(`Updated notification settings for user ${userId}`);
        return setting;
    }

    // ── Helpers ─────────────────────────────────────────────────────────────────

    private async isCategoryAllowed(
        userId: string,
        category: NotificationCategory,
    ): Promise<boolean> {
        const setting = await this.settingRepo.findOne({ where: { userId } });
        if (!setting) return true; // no record = all allowed

        if (!setting.globalEnabled) return false;

        const key = CATEGORY_TO_SETTING[category];
        return Boolean(setting[key]);
    }

    private async pushUnreadCount(userId: string): Promise<void> {
        const unreadCount = await this.notificationRepo.count({
            where: { userId, isRead: false },
        });
        await this.gateway.sendNotification(userId, {
            type: 'UNREAD_COUNT' as any,
            title: 'unread_count',
            message: String(unreadCount),
            targetUserId: userId,
            metadata: { unreadCount },
        });
    }

    // ── Device Tokens ───────────────────────────────────────────────────────────

    async registerDeviceToken(
        userId: string,
        dto: RegisterDeviceTokenDto,
    ): Promise<DeviceToken> {
        let deviceToken = await this.deviceTokenRepo.findOne({
            where: { token: dto.token },
        });

        if (deviceToken) {
            // Update the user ID if the token is passed to a new user
            if (deviceToken.userId !== userId) {
                deviceToken.userId = userId;
                await this.deviceTokenRepo.save(deviceToken);
            }
        } else {
            deviceToken = this.deviceTokenRepo.create({
                userId,
                token: dto.token,
                platform: dto.platform,
            });
            await this.deviceTokenRepo.save(deviceToken);
        }

        this.logger.log(`Registered device token for user ${userId}`);
        return deviceToken;
    }

    async removeDeviceToken(userId: string, token: string): Promise<void> {
        await this.deviceTokenRepo.delete({ userId, token });
        this.logger.log(`Removed device token for user ${userId}`);
    }
}
