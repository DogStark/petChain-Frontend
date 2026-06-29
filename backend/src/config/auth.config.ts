import { registerAs } from '@nestjs/config';

const FALLBACK_JWT_SECRET = 'your-secret-key-min-32-chars-change-in-production';

if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET must be set in production environments');
}

export const authConfig = registerAs('auth', () => ({
  jwtSecret: process.env.JWT_SECRET || FALLBACK_JWT_SECRET,
  jwtAccessExpiration: process.env.JWT_ACCESS_EXPIRATION || '15m',
  jwtRefreshExpiration: process.env.JWT_REFRESH_EXPIRATION || '7d',
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
  maxConcurrentSessions: parseInt(
    process.env.MAX_CONCURRENT_SESSIONS || '3',
    10,
  ),
  accountLockoutDuration: process.env.ACCOUNT_LOCKOUT_DURATION || '30m',
  passwordResetExpiration: process.env.PASSWORD_RESET_EXPIRATION || '1h',
  emailVerificationExpiration:
    process.env.EMAIL_VERIFICATION_EXPIRATION || '24h',
  phoneVerificationExpiration:
    process.env.PHONE_VERIFICATION_EXPIRATION || '24h',
  maxFailedLoginAttempts: 5,
}));
