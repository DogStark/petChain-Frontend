import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { Notification } from './entities/notification.entity';
import { NotificationSetting } from './entities/notification-setting.entity';
import { DeviceToken } from './entities/device-token.entity';
import { NotificationTemplate } from './entities/notification-template.entity';
import { NotificationDeliveryLog } from './entities/notification-delivery-log.entity';
import { NotificationsService } from './notifications.service';
import { FirebaseService } from './firebase.service';
import { PushProcessor } from './push.processor';
import { NotificationsController } from './notifications.controller';
import { NotificationTemplateService } from './notification-template.service';
import { NotificationTemplateController } from './notification-template.controller';
import { NotificationDispatchService } from './notification-dispatch.service';
import { WebSocketModule } from 'src/websocket/websocket.module';
import { EmailModule } from '../email/email.module';
import { SmsModule } from '../sms/sms.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Notification,
      NotificationSetting,
      DeviceToken,
      NotificationTemplate,
      NotificationDeliveryLog,
    ]),
    BullModule.registerQueue({ name: 'push-notifications' }),
    forwardRef(() => WebSocketModule),
    EmailModule,
    SmsModule,
  ],
  controllers: [NotificationsController, NotificationTemplateController],
  providers: [
    NotificationsService,
    FirebaseService,
    PushProcessor,
    NotificationTemplateService,
    NotificationDispatchService,
  ],
  exports: [NotificationsService, FirebaseService, NotificationTemplateService, NotificationDispatchService],
})
export class NotificationsModule {}
