import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { OAuthService } from '../services/oauth.service';
import { OAuthProvider } from '../entities/oauth-user.entity';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    private readonly configService: ConfigService,
    private readonly oauthService: OAuthService,
  ) {
    super({
      clientID:
        configService.get<string>('GOOGLE_CLIENT_ID') || 'google-client-id',
      clientSecret:
        configService.get<string>('GOOGLE_CLIENT_SECRET') ||
        'google-client-secret',
      callbackURL:
        configService.get<string>('GOOGLE_CALLBACK_URL') ||
        'http://localhost:3000/auth/google/callback',
      scope: ['email', 'profile'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    const { id, emails, photos, name } = profile;
    const email = emails?.[0]?.value;
    const avatarUrl = photos?.[0]?.value;
    const firstName = name?.givenName || '';
    const lastName = name?.familyName || '';

    try {
      const result = await this.oauthService.validateOAuthUser(
        OAuthProvider.GOOGLE,
        id,
        email,
        firstName,
        lastName,
        avatarUrl,
        accessToken,
        refreshToken,
      );
      done(null, result);
    } catch (error) {
      done(error, false);
    }
  }
}
