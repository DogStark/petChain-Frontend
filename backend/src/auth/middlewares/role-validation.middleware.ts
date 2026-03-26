import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { RolesService } from '../services/roles.service';

/**
 * Middleware that checks if the currently authenticated user
 * has an active role in the system. Assumes the user is already
 * attached to the request by authentication middleware or guards
 * that run before it if applicable.
 */
@Injectable()
export class RoleValidationMiddleware implements NestMiddleware {
  constructor(private readonly rolesService: RolesService) {}

  async use(req: Request & { user?: any }, res: Response, next: NextFunction) {
    const user = req.user;

    // If user is attached, validate they have at least one active role
    if (user && user.id) {
      const activeRoles = await this.rolesService.getUserRoles(user.id);
      if (!activeRoles || activeRoles.length === 0) {
        throw new ForbiddenException(
          'User does not have any active roles assigned.',
        );
      }
    }

    next();
  }
}
