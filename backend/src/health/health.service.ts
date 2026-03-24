import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private startTime = Date.now();

  constructor(
    @InjectDataSource() private dataSource: DataSource,
  ) {}

  async getHealthStatus() {
    const dbHealth = await this.checkDatabase();

    const status = dbHealth ? 'healthy' : 'unhealthy';

    return {
      status,
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      services: {
        database: dbHealth ? 'up' : 'down',
      },
    };
  }

  async getPerformanceMetrics() {
    const memoryUsage = process.memoryUsage();
    
    return {
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      memory: {
        rss: Math.round(memoryUsage.rss / 1024 / 1024),
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        external: Math.round(memoryUsage.external / 1024 / 1024),
      },
      cpu: process.cpuUsage(),
    };
  }

  async checkReadiness() {
    try {
      const dbReady = await this.checkDatabase();

      if (!dbReady) {
        return { ready: false, reason: 'Database not ready' };
      }

      return { ready: true };
    } catch (error) {
      this.logger.error('Readiness check failed', error);
      return { ready: false, reason: error.message };
    }
  }

  private async checkDatabase(): Promise<boolean> {
    try {
      await this.dataSource.query('SELECT 1');
      return true;
    } catch (error) {
      this.logger.error('Database health check failed', error);
      return false;
    }
  }
}
