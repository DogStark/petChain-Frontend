import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from '../entities/role.entity';
import { PermissionEntity } from '../entities/permission.entity';
import { RolePermission } from '../entities/role-permission.entity';
import { RoleName } from '../constants/roles.enum';
import { Permission } from '../constants/permissions.enum';
import { PERMISSION_DEFINITIONS } from '../constants/permission-definitions';

@Injectable()
export class RolesPermissionsSeeder implements OnModuleInit {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(PermissionEntity)
    private readonly permissionRepository: Repository<PermissionEntity>,
    @InjectRepository(RolePermission)
    private readonly rolePermissionRepository: Repository<RolePermission>,
  ) {}

  async onModuleInit() {
    // Only seed if in development or if explicitly enabled
    if (process.env.SEED_ROLES_PERMISSIONS === 'true' || process.env.NODE_ENV === 'development') {
      await this.seed();
    }
  }

  async seed(): Promise<void> {
    console.log('Seeding roles and permissions...');

    // Seed permissions first
    await this.seedPermissions();

    // Seed roles
    await this.seedRoles();

    // Assign permissions to roles
    await this.assignPermissionsToRoles();

    console.log('Roles and permissions seeded successfully!');
  }

  private async seedPermissions(): Promise<void> {
    for (const definition of PERMISSION_DEFINITIONS) {
      const existing = await this.permissionRepository.findOne({
        where: { name: definition.name },
      });

      if (!existing) {
        const permission = this.permissionRepository.create({
          name: definition.name,
          description: definition.description,
          resource: definition.resource,
          action: definition.action,
        });
        await this.permissionRepository.save(permission);
        console.log(`Created permission: ${definition.name}`);
      } else {
        console.log(`Permission already exists: ${definition.name}`);
      }
    }
  }

  private async seedRoles(): Promise<void> {
    // Create PetOwner role (base level, no parent)
    const petOwnerRole = await this.createOrUpdateRole({
      name: RoleName.PetOwner,
      description: 'Pet owner with access to own pets',
      parentRoleId: null,
      isSystemRole: true,
    });

    // Create Veterinarian role (parent: PetOwner - inherits PetOwner permissions)
    const veterinarianRole = await this.createOrUpdateRole({
      name: RoleName.Veterinarian,
      description: 'Veterinarian with access to all pets and medical records',
      parentRoleId: petOwnerRole.id,
      isSystemRole: true,
    });

    // Create Admin role (parent: Veterinarian - inherits Veterinarian + PetOwner permissions)
    await this.createOrUpdateRole({
      name: RoleName.Admin,
      description: 'Administrator with all permissions',
      parentRoleId: veterinarianRole.id,
      isSystemRole: true,
    });
  }

  private async createOrUpdateRole(data: {
    name: RoleName;
    description: string;
    parentRoleId: string | null;
    isSystemRole: boolean;
  }): Promise<Role> {
    let role = await this.roleRepository.findOne({
      where: { name: data.name },
    });

    if (!role) {
      role = this.roleRepository.create(data);
      await this.roleRepository.save(role);
      console.log(`Created role: ${data.name}`);
    } else {
      // Update existing role
      role.description = data.description;
      role.parentRoleId = data.parentRoleId;
      role.isSystemRole = data.isSystemRole;
      await this.roleRepository.save(role);
      console.log(`Updated role: ${data.name}`);
    }

    return role;
  }

  private async assignPermissionsToRoles(): Promise<void> {
    // Get all roles
    const adminRole = await this.roleRepository.findOne({
      where: { name: RoleName.Admin },
    });
    const veterinarianRole = await this.roleRepository.findOne({
      where: { name: RoleName.Veterinarian },
    });
    const petOwnerRole = await this.roleRepository.findOne({
      where: { name: RoleName.PetOwner },
    });

    if (!adminRole || !veterinarianRole || !petOwnerRole) {
      throw new Error('Roles not found. Please seed roles first.');
    }

    // Assign ALL_PERMISSIONS to Admin
    await this.assignPermissionToRole(adminRole.id, Permission.ALL_PERMISSIONS);

    // Assign Veterinarian permissions
    await this.assignPermissionToRole(
      veterinarianRole.id,
      Permission.READ_ALL_PETS,
    );
    await this.assignPermissionToRole(
      veterinarianRole.id,
      Permission.UPDATE_MEDICAL_RECORDS,
    );
    await this.assignPermissionToRole(
      veterinarianRole.id,
      Permission.CREATE_TREATMENTS,
    );

    // Assign PetOwner permissions
    await this.assignPermissionToRole(
      petOwnerRole.id,
      Permission.READ_OWN_PETS,
    );
    await this.assignPermissionToRole(
      petOwnerRole.id,
      Permission.UPDATE_OWN_PETS,
    );
    await this.assignPermissionToRole(petOwnerRole.id, Permission.CREATE_PETS);
  }

  private async assignPermissionToRole(
    roleId: string,
    permissionName: Permission,
  ): Promise<void> {
    const permission = await this.permissionRepository.findOne({
      where: { name: permissionName },
    });

    if (!permission) {
      throw new Error(`Permission ${permissionName} not found`);
    }

    // Check if already assigned
    const existing = await this.rolePermissionRepository.findOne({
      where: { roleId, permissionId: permission.id },
    });

    if (!existing) {
      const rolePermission = this.rolePermissionRepository.create({
        roleId,
        permissionId: permission.id,
      });
      await this.rolePermissionRepository.save(rolePermission);
      console.log(
        `Assigned permission ${permissionName} to role ${roleId}`,
      );
    }
  }
}
