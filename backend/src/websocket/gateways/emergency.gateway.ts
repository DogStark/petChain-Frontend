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
import { WsAuthGuard } from '../guards/ws-auth.guard';
import { MessageQueueService } from '../services/message-queue.service';
import { MessagePriority } from '../entities/offline-message.entity';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: 'emergency',
})
@UseGuards(WsAuthGuard)
export class EmergencyGateway {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EmergencyGateway.name);

  constructor(private messageQueueService: MessageQueueService) {}

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
