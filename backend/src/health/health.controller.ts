import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  async check() {
    return this.healthService.getHealthStatus();
  }

  @Get('metrics')
  async getMetrics() {
    return this.healthService.getPerformanceMetrics();
  }

  @Get('ready')
  async readiness() {
    return this.healthService.checkReadiness();
  }

  @Get('live')
  async liveness() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
