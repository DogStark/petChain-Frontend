import { Permission } from './permissions.enum';
import { Resource, Action } from './permission-types.enum';

export interface PermissionDefinition {
  name: Permission;
  description: string;
  resource: Resource | '*';
  action: Action | '*';
}

export const PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  // PetOwner
  {
    name: Permission.READ_OWN_PETS,
    description: 'Read own pets',
    resource: Resource.PETS,
    action: Action.READ,
  },
  {
    name: Permission.UPDATE_OWN_PETS,
    description: 'Update own pets',
    resource: Resource.PETS,
    action: Action.UPDATE,
  },
  {
    name: Permission.CREATE_PETS,
    description: 'Create pets',
    resource: Resource.PETS,
    action: Action.CREATE,
  },
  {
    name: Permission.SHARE_RECORDS,
    description: 'Share pet medical records',
    resource: Resource.MEDICAL_RECORDS,
    action: Action.SHARE,
  },

  // Veterinarian
  {
    name: Permission.READ_ALL_PETS,
    description: 'Read all pets',
    resource: Resource.PETS,
    action: Action.READ,
  },
  {
    name: Permission.UPDATE_MEDICAL_RECORDS,
    description: 'Update medical records',
    resource: Resource.MEDICAL_RECORDS,
    action: Action.UPDATE,
  },
  {
    name: Permission.CREATE_TREATMENTS,
    description: 'Create treatments',
    resource: Resource.TREATMENTS,
    action: Action.CREATE,
  },
  {
    name: Permission.PRESCRIBE,
    description: 'Prescribe medication',
    resource: Resource.TREATMENTS,
    action: Action.PRESCRIBE,
  },

  // VetStaff
  {
    name: Permission.READ_ASSIGNED_PETS,
    description: 'Read assigned pets',
    resource: Resource.PETS,
    action: Action.READ,
  },
  {
    name: Permission.UPDATE_APPOINTMENTS,
    description: 'Update appointments',
    resource: Resource.APPOINTMENTS,
    action: Action.UPDATE,
  },
  {
    name: Permission.CREATE_NOTES,
    description: 'Create clinical notes',
    resource: Resource.NOTES,
    action: Action.CREATE,
  },

  // Admin
  {
    name: Permission.ALL_PERMISSIONS,
    description: 'Full system access',
    resource: '*',
    action: '*',
  },
];