import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { UserSession } from '../entities/user-session.entity';

export interface CreateSessionDto {
  userId: string;
  deviceId: string;
  deviceName?: string;
  ipAddress: string;
  userAgent: string;
  refreshToken: string;
  expiresAt: Date;
}

@Injectable()
export class UserSessionService {
  constructor(
    @InjectRepository(UserSession)
    private readonly sessionRepository: Repository<UserSession>,
  ) {}

  /**
   * Create a new session
   */
  async createSession(createSessionDto: CreateSessionDto): Promise<UserSession> {
    const session = this.sessionRepository.create(createSessionDto);
    return await this.sessionRepository.save(session);
  }

  /**
   * Get active sessions for a user
   */
  async getActiveSessions(userId: string): Promise<UserSession[]> {
    return await this.sessionRepository.find({
      where: {
        userId,
        isActive: true,
      },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get all sessions for a user (including expired)
   */
  async getAllSessions(userId: string): Promise<UserSession[]> {
    return await this.sessionRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get a session by ID
   */
  async getSession(sessionId: string): Promise<UserSession | null> {
    return await this.sessionRepository.findOne({ where: { id: sessionId } });
  }

  /**
   * Get session by refresh token
   */
  async getSessionByRefreshToken(
    refreshToken: string,
  ): Promise<UserSession | null> {
    return await this.sessionRepository.findOne({
      where: { refreshToken },
      relations: ['user'],
    });
  }

  /**
   * Update session last activity
   */
  async updateLastActivity(sessionId: string): Promise<void> {
    await this.sessionRepository.update(sessionId, {
      lastActivityAt: new Date(),
    });
  }

  /**
   * Revoke a session
   */
  async revokeSession(sessionId: string): Promise<UserSession> {
    const session = await this.getSession(sessionId);
    if (session) {
      session.revoke();
      return await this.sessionRepository.save(session);
    }
    return session;
  }

  /**
   * Revoke all sessions for a user
   */
  async revokeAllSessions(userId: string): Promise<void> {
    await this.sessionRepository.update(
      { userId, isActive: true },
      { isActive: false },
    );
  }

  /**
   * Revoke all sessions except current
   */
  async revokeOtherSessions(
    userId: string,
    exceptSessionId: string,
  ): Promise<void> {
    await this.sessionRepository.update(
      { userId, isActive: true, id: { $ne: exceptSessionId } as any },
      { isActive: false },
    );
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<void> {
    await this.sessionRepository.delete({
      expiresAt: LessThan(new Date()),
    });
  }

  /**
   * Check if session is valid
   */
  async isSessionValid(sessionId: string): Promise<boolean> {
    const session = await this.getSession(sessionId);
    return session ? session.isValid() : false;
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string): Promise<void> {
    await this.sessionRepository.delete(sessionId);
  }

  /**
   * Delete all sessions for a user
   */
  async deleteAllSessions(userId: string): Promise<void> {
    await this.sessionRepository.delete({ userId });
  }
}
