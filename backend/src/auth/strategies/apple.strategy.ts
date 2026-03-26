import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-apple';
import { ConfigService } from '@nestjs/config';
import { OAuthService } from '../services/oauth.service';
import { OAuthProvider } from '../entities/oauth-user.entity';

@Injectable()
export class AppleStrategy extends PassportStrategy(Strategy, 'apple') {
  constructor(
    private readonly configService: ConfigService,
    private readonly oauthService: OAuthService,
  ) {
    super({
      clientID:
        configService.get<string>('APPLE_CLIENT_ID') || 'apple-client-id',
      teamID:
        configService.get<string>('APPLE_TEAM_ID') || 'apple-team-id',
      keyID:
        configService.get<string>('APPLE_KEY_ID') || 'apple-key-id',
      privateKeyString:
        configService.get<string>('APPLE_PRIVATE_KEY') || 'apple-private-key',
      callbackURL:
        configService.get<string>('APPLE_CALLBACK_URL') ||
        'http://localhost:3000/auth/apple/callback',
      scope: ['name', 'email'],
      passReqToCallback: false,
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    idToken: any,
    profile: any,
    done: (error: any, user?: any) => void,
  ): Promise<any> {
    try {
      const email = idToken?.email || profile?.email || '';
      const providerId = idToken?.sub || profile?.id || '';
      const firstName = profile?.name?.firstName || '';
      const lastName = profile?.name?.lastName || '';

      const result = await this.oauthService.validateOAuthUser(
        OAuthProvider.APPLE,
        providerId,
        email,
        firstName,
        lastName,
        undefined,
        accessToken,
        refreshToken,
      );
      done(null, result);
    } catch (error) {
      done(error, false);
    }
  }
}