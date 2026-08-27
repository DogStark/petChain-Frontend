import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RefreshToken } from '../entities/refresh-token.entity';
import { Session } from '../entities/session.entity';

/**
 * Invalidates server-side session and refresh-token state for a user.
 */
@Injectable()
export class SessionService {
  constructor(
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    @InjectRepository(Session)
    private readonly sessionRepository: Repository<Session>,
  ) {}

  /**
   * Deletes all refresh tokens and tracked device sessions for the user.
   * Pair with updating {@link User.passwordChangedAt} so JWT access tokens
   * issued before that time are rejected by {@link JwtStrategy}.
   */
  async invalidateAllSessions(userId: string): Promise<void> {
    await this.refreshTokenRepository.delete({ userId });
    await this.sessionRepository.delete({ userId });
  }
}
