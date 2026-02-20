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
import { forwardRef, Inject, Logger, UseGuards } from '@nestjs/common';
import { WebSocketConnectionService } from '../services/websocket-connection.service';
import { MessageQueueService } from '../services/message-queue.service';
import { WebSocketRateLimitService } from '../services/websocket-rate-limit.service';
import { NotificationDto } from '../dto/notification.dto';
import { WsAuthGuard } from '../guards/ws-auth.guard';
import { BulkActionDto, NotificationQueryDto } from 'src/modules/notifications/dto/notifications.dto';
import { NotificationsService } from 'src/modules/notifications/notifications.service';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: 'notifications',
})
@UseGuards(WsAuthGuard)
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);

  constructor(
    private connectionService: WebSocketConnectionService,
    private messageQueueService: MessageQueueService,
    private rateLimitService: WebSocketRateLimitService,
    @Inject(forwardRef(() => NotificationsService))
    private notificationsService: NotificationsService,
  ) { }

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

  /**
   * Client emits 'get-notifications' to fetch their notification list.
   * Payload: NotificationQueryDto (category, isRead, page, limit)
   *
   * Server responds with 'notifications-list' event.
   */
  @SubscribeMessage('get-notifications')
  async handleGetNotifications(
    @ConnectedSocket() client: Socket,
    @MessageBody() query: NotificationQueryDto,
  ) {
    const userId = client.handshake.auth.userId || client.id;
    const result = await this.notificationsService.findAll(userId, query);
    client.emit('notifications-list', result);
  }

  /**
   * Client emits 'mark-read' with { id: string }
   * Server responds with 'notification-updated' event.
   */
  @SubscribeMessage('mark-read')
  async handleMarkRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { id: string },
  ) {
    const userId = client.handshake.auth.userId || client.id;
    const updated = await this.notificationsService.markAsRead(payload.id, userId);
    client.emit('notification-updated', updated);
  }

  /**
   * Client emits 'mark-unread' with { id: string }
   * Server responds with 'notification-updated' event.
   */
  @SubscribeMessage('mark-unread')
  async handleMarkUnread(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { id: string },
  ) {
    const userId = client.handshake.auth.userId || client.id;
    const updated = await this.notificationsService.markAsUnread(payload.id, userId);
    client.emit('notification-updated', updated);
  }

  /**
   * Client emits 'mark-all-read'
   * Server responds with 'notifications-all-read' event.
   */
  @SubscribeMessage('mark-all-read')
  async handleMarkAllRead(@ConnectedSocket() client: Socket) {
    const userId = client.handshake.auth.userId || client.id;
    const result = await this.notificationsService.markAllAsRead(userId);
    client.emit('notifications-all-read', result);
  }

  /**
   * Client emits 'bulk-action' with BulkActionDto
   * Server responds with 'bulk-action-result' event.
   */
  @SubscribeMessage('bulk-action')
  async handleBulkAction(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: BulkActionDto,
  ) {
    const userId = client.handshake.auth.userId || client.id;
    const result = await this.notificationsService.bulkAction(userId, dto);
    client.emit('bulk-action-result', result);
  }

  // ── Push helpers (called by NotificationsService) ───────────────────────────

  async sendNotification(userId: string, notification: NotificationDto) {
    const sockets = this.connectionService.getActiveSocketsForUser(userId);

    if (sockets.length === 0) {
      // User is offline — queue for delivery on next connection
      await this.messageQueueService.queueMessage(userId, 'notification', notification);
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
