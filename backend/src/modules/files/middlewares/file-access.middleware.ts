// @ts-nocheck
import {
  Injectable,
  NestMiddleware,
  ForbiddenException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { FilePermissionService } from '../services/file-permission.service';

/**
 * File Access Control Middleware
 *
 * Validates file access permissions before allowing the request to proceed.
 * Checks:
 * - File ownership
 * - Explicit permission grants
 * - Share token validity
 * - Permission expiration
 */
@Injectable()
export class FileAccessMiddleware implements NestMiddleware {
  constructor(
    private readonly filePermissionService: FilePermissionService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    // Extract file ID from route
    const fileId = req.params.id;
    
    // Skip middleware for share link access
    if (req.path.includes('/access/')) {
      return next();
    }

    if (!fileId) {
      return next();
    }

    try {
      // Get user from JWT token (set by auth guard)
      const userId = (req.user as any)?.id;

      if (!userId) {
        throw new ForbiddenException('Authentication required');
      }

      // Check if user has access to file
      const hasAccess = await this.filePermissionService.canAccessFile(fileId, userId);

      if (!hasAccess) {
        throw new ForbiddenException('Access to file denied');
      }

      // Attach file access info to request for later use
      (req as any).fileAccess = {
        fileId,
        userId,
        timestamp: new Date(),
      };

      next();
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      // On any other error, allow the request to proceed
      // (the controller can handle not found, etc.)
      next();
    }
  }
}
