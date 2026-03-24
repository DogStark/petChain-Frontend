import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from './guards/api-key.guard';

@Controller('integrations')
export class IntegrationsController {
  @Get('ping')
  @UseGuards(ApiKeyGuard)
  ping() {
    return { ok: true, via: 'api-key', time: new Date().toISOString() };
  }
}
