import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { tap } from 'rxjs';
import { AuditService } from './audit.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest();

    const { method, url, body, user } = request;

    return next.handle().pipe(
      tap(async (responseData) => {
        try {
          await this.auditService.logAction({
            action: method,
            entity: url,
            userId: user?.id || 'anonymous',
            newData: body,
          });
        } catch (err) {
          console.error('Audit log failed:', err);
        }
      }),
    );
  }
}