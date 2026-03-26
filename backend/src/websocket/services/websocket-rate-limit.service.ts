import { Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import { Cache } from 'cache-manager';

export interface RateLimitConfig {
  windowMs: number;
  maxEvents: number;
}

@Injectable()
export class WebSocketRateLimitService {
  private readonly DEFAULT_CONFIG: RateLimitConfig = {
    windowMs: 60000, // 1 minute
    maxEvents: 100,
  };

  constructor(
    @Inject(CACHE_MANAGER)
    private cacheManager: Cache,
  ) {}

  async checkRateLimit(
    userId: string,
    event: string,
    config: RateLimitConfig = this.DEFAULT_CONFIG,
  ): Promise<{ allowed: boolean; remaining: number }> {
    const key = `ws_rate_limit:${userId}:${event}`;
    const current = (await this.cacheManager.get<number>(key)) || 0;

    if (current >= config.maxEvents) {
      return { allowed: false, remaining: 0 };
    }

    await this.cacheManager.set(key, current + 1, config.windowMs);

    return {
      allowed: true,
      remaining: config.maxEvents - current - 1,
    };
  }

  async resetRateLimit(userId: string, event: string): Promise<void> {
    const key = `ws_rate_limit:${userId}:${event}`;
    await this.cacheManager.del(key);
  }
}
