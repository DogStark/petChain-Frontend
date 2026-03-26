import { SetMetadata } from '@nestjs/common';

export const WS_RATE_LIMIT_KEY = 'ws_rate_limit';

export interface WsRateLimitConfig {
  windowMs: number;
  maxEvents: number;
}

export const WsRateLimit = (config: WsRateLimitConfig) =>
  SetMetadata(WS_RATE_LIMIT_KEY, config);
