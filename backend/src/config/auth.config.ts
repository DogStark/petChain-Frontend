import { registerAs } from '@nestjs/config';

const MIN_SECRET_LENGTH = 32;

function resolveJwtSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (!secret || secret.trim().length === 0) {
    throw new Error(
      'JWT_SECRET environment variable is required and must be set to a strong, unique value.',
    );
  }

  if (secret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `JWT_SECRET must be at least ${MIN_SECRET_LENGTH} characters long.`,
    );
  }

  if (new Set(secret).size < 8) {
    throw new Error(
      'JWT_SECRET appears to have insufficient entropy; use a longer, more random value.',
    );
  }

  return secret;
}

export default registerAs('auth', () => ({
  jwtSecret: resolveJwtSecret(),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
}));
