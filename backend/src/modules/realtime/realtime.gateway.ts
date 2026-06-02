import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { FilePermissionService } from '../files/services/file-permission.service';
import { WsAuthGuard } from '../../websocket/guards/ws-auth.guard';
import {
  UploadProgressDto,
  ProcessingStatusDto,
} from './dto/realtime-events.dto';

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim())
  : '*';

@WebSocketGateway({
  cors: {
    origin: allowedOrigins,
  },
  namespace: 'files',
})
@UseGuards(WsAuthGuard)
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly filePermissionService: FilePermissionService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);

    const token =
      client.handshake.auth?.token ??
      client.handshake.headers?.authorization?.split(' ')[1];

    if (!token) {
      throw new WsException('Unauthorized');
    }

    try {
      const secret = this.configService.get<string>('auth.jwtSecret');
      const payload = this.jwtService.verify(token, { secret });
      client.data.userId = payload.sub;
      client.join(`user:${payload.sub}`);
    } catch (error) {
      throw new WsException('Unauthorized');
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('subscribe:file')
  async handleSubscribeFile(client: Socket, fileId: string) {
    const userId = client.data.userId as string;
    if (!userId) {
      throw new WsException('Unauthorized');
    }

    const hasAccess = await this.filePermissionService.canAccessFile(
      fileId,
      userId,
    );

    if (!hasAccess) {
      throw new WsException('Forbidden');
    }

    client.join(`file:${fileId}`);
    this.logger.debug(`Client ${client.id} subscribed to file ${fileId}`);
    return { event: 'subscribed', data: fileId };
  }

  // Identify user channel
  @SubscribeMessage('subscribe:user')
  handleSubscribeUser(client: Socket, userId: string) {
    const authenticatedUserId = client.data.userId as string;

    if (!authenticatedUserId) {
      throw new WsException('Unauthorized');
    }

    if (authenticatedUserId !== userId) {
      throw new WsException('Forbidden');
    }

    client.join(`user:${userId}`);
    this.logger.debug(`Client ${client.id} subscribed to user ${userId}`);
    return { event: 'subscribed', data: userId };
  }

  /**
   * Emit upload progress event
   */
  emitUploadProgress(payload: UploadProgressDto) {
    this.server.to(`file:${payload.fileId}`).emit('upload:progress', payload);
  }

  /**
   * Emit processing status event
   */
  emitProcessingStatus(payload: ProcessingStatusDto) {
    this.server.to(`file:${payload.fileId}`).emit('processing:status', payload);
  }

  /**
   * Emit processing complete event
   */
  emitProcessingComplete(fileId: string, result: any) {
    this.server
      .to(`file:${fileId}`)
      .emit('processing:complete', { fileId, result });
  }

  /**
   * Emit processing error event
   */
  emitProcessingError(fileId: string, error: string) {
    this.server
      .to(`file:${fileId}`)
      .emit('processing:error', { fileId, error });
  }
}
