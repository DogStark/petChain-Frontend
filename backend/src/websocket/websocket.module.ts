import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { ScheduleModule } from '@nestjs/schedule';
import { WebSocketConnection } from './entities/websocket-connection.entity';
import { OfflineMessage } from './entities/offline-message.entity';
import { WebSocketConnectionService } from './services/websocket-connection.service';
import { MessageQueueService } from './services/message-queue.service';
import { WebSocketRateLimitService } from './services/websocket-rate-limit.service';
import { NotificationsGateway } from './gateways/notifications.gateway';
import { LocationGateway } from './gateways/location.gateway';
import { EmergencyGateway } from './gateways/emergency.gateway';
import { NotificationsModule } from 'src/modules/notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([WebSocketConnection, OfflineMessage]),
    CacheModule.register({
      ttl: 60000,
      max: 10000,
    }),
    ScheduleModule.forRoot(),
    forwardRef(() => NotificationsModule),
  ],
  providers: [
    WebSocketConnectionService,
    MessageQueueService,
    WebSocketRateLimitService,
    NotificationsGateway,
    LocationGateway,
    EmergencyGateway,
  ],
  exports: [
    WebSocketConnectionService,
    MessageQueueService,
    NotificationsGateway,
    LocationGateway,
    EmergencyGateway,
  ],
})
export class WebSocketModule { }
