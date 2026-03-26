import { SetMetadata } from '@nestjs/common';
import { SECURITY_CONSTANTS } from '../constants/security.constants';

export const RATE_LIMIT_KEY = 'rate_limit';

export interface RateLimitOptions {
  ttl: number;
  limit: number;
}

export const RateLimit = (options?: Partial<RateLimitOptions>) =>
  SetMetadata(RATE_LIMIT_KEY, {
    ttl: options?.ttl || SECURITY_CONSTANTS.RATE_LIMIT.DEFAULT_TTL,
    limit: options?.limit || SECURITY_CONSTANTS.RATE_LIMIT.DEFAULT_LIMIT,
  });

export const StrictRateLimit = () =>
  SetMetadata(RATE_LIMIT_KEY, {
    ttl: SECURITY_CONSTANTS.RATE_LIMIT.STRICT_TTL,
    limit: SECURITY_CONSTANTS.RATE_LIMIT.STRICT_LIMIT,
  });
