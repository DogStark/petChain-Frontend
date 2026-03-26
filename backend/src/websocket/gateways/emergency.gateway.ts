import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { EmergencyAlertDto } from '../dto/emergency-alert.dto';
import { EmergencyType } from '../dto/emergency-alert.dto';
import { WsAuthGuard } from '../guards/ws-auth.guard';
import { MessageQueueService } from '../services/message-queue.service';
import { MessagePriority } from '../entities/offline-message.entity';
import { SmsService } from '../../modules/sms/sms.service';
import { SmsTemplateService } from '../../modules/sms/sms-template.service';
import { UserPreferenceService } from '../../modules/users/services/user-preference.service';
import { UsersService } from '../../modules/users/users.service';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: 'emergency',
})
@UseGuards(WsAuthGuard)
export class EmergencyGateway {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EmergencyGateway.name);

  constructor(
    private messageQueueService: MessageQueueService,
    private smsService: SmsService,
    private smsTemplateService: SmsTemplateService,
    private userPreferenceService: UserPreferenceService,
    private usersService: UsersService,
  ) {}

  @SubscribeMessage('emergency:alert')
  async handleEmergencyAlert(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: EmergencyAlertDto,
  ) {
    const userId = client.handshake.auth.userId;

    this.logger.error(
      `EMERGENCY ALERT from ${userId}: ${data.type} - ${data.message}`,
    );

    // Broadcast to all connected medical staff
    this.server.emit('emergency:broadcast', {
      ...data,
      userId,
      timestamp: new Date(),
    });

    // Queue for offline staff
    await this.messageQueueService.queueMessage(
      'medical-staff',
      'emergency:alert',
      data,
      MessagePriority.CRITICAL,
      60, // 1 hour TTL
    );

    // Send SMS for critical alerts when user has SMS preferences enabled
    const shouldSendSms =
      data.type === EmergencyType.MEDICAL ||
      data.type === EmergencyType.CRITICAL_HEALTH ||
      data.type === EmergencyType.LOST_PET ||
      data.type === EmergencyType.ACCIDENT;
    if (shouldSendSms) {
      try {
        const [user, prefs] = await Promise.all([
          this.usersService.findOne(userId).catch(() => null),
          this.userPreferenceService.getNotificationPreferences(userId),
        ]);
        const phone = user?.phone ?? data.contactNumber;
        if (
          phone &&
          prefs.smsNotifications &&
          prefs.smsEmergencyAlerts
        ) {
          const templateName =
            data.type === EmergencyType.LOST_PET
              ? 'EMERGENCY_LOST_PET'
              : data.type === EmergencyType.MEDICAL ||
                  data.type === EmergencyType.CRITICAL_HEALTH
                ? 'CRITICAL_HEALTH'
                : 'EMERGENCY_MEDICAL';
          const { message } = await this.smsTemplateService.renderByName(
            templateName,
            {
              petName: 'Your pet',
              message: data.message,
              contactNumber: data.contactNumber ?? phone,
              location: data.location ?? 'Unknown',
            },
          );
          await this.smsService.sendSms(userId, phone, message, {
            skipPreferenceCheck: true,
          });
        }
      } catch (err) {
        this.logger.warn(`SMS emergency alert failed: ${err?.message}`);
      }
    }

    return { success: true, alertId: Date.now().toString() };
  }

  @SubscribeMessage('emergency:acknowledge')
  async handleAcknowledge(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { alertId: string },
  ) {
    const userId = client.handshake.auth.userId;

    this.server.emit('emergency:acknowledged', {
      alertId: data.alertId,
      acknowledgedBy: userId,
      timestamp: new Date(),
    });

    return { success: true };
  }
}
