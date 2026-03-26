import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import {
  UploadProgressDto,
  ProcessingStatusDto,
} from './dto/realtime-events.dto';

@WebSocketGateway({
  cors: {
    origin: '*', // Allow all for dev
  },
  namespace: 'files',
})
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
    // Extract userId from token if auth implemented
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('subscribe:file')
  handleSubscribeFile(client: Socket, fileId: string) {
    client.join(`file:${fileId}`);
    this.logger.debug(`Client ${client.id} subscribed to file ${fileId}`);
    return { event: 'subscribed', data: fileId };
  }

  // Identify user channel
  @SubscribeMessage('subscribe:user')
  handleSubscribeUser(client: Socket, userId: string) {
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
