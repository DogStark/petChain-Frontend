import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, tap, catchError, finalize, throwError } from 'rxjs';
import { Request, Response } from 'express';
import { MetricsService } from './metrics.service';
import { TracingService } from './tracing.service';

/**
 * Intercepts every HTTP request to:
 *  - record Prometheus metrics (request count, latency histogram, error count)
 *  - emit an OpenTelemetry-compatible span
 */
@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  constructor(
    private readonly metrics: MetricsService,
    private readonly tracing: TracingService,
  ) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest<Request>();
    const res = ctx.switchToHttp().getResponse<Response>();
    const start = Date.now();
    const route = req.route?.path ?? req.path;
    const method = req.method;

    this.metrics.changeGauge('http_active_requests', 1);

    const span = this.tracing.startSpan('http.request', {
      'http.method': method,
      'http.route': route,
      'http.url': req.url,
    });

    this.metrics.inc(
      'http_requests_total',
      `method="${method}",route="${route}"`,
    );

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - start;
        const status = res.statusCode;
        this.metrics.observe(
          'http_request_duration_ms',
          duration,
          `method="${method}",route="${route}",status="${status}"`,
        );
        this.metrics.set('http_active_requests', 0);
        this.tracing.endSpan(span);
      }),
      catchError((err: Error) => {
        const duration = Date.now() - start;
        this.metrics.inc(
          'http_errors_total',
          `method="${method}",route="${route}"`,
        );
        this.metrics.observe(
          'http_request_duration_ms',
          duration,
          `method="${method}",route="${route}",status="500"`,
        );
        this.tracing.endSpan(span, err);
        return throwError(() => err);
      }),
      finalize(() => {
        this.metrics.changeGauge('http_active_requests', -1);
      }),
    );
  }
}
