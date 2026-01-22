import { Permission } from './permissions.enum';

export interface PermissionDefinition {
  name: Permission;
  description: string;
  resource: string;
  action: string;
}

export const PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  {
    name: Permission.READ_OWN_PETS,
    description: 'Read own pets',
    resource: 'pets',
    action: 'READ',
  },
  {
    name: Permission.UPDATE_OWN_PETS,
    description: 'Update own pets',
    resource: 'pets',
    action: 'UPDATE',
  },
  {
    name: Permission.CREATE_PETS,
    description: 'Create pets',
    resource: 'pets',
    action: 'CREATE',
  },
  {
    name: Permission.READ_ALL_PETS,
    description: 'Read all pets',
    resource: 'pets',
    action: 'READ',
  },
  {
    name: Permission.UPDATE_MEDICAL_RECORDS,
    description: 'Update medical records',
    resource: 'medical_records',
    action: 'UPDATE',
  },
  {
    name: Permission.CREATE_TREATMENTS,
    description: 'Create treatments',
    resource: 'treatments',
    action: 'CREATE',
  },
  {
    name: Permission.ALL_PERMISSIONS,
    description: 'All permissions (admin only)',
    resource: '*',
    action: '*',
  },
];
