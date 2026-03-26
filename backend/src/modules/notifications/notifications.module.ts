import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { Notification } from './entities/notification.entity';
import { NotificationSetting } from './entities/notification-setting.entity';
import { DeviceToken } from './entities/device-token.entity';
import { NotificationsService } from './notifications.service';
import { FirebaseService } from './firebase.service';
import { PushProcessor } from './push.processor';
import { NotificationsController } from './notifications.controller';
import { WebSocketModule } from 'src/websocket/websocket.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([Notification, NotificationSetting, DeviceToken]),
        BullModule.registerQueue({
            name: 'push-notifications',
        }),
        forwardRef(() => WebSocketModule),
    ],
    controllers: [NotificationsController],
    providers: [NotificationsService, FirebaseService, PushProcessor],
    exports: [NotificationsService, FirebaseService],
})
export class NotificationsModule { }
