import { Logger, QueryRunner } from 'typeorm';
import { Injectable } from '@nestjs/common';

/**
 * Custom TypeORM logger for query performance monitoring
 */
@Injectable()
export class CustomTypeOrmLogger implements Logger {
  private readonly slowQueryThreshold = 1000; // ms

  /**
   * Log query execution
   */
  logQuery(query: string, parameters?: any[], queryRunner?: QueryRunner) {
    // Extract execution time from queryRunner if available
    const executionTime = this.getExecutionTime(queryRunner);
    
    if (executionTime && executionTime > this.slowQueryThreshold) {
      console.warn(
        `\x1b[33m[Slow Query]\x1b[0m ${executionTime}ms - ${query}`,
        parameters?.length ? `Params: ${JSON.stringify(parameters)}` : '',
      );
    }
  }

  /**
   * Log query errors
   */
  logQueryError(
    error: string,
    query: string,
    parameters?: any[],
    queryRunner?: QueryRunner,
  ) {
    console.error(
      `\x1b[31m[Query Error]\x1b[0m ${error}`,
      `\nQuery: ${query}`,
      parameters?.length ? `Params: ${JSON.stringify(parameters)}` : '',
    );
  }

  /**
   * Log slow queries above threshold
   */
  logQuerySlow(
    time: number,
    query: string,
    parameters?: any[],
    queryRunner?: QueryRunner,
  ) {
    console.warn(
      `\x1b[33m[Query Timeout]\x1b[0m ${time}ms - ${query}`,
      parameters?.length ? `Params: ${JSON.stringify(parameters)}` : '',
    );
  }

  /**
   * Log schema building messages
   */
  logSchemaBuild(message: string, queryRunner?: QueryRunner) {
    console.log(`\x1b[36m[Schema]\x1b[0m ${message}`);
  }

  /**
   * Log migration messages
   */
  logMigration(message: string, queryRunner?: QueryRunner) {
    console.log(`\x1b[35m[Migration]\x1b[0m ${message}`);
  }

  /**
   * Log general TypeORM messages
   */
  log(level: 'log' | 'info' | 'warn', message: any, queryRunner?: QueryRunner) {
    switch (level) {
      case 'log':
        console.log(`\x1b[34m[TypeORM Log]\x1b[0m`, message);
        break;
      case 'info':
        console.info(`\x1b[32m[TypeORM Info]\x1b[0m`, message);
        break;
      case 'warn':
        console.warn(`\x1b[33m[TypeORM Warn]\x1b[0m`, message);
        break;
    }
  }

  /**
   * Extract execution time from queryRunner
   */
  private getExecutionTime(queryRunner?: QueryRunner): number | null {
    if (queryRunner && (queryRunner as any).queryDuration) {
      return (queryRunner as any).queryDuration;
    }
    return null;
  }
}
