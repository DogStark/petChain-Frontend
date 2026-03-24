import {
  Injectable,
  CanActivate,
  ExecutionContext,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

/**
 * Optional JWT Guard
 * 
 * This guard attempts to extract and validate a JWT token from the request,
 * but does NOT fail if no token is present or if the token is invalid.
 * 
 * Use this for endpoints that work for both authenticated and anonymous users,
 * such as shared record access where we want to track logged-in user details
 * but also allow anonymous access.
 */
@Injectable()
export class OptionalJwtGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);

    if (token) {
      try {
        const secret = this.configService.get<string>('auth.jwtSecret');
        const payload = await this.jwtService.verifyAsync(token, { secret });
        
        // Attach user info to request if token is valid
        request['user'] = payload;
      } catch {
        // Invalid token - that's okay, just don't attach user
        // The endpoint will work without authentication
      }
    }

    // Always allow the request to proceed
    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
