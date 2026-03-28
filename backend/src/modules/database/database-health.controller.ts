import {
  Controller,
  Get,
  Post,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { DatabasePerformanceService } from './database-performance.service';

@ApiTags('Database')
@Controller('database')
export class DatabaseHealthController {
  constructor(
    private readonly databasePerformanceService: DatabasePerformanceService,
  ) {}

  @Get('health')
  @ApiOperation({ summary: 'Check database health status' })
  async healthCheck() {
    const queryRunner =
      this.databasePerformanceService['dataSource'].createQueryRunner();

    try {
      await queryRunner.connect();
      await queryRunner.query('SELECT 1');
      const isConnected = true;

      const poolStats =
        await this.databasePerformanceService['getPoolStats'](queryRunner);
      const dbStats =
        await this.databasePerformanceService['getDatabaseStats'](queryRunner);

      return {
        status: 'healthy',
        isConnected,
        timestamp: new Date().toISOString(),
        connections: {
          active: poolStats.activeConnections,
          idle: poolStats.idleConnections,
          waiting: poolStats.waitingClients,
        },
        metrics: {
          totalQueries: dbStats.totalQueries,
          cacheHitRatio: dbStats.cacheHitRatio,
          indexUsageRatio: dbStats.indexUsageRatio,
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        isConnected: false,
        timestamp: new Date().toISOString(),
        error: error.message,
      };
    } finally {
      await queryRunner.release();
    }
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Get detailed database performance metrics' })
  async getMetrics() {
    return await this.databasePerformanceService.getMetrics();
  }

  @Get('analysis')
  @ApiOperation({
    summary: 'Analyze database performance and get recommendations',
  })
  async analyzePerformance() {
    return await this.databasePerformanceService.analyzePerformance();
  }

  @Get('slow-queries')
  @ApiOperation({ summary: 'Get slow queries from history' })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of slow queries to return',
  })
  async getSlowQueries(@Query('limit') limit?: number) {
    return {
      slowQueries: await this.databasePerformanceService.getSlowQueries(
        limit || 10,
      ),
    };
  }

  @Post('query/analyze')
  @ApiOperation({
    summary: 'Get execution plan for a query (USE WITH CAUTION)',
  })
  @ApiQuery({ name: 'query', description: 'SQL query to analyze' })
  async analyzeQuery(@Query('query') query: string) {
    // Security: Only allow SELECT queries in production
    if (
      !query.trim().toUpperCase().startsWith('SELECT') &&
      !query.trim().toUpperCase().startsWith('EXPLAIN')
    ) {
      return {
        error: 'Only SELECT queries can be analyzed for security reasons',
      };
    }

    try {
      const plan =
        await this.databasePerformanceService.getQueryExecutionPlan(query);
      return { executionPlan: plan };
    } catch (error) {
      return { error: error.message };
    }
  }

  @Delete('query/history')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Clear query history' })
  async clearQueryHistory() {
    this.databasePerformanceService.clearQueryHistory();
    return { message: 'Query history cleared' };
  }

  @Get('connection-pool')
  @ApiOperation({ summary: 'Get connection pool statistics' })
  async getConnectionPoolStats() {
    const queryRunner =
      this.databasePerformanceService['dataSource'].createQueryRunner();

    try {
      const stats =
        await this.databasePerformanceService['getPoolStats'](queryRunner);
      return {
        pool: {
          ...stats,
          total: stats.activeConnections + stats.idleConnections,
        },
        timestamp: new Date().toISOString(),
      };
    } finally {
      await queryRunner.release();
    }
  }

  @Get('table-sizes')
  @ApiOperation({ summary: 'Get table sizes in the database' })
  async getTableSizes() {
    const queryRunner =
      this.databasePerformanceService['dataSource'].createQueryRunner();

    try {
      const sizes =
        await this.databasePerformanceService['getTableSizes'](queryRunner);

      // Format sizes in human-readable format
      const formattedSizes: Record<string, string> = {};
      for (const [table, size] of Object.entries(sizes)) {
        formattedSizes[table] = this.formatBytes(size);
      }

      return {
        tables: formattedSizes,
        timestamp: new Date().toISOString(),
      };
    } finally {
      await queryRunner.release();
    }
  }

  private formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let unitIndex = 0;
    let size = bytes;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }
}
