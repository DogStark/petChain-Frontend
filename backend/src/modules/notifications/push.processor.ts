import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FirebaseService } from './firebase.service';
import { DeviceToken } from './entities/device-token.entity';
import { Notification } from './entities/notification.entity';

@Processor('push-notifications')
@Injectable()
export class PushProcessor extends WorkerHost {
  private readonly logger = new Logger(PushProcessor.name);

  constructor(
    private readonly firebaseService: FirebaseService,
    @InjectRepository(DeviceToken)
    private readonly deviceTokenRepo: Repository<DeviceToken>,
  ) {
    super();
  }

  async process(job: Job<Notification, any, string>): Promise<any> {
    const notification = job.data;
    this.logger.log(`Processing push notification job for user: ${notification.userId}`);

    // Fetch device tokens for this user
    const tokens = await this.deviceTokenRepo.find({
      where: { userId: notification.userId },
    });

    if (!tokens || tokens.length === 0) {
      this.logger.log(`No device tokens found for user ${notification.userId}, skipping push.`);
      return;
    }

    const tokenStrings = tokens.map((t) => t.token);

    // Prepare FCM payload
    // You can customize the image mapping or add more data fields
    const fcmNotification = {
      title: notification.title,
      body: notification.message,
    };

    // Serialize metadata and append actionUrl for Rich Notifications and Action Buttons
    const fcmData: Record<string, string> = {
      notificationId: notification.id,
      category: notification.category,
    };

    if (notification.actionUrl) {
      fcmData.actionUrl = notification.actionUrl;
    }

    if (notification.metadata) {
       for (const [key, value] of Object.entries(notification.metadata)) {
           // FCM data payload only accepts string values
           fcmData[key] = typeof value === 'string' ? value : JSON.stringify(value);
       }
    }

    try {
      if (tokenStrings.length === 1) {
        await this.firebaseService.sendToDevice(tokenStrings[0], fcmNotification, fcmData);
      } else {
        await this.firebaseService.sendToDevices(tokenStrings, fcmNotification, fcmData);
      }
      this.logger.log(`Successfully sent push notification to ${tokenStrings.length} devices.`);
    } catch (error) {
      this.logger.error(`Failed to send push notification`, error.stack);
      throw error; // Let BullMQ handle retries
    }
  }
}
