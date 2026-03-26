import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  WebSocketConnection,
  ConnectionStatus,
} from '../entities/websocket-connection.entity';

@Injectable()
export class WebSocketConnectionService {
  private readonly logger = new Logger(WebSocketConnectionService.name);
  private readonly connections = new Map<string, Set<string>>(); // userId -> Set<socketId>

  constructor(
    @InjectRepository(WebSocketConnection)
    private connectionRepository: Repository<WebSocketConnection>,
  ) {}

  async registerConnection(
    userId: string,
    socketId: string,
    clientInfo?: string,
  ): Promise<void> {
    const connection = this.connectionRepository.create({
      userId,
      socketId,
      clientInfo,
      status: ConnectionStatus.CONNECTED,
      lastActivityAt: new Date(),
    });

    await this.connectionRepository.save(connection);

    if (!this.connections.has(userId)) {
      this.connections.set(userId, new Set());
    }
    this.connections.get(userId)!.add(socketId);

    this.logger.log(`User ${userId} connected with socket ${socketId}`);
  }

  async removeConnection(userId: string, socketId: string): Promise<void> {
    await this.connectionRepository.update(
      { userId, socketId },
      { status: ConnectionStatus.DISCONNECTED },
    );

    const userSockets = this.connections.get(userId);
    if (userSockets) {
      userSockets.delete(socketId);
      if (userSockets.size === 0) {
        this.connections.delete(userId);
      }
    }

    this.logger.log(`User ${userId} disconnected socket ${socketId}`);
  }

  async updateActivity(userId: string, socketId: string): Promise<void> {
    await this.connectionRepository.update(
      { userId, socketId },
      { lastActivityAt: new Date(), status: ConnectionStatus.CONNECTED },
    );
  }

  getActiveSocketsForUser(userId: string): string[] {
    return Array.from(this.connections.get(userId) || []);
  }

  isUserOnline(userId: string): boolean {
    return (
      this.connections.has(userId) && this.connections.get(userId)!.size > 0
    );
  }

  getOnlineUsersCount(): number {
    return this.connections.size;
  }

  async getConnectionHistory(
    userId: string,
    limit: number = 10,
  ): Promise<WebSocketConnection[]> {
    return this.connectionRepository.find({
      where: { userId },
      order: { connectedAt: 'DESC' },
      take: limit,
    });
  }

  async cleanupStaleConnections(
    thresholdMinutes: number = 30,
  ): Promise<number> {
    const threshold = new Date(Date.now() - thresholdMinutes * 60000);

    const result = await this.connectionRepository.update(
      { status: ConnectionStatus.CONNECTED, lastActivityAt: threshold },
      { status: ConnectionStatus.IDLE },
    );

    return result.affected || 0;
  }
}
