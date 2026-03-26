import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  OfflineMessage,
  MessagePriority,
} from '../entities/offline-message.entity';

@Injectable()
export class MessageQueueService {
  private readonly logger = new Logger(MessageQueueService.name);

  constructor(
    @InjectRepository(OfflineMessage)
    private messageRepository: Repository<OfflineMessage>,
  ) {}

  async queueMessage(
    userId: string,
    event: string,
    payload: any,
    priority: MessagePriority = MessagePriority.MEDIUM,
    ttlMinutes: number = 1440, // 24 hours
  ): Promise<OfflineMessage> {
    const message = this.messageRepository.create({
      userId,
      event,
      payload,
      priority,
      expiresAt: new Date(Date.now() + ttlMinutes * 60000),
    });

    const saved = await this.messageRepository.save(message);
    this.logger.log(
      `Queued message ${event} for user ${userId} (Priority: ${priority})`,
    );
    return saved;
  }

  async getPendingMessages(userId: string): Promise<OfflineMessage[]> {
    return this.messageRepository.find({
      where: { userId, delivered: false },
      order: { priority: 'DESC', createdAt: 'ASC' },
    });
  }

  async markAsDelivered(messageId: string): Promise<void> {
    await this.messageRepository.update(messageId, {
      delivered: true,
      deliveredAt: new Date(),
    });
  }

  async markBatchAsDelivered(messageIds: string[]): Promise<void> {
    await this.messageRepository.update(messageIds, {
      delivered: true,
      deliveredAt: new Date(),
    });
  }

  @Cron(CronExpression.EVERY_HOUR)
  async cleanupExpiredMessages(): Promise<void> {
    const result = await this.messageRepository.delete({
      expiresAt: LessThan(new Date()),
    });

    if (result.affected && result.affected > 0) {
      this.logger.log(`Cleaned up ${result.affected} expired messages`);
    }
  }

  async getQueueStats(userId?: string): Promise<any> {
    const query = this.messageRepository.createQueryBuilder('msg');

    if (userId) {
      query.where('msg.userId = :userId', { userId });
    }

    const total = await query.getCount();
    const delivered = await query.andWhere('msg.delivered = true').getCount();
    const pending = await query.andWhere('msg.delivered = false').getCount();

    return { total, delivered, pending };
  }
}
