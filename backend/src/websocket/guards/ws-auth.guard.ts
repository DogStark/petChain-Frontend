import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { WsException } from '@nestjs/websockets';

@Injectable()
export class WsAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const client = context.switchToWs().getClient();
    const token =
      client.handshake?.auth?.token || client.handshake?.headers?.authorization;

    if (!token) {
      throw new WsException('Unauthorized');
    }

    //TODO: Add JWT verification here

    return true;
  }
}
