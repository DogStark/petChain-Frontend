import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationDeliveryLog, DeliveryStatus } from './entities/notification-delivery-log.entity';
import { TemplateChannel } from './entities/notification-template.entity';
import { NotificationTemplateService } from './notification-template.service';
import { FirebaseService } from './firebase.service';
import { DeviceToken } from './entities/device-token.entity';
import { EmailService } from '../email/email.service';
import { EmailType } from '../email/entities/email-log.entity';
import { SmsService } from '../sms/sms.service';

export interface DispatchOptions {
  notificationId: string;
  userId: string;
  recipientEmail?: string;
  recipientPhone?: string;
  templateName: string;
  variables?: Record<string, string>;
  channels?: TemplateChannel[];
}

@Injectable()
export class NotificationDispatchService {
  private readonly logger = new Logger(NotificationDispatchService.name);

  constructor(
    @InjectRepository(NotificationDeliveryLog)
    private readonly deliveryLogRepo: Repository<NotificationDeliveryLog>,
    @InjectRepository(DeviceToken)
    private readonly deviceTokenRepo: Repository<DeviceToken>,
    private readonly templateService: NotificationTemplateService,
    private readonly firebaseService: FirebaseService,
    private readonly emailService: EmailService,
    private readonly smsService: SmsService,
  ) {}

  async dispatch(opts: DispatchOptions): Promise<NotificationDeliveryLog[]> {
    const channels = opts.channels ?? [TemplateChannel.PUSH];
    const logs: NotificationDeliveryLog[] = [];

    for (const channel of channels) {
      const log = await this.dispatchChannel(opts, channel);
      logs.push(log);
    }

    return logs;
  }

  async getDeliveryStats(notificationId: string) {
    const logs = await this.deliveryLogRepo.find({ where: { notificationId } });
    const total = logs.length;
    const byStatus = logs.reduce(
      (acc, l) => {
        acc[l.status] = (acc[l.status] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
    return { total, byStatus, logs };
  }

  async getAnalytics(userId: string) {
    const logs = await this.deliveryLogRepo.find({ where: { userId } });
    const byChannel = logs.reduce(
      (acc, l) => {
        acc[l.channel] = acc[l.channel] ?? { total: 0, delivered: 0, failed: 0 };
        acc[l.channel].total++;
        if (l.status === DeliveryStatus.DELIVERED) acc[l.channel].delivered++;
        if (l.status === DeliveryStatus.FAILED) acc[l.channel].failed++;
        return acc;
      },
      {} as Record<string, { total: number; delivered: number; failed: number }>,
    );
    return { userId, byChannel };
  }

  private async dispatchChannel(
    opts: DispatchOptions,
    channel: TemplateChannel,
  ): Promise<NotificationDeliveryLog> {
    const log = this.deliveryLogRepo.create({
      notificationId: opts.notificationId,
      userId: opts.userId,
      channel,
      status: DeliveryStatus.PENDING,
    });
    await this.deliveryLogRepo.save(log);

    try {
      const rendered = await this.templateService.render(
        opts.templateName,
        channel,
        opts.variables ?? {},
      );

      if (!rendered) {
        log.status = DeliveryStatus.FAILED;
        log.errorMessage = `No active template "${opts.templateName}" for channel ${channel}`;
        await this.deliveryLogRepo.save(log);
        return log;
      }

      switch (channel) {
        case TemplateChannel.EMAIL:
          await this.sendEmail(opts, rendered, log);
          break;
        case TemplateChannel.SMS:
          await this.sendSms(opts, rendered, log);
          break;
        case TemplateChannel.PUSH:
          await this.sendPush(opts, rendered, log);
          break;
      }
    } catch (err: any) {
      log.status = DeliveryStatus.FAILED;
      log.errorMessage = err?.message ?? 'Unknown error';
      await this.deliveryLogRepo.save(log);
      this.logger.error(`Dispatch failed [${channel}] for notification ${opts.notificationId}: ${err?.message}`);
    }

    return log;
  }

  private async sendEmail(
    opts: DispatchOptions,
    rendered: { subject: string; body: string },
    log: NotificationDeliveryLog,
  ): Promise<void> {
    if (!opts.recipientEmail) {
      log.status = DeliveryStatus.FAILED;
      log.errorMessage = 'No recipient email provided';
      await this.deliveryLogRepo.save(log);
      return;
    }

    const emailLog = await this.emailService.queueEmail({
      recipientEmail: opts.recipientEmail,
      recipientUserId: opts.userId,
      type: EmailType.SYSTEM_NOTIFICATION,
      data: { subject: rendered.subject, body: rendered.body },
    } as any);

    log.status = DeliveryStatus.SENT;
    log.sentAt = new Date();
    log.providerMessageId = emailLog.id;
    await this.deliveryLogRepo.save(log);
  }

  private async sendSms(
    opts: DispatchOptions,
    rendered: { subject: string; body: string },
    log: NotificationDeliveryLog,
  ): Promise<void> {
    if (!opts.recipientPhone) {
      log.status = DeliveryStatus.FAILED;
      log.errorMessage = 'No recipient phone provided';
      await this.deliveryLogRepo.save(log);
      return;
    }

    const result = await this.smsService.sendSms(
      opts.userId,
      opts.recipientPhone,
      rendered.body,
    );

    log.status = result.success ? DeliveryStatus.SENT : DeliveryStatus.FAILED;
    log.sentAt = result.success ? new Date() : null;
    log.providerMessageId = result.logId ?? null;
    log.errorMessage = result.error ?? null;
    await this.deliveryLogRepo.save(log);
  }

  private async sendPush(
    opts: DispatchOptions,
    rendered: { subject: string; body: string },
    log: NotificationDeliveryLog,
  ): Promise<void> {
    const tokens = await this.deviceTokenRepo.find({ where: { userId: opts.userId } });

    if (!tokens.length) {
      log.status = DeliveryStatus.FAILED;
      log.errorMessage = 'No device tokens registered';
      await this.deliveryLogRepo.save(log);
      return;
    }

    const tokenStrings = tokens.map((t) => t.token);
    const success =
      tokenStrings.length === 1
        ? await this.firebaseService.sendToDevice(tokenStrings[0], {
            title: rendered.subject,
            body: rendered.body,
          })
        : !!(await this.firebaseService.sendToDevices(tokenStrings, {
            title: rendered.subject,
            body: rendered.body,
          }));

    log.status = success ? DeliveryStatus.SENT : DeliveryStatus.FAILED;
    log.sentAt = success ? new Date() : null;
    await this.deliveryLogRepo.save(log);
  }
}
