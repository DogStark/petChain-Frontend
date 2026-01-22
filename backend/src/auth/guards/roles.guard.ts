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
    // Get required roles and permissions from route metadata
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no roles or permissions are required, allow access
    if (!requiredRoles && !requiredPermissions) {
      return true;
    }

    // Get current user from request (set by JwtAuthGuard)
    const request = context.switchToHttp().getRequest();
    const user: User = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Check roles if required
    if (requiredRoles && requiredRoles.length > 0) {
      const userRoles = await this.rolesService.getUserRoles(user.id);
      const userRoleNames = userRoles.map((role) => role.name);

      // Check if user has at least one of the required roles
      const hasRequiredRole = requiredRoles.some((requiredRole) =>
        userRoleNames.includes(requiredRole as RoleName),
      );

      if (!hasRequiredRole) {
        throw new ForbiddenException(
          `Access denied. Required roles: ${requiredRoles.join(', ')}`,
        );
      }
    }

    // Check permissions if required
    if (requiredPermissions && requiredPermissions.length > 0) {
      const userPermissions = await this.rolesService.getUserPermissions(
        user.id,
      );

      // Check if user has all required permissions
      const hasAllPermissions = requiredPermissions.every(
        (requiredPermission) =>
          this.permissionsService.checkPermissionAccess(
            userPermissions,
            requiredPermission,
          ),
      );

      if (!hasAllPermissions) {
        throw new ForbiddenException(
          `Access denied. Required permissions: ${requiredPermissions.join(', ')}`,
        );
      }
    }

    return true;
  }
}
