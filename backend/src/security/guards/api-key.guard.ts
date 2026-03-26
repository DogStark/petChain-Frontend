import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiKeyService } from '../services/api-key.service';

export const API_KEY_SCOPES = 'api_key_scopes';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly apiKeyService: ApiKeyService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Accept key from header or query param
    const rawKey =
      request.headers['x-api-key'] ||
      request.query['api_key'];

    if (!rawKey) {
      throw new UnauthorizedException('API key is required');
    }

    const result = await this.apiKeyService.validate(rawKey, request.ip);

    if (!result.valid) {
      throw new UnauthorizedException(result.reason || 'Invalid API key');
    }

    // Scope check
    const requiredScopes = this.reflector.get<string[]>(
      API_KEY_SCOPES,
      context.getHandler(),
    );

    if (requiredScopes?.length) {
      const keyScopes = result.apiKey!.scopes ?? [];
      const hasScopes = requiredScopes.every((s) => keyScopes.includes(s));
      if (!hasScopes) {
        throw new UnauthorizedException('Insufficient API key scopes');
      }
    }

    // Attach to request for downstream use
    request.apiKey = result.apiKey;
    return true;
  }
}
