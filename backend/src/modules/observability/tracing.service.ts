import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';

export interface Span {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  startTime: number;
  endTime?: number;
  attributes: Record<string, string | number | boolean>;
  status: 'ok' | 'error';
  error?: string;
}

/**
 * Lightweight OpenTelemetry-compatible tracer.
 * Emits structured JSON spans to stdout (compatible with ELK/Loki log shippers).
 * Replace with @opentelemetry/sdk-node + OTLP exporter when the OTel collector
 * is available in the deployment environment.
 */
@Injectable()
export class TracingService {
  private readonly logger = new Logger('Tracing');
  private readonly activeSpans = new Map<string, Span>();

  startSpan(name: string, attributes: Record<string, string | number | boolean> = {}, parentSpanId?: string): Span {
    const span: Span = {
      traceId: parentSpanId ? this._traceIdFor(parentSpanId) : randomUUID().replace(/-/g, ''),
      spanId: randomUUID().replace(/-/g, '').slice(0, 16),
      parentSpanId,
      name,
      startTime: Date.now(),
      attributes,
      status: 'ok',
    };
    this.activeSpans.set(span.spanId, span);
    return span;
  }

  endSpan(span: Span, error?: Error): void {
    span.endTime = Date.now();
    if (error) {
      span.status = 'error';
      span.error = error.message;
    }
    this.activeSpans.delete(span.spanId);
    this.logger.log(JSON.stringify({
      type: 'span',
      ...span,
      durationMs: span.endTime - span.startTime,
    }));
  }

  /** Wrap an async function in a span */
  async trace<T>(
    name: string,
    fn: (span: Span) => Promise<T>,
    attributes: Record<string, string | number | boolean> = {},
    parentSpanId?: string,
  ): Promise<T> {
    const span = this.startSpan(name, attributes, parentSpanId);
    try {
      const result = await fn(span);
      this.endSpan(span);
      return result;
    } catch (err) {
      this.endSpan(span, err as Error);
      throw err;
    }
  }

  private _traceIdFor(spanId: string): string {
    return this.activeSpans.get(spanId)?.traceId ?? randomUUID().replace(/-/g, '');
  }
}
