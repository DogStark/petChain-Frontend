import { SetMetadata } from '@nestjs/common';
import { API_KEY_SCOPES } from '../guards/api-key.guard';

/** Require specific scopes on an API-key-protected endpoint */
export const ApiKeyScopes = (...scopes: string[]) =>
  SetMetadata(API_KEY_SCOPES, scopes);
