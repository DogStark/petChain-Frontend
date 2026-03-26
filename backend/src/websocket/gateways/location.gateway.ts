import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { WebSocketRateLimitService } from '../services/websocket-rate-limit.service';
import { LocationUpdateDto } from '../dto/location-update.dto';
import { WsAuthGuard } from '../guards/ws-auth.guard';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: 'location',
})
@UseGuards(WsAuthGuard)
export class LocationGateway {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(LocationGateway.name);

  constructor(private rateLimitService: WebSocketRateLimitService) {}

  @SubscribeMessage('location:update')
  async handleLocationUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: LocationUpdateDto,
  ) {
    const userId = client.handshake.auth.userId;

    const rateLimit = await this.rateLimitService.checkRateLimit(
      userId,
      'location:update',
      {
        windowMs: 60000,
        maxEvents: 60, // 1 per second
      },
    );

    if (!rateLimit.allowed) {
      return { error: 'Rate limit exceeded' };
    }

    // Broadcast to users tracking this pet
    this.server.emit(`pet:${data.petId}:location`, data);

    return { success: true, remaining: rateLimit.remaining };
  }

  @SubscribeMessage('location:subscribe')
  async handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { petId: string },
  ) {
    client.join(`pet:${data.petId}`);
    this.logger.log(`Client ${client.id} subscribed to pet ${data.petId}`);
    return { success: true, petId: data.petId };
  }

  @SubscribeMessage('location:unsubscribe')
  async handleUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { petId: string },
  ) {
    client.leave(`pet:${data.petId}`);
    return { success: true };
  }
}
