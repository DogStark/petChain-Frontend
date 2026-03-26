import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Optional JWT Guard - allows both authenticated and unauthenticated access
 * Used for endpoints that can be accessed publicly but benefit from
 * knowing the user if they are authenticated
 */
@Injectable()
export class OptionalJwtGuard extends AuthGuard('jwt') {
  /**
   * Returns true for all requests, even if JWT is invalid or missing
   */
  canActivate(context: ExecutionContext) {
    // Try to authenticate, but don't fail if no token
    return super.canActivate(context);
  }

  /**
   * Override to prevent exception on missing/invalid token
   */
  handleRequest(err: any, user: any) {
    // Return user if authenticated, null otherwise
    return user || null;
  }
}
