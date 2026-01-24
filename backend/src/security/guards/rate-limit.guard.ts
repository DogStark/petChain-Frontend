import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  RATE_LIMIT_KEY,
  RateLimitOptions,
} from '../decorators/rate-limit.decorator';
import { SECURITY_CONSTANTS } from '../constants/security.constants';

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @Inject(CACHE_MANAGER)
    private cacheManager: Cache,
    private eventEmitter: EventEmitter2,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const rateLimitOptions = this.reflector.get<RateLimitOptions>(
      RATE_LIMIT_KEY,
      context.getHandler(),
    );

    if (!rateLimitOptions) return true;

    const request = context.switchToHttp().getRequest();
    const key = `rate_limit:${request.ip}:${request.url}`;

    const { ttl, limit } = rateLimitOptions;
    const current = (await this.cacheManager.get<number>(key)) || 0;

    if (current >= limit) {
      this.eventEmitter.emit('security.rate.limit.exceeded', {
        ipAddress: request.ip,
        endpoint: request.url,
        attempts: current,
      });

      throw new HttpException(
        'Rate limit exceeded',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    await this.cacheManager.set(key, current + 1, ttl * 1000);
    return true;
  }
}
