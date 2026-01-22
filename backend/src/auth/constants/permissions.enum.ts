export enum Permission {
  // PetOwner permissions
  READ_OWN_PETS = 'READ_OWN_PETS',
  UPDATE_OWN_PETS = 'UPDATE_OWN_PETS',
  CREATE_PETS = 'CREATE_PETS',

  // Veterinarian permissions
  READ_ALL_PETS = 'READ_ALL_PETS',
  UPDATE_MEDICAL_RECORDS = 'UPDATE_MEDICAL_RECORDS',
  CREATE_TREATMENTS = 'CREATE_TREATMENTS',

  // Admin permission (grants all permissions)
  ALL_PERMISSIONS = 'ALL_PERMISSIONS',
}
