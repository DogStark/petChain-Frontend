import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { RolesService } from '../services/roles.service';
import { PermissionsService } from '../services/permissions.service';
import { User } from '../../modules/users/entities/user.entity';
import { RoleName } from '../constants/roles.enum';
import { Permission } from '../constants/permissions.enum';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rolesService: RolesService,
    private readonly permissionsService: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions =
      this.reflector.getAllAndOverride<Permission[]>(
        PERMISSIONS_KEY,
        [context.getHandler(), context.getClass()],
      );

    const requiredRoles =
      this.reflector.getAllAndOverride<RoleName[]>(
        ROLES_KEY,
        [context.getHandler(), context.getClass()],
      );

    // If nothing required → allow
    if (!requiredPermissions?.length && !requiredRoles?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user: User = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    /*
     |--------------------------------------------------------------------------
     | PERMISSION-BASED CHECK (PRIMARY)
     |--------------------------------------------------------------------------
     */
    if (requiredPermissions?.length) {
      const userPermissions =
        await this.rolesService.getUserPermissions(user.id);

      const hasAllPermissions = requiredPermissions.every((permission) =>
        this.permissionsService.checkPermissionAccess(
          userPermissions,
          permission,
        ),
      );

      if (!hasAllPermissions) {
        throw new ForbiddenException(
          `Access denied. Missing required permissions.`,
        );
      }

      return true;
    }

    /*
     |--------------------------------------------------------------------------
     | ROLE-BASED CHECK (SECONDARY / EXPLICIT)
     |--------------------------------------------------------------------------
     */
    if (requiredRoles?.length) {
      const userRoles = await this.rolesService.getUserRoles(user.id);
      const userRoleNames = userRoles.map((r) => r.name);

      const hasRequiredRole = requiredRoles.some((role) =>
        userRoleNames.includes(role),
      );

      if (!hasRequiredRole) {
        throw new ForbiddenException(
          `Access denied. Required roles: ${requiredRoles.join(', ')}`,
        );
      }

      return true;
    }

    return true;
  }
}