import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { IpBlacklistService } from '../services/ip-blacklist.service';

@Injectable()
export class IpBlacklistGuard implements CanActivate {
  constructor(private ipBlacklistService: IpBlacklistService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const ipAddress = request.ip;

    const isBlacklisted =
      await this.ipBlacklistService.isBlacklisted(ipAddress);

    if (isBlacklisted) {
      throw new ForbiddenException('Access denied');
    }

    return true;
  }
}
