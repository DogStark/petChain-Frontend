import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, QueryRunner } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';

export interface QueryPerformanceMetrics {
  query: string;
  executionTime: number;
  timestamp: Date;
  parameters?: any[];
}

export interface DatabaseMetrics {
  activeConnections: number;
  idleConnections: number;
  waitingClients: number;
  totalQueries: number;
  slowQueries: number;
  avgQueryTime: number;
  queriesPerSecond: number;
  cacheHitRatio: number;
  indexUsageRatio: number;
  tableSizes: Record<string, number>;
  topSlowQueries: QueryPerformanceMetrics[];
}

@Injectable()
export class DatabasePerformanceService implements OnModuleInit {
  private readonly logger = new Logger(DatabasePerformanceService.name);
  private queryHistory: QueryPerformanceMetrics[] = [];
  private readonly maxQueryHistory = 1000;
  private readonly slowQueryThreshold = 1000; // ms
  private queryCount = 0;
  private lastMetricsCheck = Date.now();
  private previousTotalQueries = 0;

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async onModuleInit() {
    // Subscribe to query logging
    if (this.dataSource.queryResultCache) {
      this.logger.log('Query result cache is enabled');
    }
    
    // Log initial connection pool status
    await this.logConnectionPoolStatus();
  }

  /**
   * Log a query for performance monitoring
   */
  logQuery(
    query: string,
    executionTime: number,
    parameters?: any[],
  ): QueryPerformanceMetrics {
    const metrics: QueryPerformanceMetrics = {
      query,
      executionTime,
      timestamp: new Date(),
      parameters,
    };

    this.queryHistory.push(metrics);
    this.queryCount++;

    // Keep only recent queries in memory
    if (this.queryHistory.length > this.maxQueryHistory) {
      this.queryHistory.shift();
    }

    // Log slow queries
    if (executionTime > this.slowQueryThreshold) {
      this.logger.warn(
        `Slow query detected: ${executionTime}ms - ${query.substring(0, 200)}`,
      );
    }

    return metrics;
  }

