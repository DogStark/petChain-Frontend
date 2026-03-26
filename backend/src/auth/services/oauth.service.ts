import {
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { User } from '../../modules/users/entities/user.entity';
import { OAuthUser, OAuthProvider } from '../entities/oauth-user.entity';
import { RefreshToken } from '../entities/refresh-token.entity';
import { TokenUtil } from '../utils/token.util';

@Injectable()
export class OAuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(OAuthUser)
    private readonly oauthUserRepository: Repository<OAuthUser>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async validateOAuthUser(
    provider: OAuthProvider,
    providerId: string,
    email: string,
    firstName: string,
    lastName: string,
    avatarUrl?: string,
    accessToken?: string,
    refreshToken?: string,
  ): Promise<{ accessToken: string; refreshToken: string; user: User }> {
    // Check if OAuth account already linked
    let oauthUser = await this.oauthUserRepository.findOne({
      where: { provider, providerUserId: providerId },
      relations: ['user'],
    });

    let user: User;

    if (oauthUser) {
      // Update tokens
      oauthUser.accessToken = accessToken || oauthUser.accessToken;
      oauthUser.refreshToken = refreshToken || oauthUser.refreshToken;
      await this.oauthUserRepository.save(oauthUser);
      user = oauthUser.user;
    } else {
      // Check if user exists with same email — link accounts
      const existingUser = await this.userRepository.findOne({
        where: { email },
      });

      if (existingUser) {
        // Link OAuth to existing account
        user = existingUser;
      } else {
        // Create new user
        user = this.userRepository.create({
          email,
          firstName: firstName || 'User',
          lastName: lastName || '',
          emailVerified: true,
          phoneVerified: false,
          isActive: true,
          failedLoginAttempts: 0,
          avatarUrl: avatarUrl || undefined,
        });
        user = await this.userRepository.save(user);
      }

      // Create OAuth link
      oauthUser = this.oauthUserRepository.create({
        userId: user.id,
        provider,
        providerUserId: providerId,
        accessToken: accessToken || '',
        refreshToken: refreshToken || '',
      });
      await this.oauthUserRepository.save(oauthUser);
    }

    // Generate JWT tokens
    const tokens = await this.generateTokens(user);
    return { ...tokens, user };
  }

  private async generateTokens(
    user: User,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const payload = { sub: user.id, email: user.email };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: 900,
    });

    const refreshTokenValue = TokenUtil.generateToken(64);
    const refreshTokenHash = TokenUtil.hashToken(refreshTokenValue);

    const refreshTokenExpires = new Date();
    refreshTokenExpires.setDate(refreshTokenExpires.getDate() + 7);

    const refreshToken = this.refreshTokenRepository.create({
      token: refreshTokenHash,
      userId: user.id,
      deviceFingerprint: 'oauth',
      expiresAt: refreshTokenExpires,
    });
    await this.refreshTokenRepository.save(refreshToken);

    return { accessToken, refreshToken: refreshTokenValue };
  }
}