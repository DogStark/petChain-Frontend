import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Reflector } from '@nestjs/core';
import { CACHE_KEY, CACHE_TTL_KEY } from '../decorators/cache.decorator';

@Injectable()
export class CacheInterceptor implements NestInterceptor {
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private reflector: Reflector,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const shouldCache = this.reflector.get<boolean>(
      CACHE_KEY,
      context.getHandler(),
    );

    if (!shouldCache) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const cacheKey = this.generateCacheKey(request);

    const cachedResponse = await this.cacheManager.get(cacheKey);
    if (cachedResponse) {
      return of(cachedResponse);
    }

    const ttl = this.reflector.get<number>(CACHE_TTL_KEY, context.getHandler()) || 300;

    return next.handle().pipe(
      tap(async (response) => {
        await this.cacheManager.set(cacheKey, response, ttl * 1000);
      }),
    );
  }

  private generateCacheKey(request: any): string {
    const { method, url, user } = request;
    const userId = user?.id || 'anonymous';
    return `${method}:${url}:${userId}`;
  }
}