  /**
   * Get current database performance metrics
   */
  async getMetrics(): Promise<DatabaseMetrics> {
    const queryRunner = this.dataSource.createQueryRunner();
    
    try {
      const poolStats = await this.getPoolStats(queryRunner);
      const dbStats = await this.getDatabaseStats(queryRunner);
      const tableSizes = await this.getTableSizes(queryRunner);
      const topSlowQueries = this.getTopSlowQueries();
      const queriesPerSecond = this.calculateQueriesPerSecond();

      return {
        activeConnections: poolStats.activeConnections || 0,
        idleConnections: poolStats.idleConnections || 0,
        waitingClients: poolStats.waitingClients || 0,
        totalQueries: dbStats.totalQueries || 0,
        slowQueries: dbStats.slowQueries || 0,
        avgQueryTime: dbStats.avgQueryTime || 0,
        queriesPerSecond,
        cacheHitRatio: dbStats.cacheHitRatio || 0,
        indexUsageRatio: dbStats.indexUsageRatio || 0,
        tableSizes,
        topSlowQueries,
      };
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Get slow queries from the history
   */
  getSlowQueries(limit = 10): QueryPerformanceMetrics[] {
    return this.queryHistory
      .filter((q) => q.executionTime > this.slowQueryThreshold)
      .sort((a, b) => b.executionTime - a.executionTime)
      .slice(0, limit);
  }

  /**
   * Get top N slow queries
   */
  private getTopSlowQueries(limit = 10): QueryPerformanceMetrics[] {
    return this.getSlowQueries(limit);
  }

  /**
   * Calculate queries per second
   */
  private calculateQueriesPerSecond(): number {
    const now = Date.now();
    const timeDiff = (now - this.lastMetricsCheck) / 1000; // seconds
    
    if (timeDiff <= 0) return 0;
    
    const queryDiff = this.queryCount - this.previousTotalQueries;
    const qps = queryDiff / timeDiff;
    
    // Reset counters
    this.lastMetricsCheck = now;
    this.previousTotalQueries = this.queryCount;
    
    return parseFloat(qps.toFixed(2));
  }

  /**
   * Get connection pool statistics
   */
  private async getPoolStats(queryRunner: QueryRunner): Promise<{
    activeConnections: number;
    idleConnections: number;
    waitingClients: number;
  }> {
    try {
      // PostgreSQL pool statistics
      const result = await queryRunner.query(`
        SELECT 
          COUNT(*) FILTER (WHERE state = 'active') as active,
          COUNT(*) FILTER (WHERE state = 'idle') as idle,
          COUNT(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction,
          COUNT(*) FILTER (WHERE wait_event_type = 'Lock') as waiting
        FROM pg_stat_activity
        WHERE datname = current_database()
      `);

      return {
        activeConnections: parseInt(result[0].active, 10),
        idleConnections: parseInt(result[0].idle, 10),
        waitingClients: parseInt(result[0].waiting, 10),
      };
    } catch (error) {
      this.logger.error('Failed to get pool stats', error);
      return { activeConnections: 0, idleConnections: 0, waitingClients: 0 };
    }
  }

  /**
   * Get database-level statistics
   */
  private async getDatabaseStats(queryRunner: QueryRunner): Promise<{
    totalQueries: number;
    slowQueries: number;
    avgQueryTime: number;
    cacheHitRatio: number;
    indexUsageRatio: number;
  }> {
    try {
      // Get database statistics
      const dbStats = await queryRunner.query(`
        SELECT 
          numbackends as total_connections,
          xact_commit as transactions_committed,
          xact_rollback as transactions_rolled_back,
          blks_read as blocks_read,
          blks_hit as blocks_hit,
          tup_returned as tuples_returned,
          tup_fetched as tuples_fetched,
          tup_inserted as tuples_inserted,
          tup_updated as tuples_updated,
          tup_deleted as tuples_deleted
        FROM pg_stat_database
        WHERE datname = current_database()
      `);

      const stats = dbStats[0];
      const cacheHitRatio = stats.blocks_hit > 0
        ? (stats.blocks_hit / (stats.blocks_read + stats.blocks_hit)) * 100
        : 0;

      // Get index usage statistics
      const indexStats = await queryRunner.query(`
        SELECT 
          SUM(idx_scan) as index_scans,
          SUM(seq_scan) as sequential_scans
        FROM pg_stat_user_tables
      `);

      const indexStat = indexStats[0];
      const totalScans = parseInt(indexStat.index_scans, 10) + parseInt(indexStat.sequential_scans, 10);
      const indexUsageRatio = totalScans > 0
        ? (parseInt(indexStat.index_scans, 10) / totalScans) * 100
        : 0;

      // Get slow query count from pg_stat_statements if available
      let slowQueries = 0;
      let avgQueryTime = 0;
      
      try {
        const slowQueryStats = await queryRunner.query(`
          SELECT 
            COUNT(*) as slow_count,
            AVG(total_exec_time) as avg_time
          FROM pg_stat_statements
          WHERE total_exec_time > ${this.slowQueryThreshold}
        `);
        
        if (slowQueryStats[0]) {
          slowQueries = parseInt(slowQueryStats[0].slow_count, 10);
          avgQueryTime = parseFloat(slowQueryStats[0].avg_time) || 0;
        }
      } catch (e) {
        // pg_stat_statements might not be enabled
        this.logger.debug('pg_stat_statements not available');
      }

      return {
        totalQueries: stats.transactions_committed + stats.transactions_rolled_back,
        slowQueries,
        avgQueryTime,
        cacheHitRatio: parseFloat(cacheHitRatio.toFixed(2)),
        indexUsageRatio: parseFloat(indexUsageRatio.toFixed(2)),
      };
    } catch (error) {
      this.logger.error('Failed to get database stats', error);
      return {
        totalQueries: 0,
        slowQueries: 0,
        avgQueryTime: 0,
        cacheHitRatio: 0,
        indexUsageRatio: 0,
      };
    }
  }

  /**
   * Get table sizes
   */
  private async getTableSizes(queryRunner: QueryRunner): Promise<Record<string, number>> {
    try {
      const result = await queryRunner.query(`
        SELECT 
          relname as table_name,
          pg_total_relation_size(relid) as total_size
        FROM pg_catalog.pg_statio_user_tables
        ORDER BY pg_total_relation_size(relid) DESC
        LIMIT 20
      `);

      const tableSizes: Record<string, number> = {};
      for (const row of result) {
        tableSizes[row.table_name] = parseInt(row.total_size, 10);
      }

      return tableSizes;
    } catch (error) {
      this.logger.error('Failed to get table sizes', error);
      return {};
    }
  }

  /**
   * Log connection pool status
   */
  private async logConnectionPoolStatus(): Promise<void> {
    try {
      const queryRunner = this.dataSource.createQueryRunner();
      const stats = await this.getPoolStats(queryRunner);
      await queryRunner.release();

      this.logger.log(
        `Connection Pool Status - Active: ${stats.activeConnections}, Idle: ${stats.idleConnections}, Waiting: ${stats.waitingClients}`,
      );
    } catch (error) {
      this.logger.error('Failed to log connection pool status', error);
    }
  }

  /**
   * Periodically log database performance metrics
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async logPeriodicMetrics(): Promise<void> {
    try {
      const metrics = await this.getMetrics();
      
      this.logger.log(
        `Database Metrics - ` +
        `Queries: ${metrics.totalQueries}, ` +
        `Slow: ${metrics.slowQueries}, ` +
        `Avg Time: ${metrics.avgQueryTime.toFixed(2)}ms, ` +
        `QPS: ${metrics.queriesPerSecond}, ` +
        `Cache Hit: ${metrics.cacheHitRatio}%, ` +
        `Index Usage: ${metrics.indexUsageRatio}%`,
      );
    } catch (error) {
      this.logger.error('Failed to log periodic metrics', error);
    }
  }

  /**
   * Analyze query performance and provide recommendations
   */
  async analyzePerformance(): Promise<{
    recommendations: string[];
    warnings: string[];
  }> {
    const recommendations: string[] = [];
    const warnings: string[] = [];

    try {
      const metrics = await this.getMetrics();

      // Check connection pool usage
      const totalConnections = metrics.activeConnections + metrics.idleConnections;
      if (totalConnections > 0) {
        const activeRatio = (metrics.activeConnections / totalConnections) * 100;
        if (activeRatio > 80) {
          warnings.push(
            `High connection pool usage: ${activeRatio.toFixed(2)}% active connections`,
          );
          recommendations.push(
            'Consider increasing the maximum connection pool size (DB_POOL_MAX)',
          );
        }
      }

      // Check for waiting clients
      if (metrics.waitingClients > 0) {
        warnings.push(
          `${metrics.waitingClients} queries waiting for database connections`,
        );
        recommendations.push(
          'Increase connection pool size or optimize long-running queries',
        );
      }

      // Check cache hit ratio
      if (metrics.cacheHitRatio < 90) {
        recommendations.push(
          `Cache hit ratio is ${metrics.cacheHitRatio}%. Consider increasing shared_buffers in PostgreSQL configuration`,
        );
      }

      // Check index usage
      if (metrics.indexUsageRatio < 80) {
        recommendations.push(
          `Index usage ratio is ${metrics.indexUsageRatio}%. Review queries performing sequential scans and add appropriate indexes`,
        );
      }

      // Check for slow queries
      if (metrics.slowQueries > 10) {
        warnings.push(`${metrics.slowQueries} slow queries detected in the monitoring period`);
        recommendations.push('Review and optimize slow queries using pg_stat_statements');
      }

      // Check query rate
      if (metrics.queriesPerSecond > 100) {
        warnings.push(`High query rate: ${metrics.queriesPerSecond} queries/second`);
        recommendations.push('Consider implementing query caching for frequently executed queries');
      }

    } catch (error) {
      this.logger.error('Failed to analyze performance', error);
      warnings.push('Failed to analyze database performance');
    }

    return { recommendations, warnings };
  }

  /**
   * Get query execution plan for a given query
   */
  async getQueryExecutionPlan(query: string, parameters?: any[]): Promise<any> {
    const queryRunner = this.dataSource.createQueryRunner();
    
    try {
      const explainQuery = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`;
      const result = await queryRunner.query(explainQuery, parameters);
      return result[0];
    } catch (error) {
      this.logger.error('Failed to get query execution plan', error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Clear query history
   */
  clearQueryHistory(): void {
    this.queryHistory = [];
    this.logger.log('Query history cleared');
  }
}
