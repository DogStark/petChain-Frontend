import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from '../../modules/audit/audit.service';
import { AuditAction } from '../../modules/audit/entities/audit-log.entity';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, user, ip, headers } = request;

    // Determine action based on HTTP method
    let action: AuditAction;
    switch (method) {
      case 'POST':
        action = AuditAction.CREATE;
        break;
      case 'GET':
        action = AuditAction.READ;
        break;
      case 'PATCH':
      case 'PUT':
        action = AuditAction.UPDATE;
        break;
      case 'DELETE':
        action = AuditAction.DELETE;
        break;
      default:
        action = AuditAction.READ;
    }

    return next.handle().pipe(
      tap(async (data) => {
        // Only log medical record related endpoints
        if (
          url.includes('/medical-records') ||
          url.includes('/vaccinations') ||
          url.includes('/prescriptions') ||
          url.includes('/allergies')
        ) {
          const entityType = this.extractEntityType(url);
          const entityId = this.extractEntityId(url, data);

          if (entityId) {
            await this.auditService.log(
              user?.id || 'anonymous',
              entityType,
              entityId,
              action,
              ip,
              headers['user-agent'],
            );
          }
        }
      }),
    );
  }

  private extractEntityType(url: string): string {
    if (url.includes('/medical-records')) return 'medical_record';
    if (url.includes('/vaccinations')) return 'vaccination';
    if (url.includes('/prescriptions')) return 'prescription';
    if (url.includes('/allergies')) return 'allergy';
    return 'unknown';
  }

  private extractEntityId(url: string, data: any): string | null {
    // Extract ID from URL path
    const matches = url.match(/\/([a-f0-9-]{36})/i);
    if (matches) {
      return matches[1];
    }

    // Extract ID from response data
    if (data && data.id) {
      return data.id;
    }

    return null;
  }
}
