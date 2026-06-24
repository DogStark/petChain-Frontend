import { Injectable, Logger } from '@nestjs/common';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  service: string;
  message: string;
  traceId?: string;
  spanId?: string;
  [key: string]: unknown;
}

/**
 * Structured JSON logger — output is compatible with Logstash/Filebeat/Fluentd.
 * Each line is a valid JSON object for ELK ingestion.
 */
@Injectable()
export class LogAggregatorService {
  private readonly nestLogger = new Logger('LogAggregator');

  log(
    level: LogLevel,
    message: string,
    context: Record<string, unknown> = {},
  ): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: 'petchain-backend',
      message,
      ...context,
    };
    // Emit as single-line JSON — picked up by any log shipper
    this.nestLogger.log(JSON.stringify(entry));
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log('warn', message, context);
  }

  error(
    message: string,
    error?: Error,
    context?: Record<string, unknown>,
  ): void {
    this.log('error', message, {
      ...context,
      errorMessage: error?.message,
      stack: error?.stack,
    });
  }
}
