import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from '../../modules/users/entities/user.entity';

/**
 * Current User Decorator
 *
 * Extracts the authenticated user from the request.
 * Optionally, pass a property name to extract a specific field.
 *
 * @example
 * // Get entire user object
 * @CurrentUser() user: User
 *
 * // Get specific property
 * @CurrentUser('id') userId: string
 */
export const CurrentUser = createParamDecorator(
  (data: keyof User | undefined, ctx: ExecutionContext): User | unknown => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as User;

    if (data) {
      return user?.[data];
    }

    return user;
  },
);
