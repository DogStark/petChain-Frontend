import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { SECURITY_CONSTANTS } from '../constants/security.constants';

@Injectable()
export class DdosProtectionGuard implements CanActivate {
  constructor(
    @Inject(CACHE_MANAGER)
    private cacheManager: Cache,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const key = `ddos:${request.ip}`;

    const requests = (await this.cacheManager.get<number>(key)) || 0;

    if (requests >= SECURITY_CONSTANTS.DDOS.REQUEST_THRESHOLD) {
      throw new HttpException(
        'Too many requests',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    await this.cacheManager.set(
      key,
      requests + 1,
      SECURITY_CONSTANTS.DDOS.TIME_WINDOW,
    );

    return true;
  }
}
