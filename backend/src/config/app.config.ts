import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  apiPrefix: process.env.API_PREFIX || 'api/v1',
  // Comma-separated list of allowed origins, e.g. "https://app.example.com,https://admin.example.com"
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
}));
