import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Decorator to specify required permissions for a route
 * Allows fine-grained permission checks independent of roles
 * @param permissions - Array of permission names (e.g., 'READ_OWN_PETS', 'CREATE_PETS')
 */
export const Permissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
