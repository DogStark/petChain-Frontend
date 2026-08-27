import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MfaService } from '../mfa.service';

export const REQUIRE_MFA_KEY = 'requireMfa';

/** Decorator to mark endpoints that require MFA verification */
export const RequireMfa = () =>
  (target: any, key?: string, descriptor?: PropertyDescriptor) => {
    if (descriptor) {
      Reflect.defineMetadata(REQUIRE_MFA_KEY, true, descriptor.value);
    } else {
      Reflect.defineMetadata(REQUIRE_MFA_KEY, true, target);
    }
    return descriptor ?? target;
  };

@Injectable()
export class MfaGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly mfaService: MfaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requireMfa = this.reflector.get<boolean>(
      REQUIRE_MFA_KEY,
      context.getHandler(),
    );

    if (!requireMfa) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user?.id) throw new UnauthorizedException('Authentication required');

    const status = await this.mfaService.getMfaStatus(user.id);
    if (!status.isEnabled) return true; // MFA not enrolled — allow through

    const mfaToken: string | undefined = request.headers['x-mfa-token'];
    const backupCode: string | undefined = request.headers['x-mfa-backup-code'];

    if (mfaToken) {
      const valid = await this.mfaService.verifyTotp(user.id, mfaToken);
      if (valid) return true;
    }

    if (backupCode) {
      const valid = await this.mfaService.verifyBackupCode(user.id, backupCode);
      if (valid) return true;
    }

    throw new UnauthorizedException(
      'MFA verification required. Provide X-MFA-Token or X-MFA-Backup-Code header.',
    );
  }
}
