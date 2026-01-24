import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { WebSocketConnectionService } from '../services/websocket-connection.service';
import { MessageQueueService } from '../services/message-queue.service';
import { WebSocketRateLimitService } from '../services/websocket-rate-limit.service';
import { NotificationDto } from '../dto/notification.dto';
import { WsAuthGuard } from '../guards/ws-auth.guard';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: 'notifications',
})
@UseGuards(WsAuthGuard)
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);

  constructor(
    private connectionService: WebSocketConnectionService,
    private messageQueueService: MessageQueueService,
    private rateLimitService: WebSocketRateLimitService,
  ) {}

  async handleConnection(client: Socket) {
    const userId = client.handshake.auth.userId || client.id;
    const clientInfo = client.handshake.headers['user-agent'];

    await this.connectionService.registerConnection(
      userId,
      client.id,
      clientInfo,
    );
    this.logger.log(`Client connected: ${client.id} (User: ${userId})`);

    // Deliver pending messages
    const pending = await this.messageQueueService.getPendingMessages(userId);
    for (const message of pending) {
      client.emit(message.event, message.payload);
      await this.messageQueueService.markAsDelivered(message.id);
    }

    client.emit('connection', {
      status: 'connected',
      pendingMessages: pending.length,
    });
  }

  async handleDisconnect(client: Socket) {
    const userId = client.handshake.auth.userId || client.id;
    await this.connectionService.removeConnection(userId, client.id);
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('ping')
  async handlePing(@ConnectedSocket() client: Socket) {
    const userId = client.handshake.auth.userId || client.id;
    await this.connectionService.updateActivity(userId, client.id);
    return { event: 'pong', data: { timestamp: Date.now() } };
  }

  async sendNotification(userId: string, notification: NotificationDto) {
    const sockets = this.connectionService.getActiveSocketsForUser(userId);

    if (sockets.length === 0) {
      await this.messageQueueService.queueMessage(
        userId,
        'notification',
        notification,
      );
      return;
    }

    sockets.forEach((socketId) => {
      this.server.to(socketId).emit('notification', notification);
    });
  }

  async broadcastNotification(notification: NotificationDto) {
    this.server.emit('notification', notification);
  }
}
