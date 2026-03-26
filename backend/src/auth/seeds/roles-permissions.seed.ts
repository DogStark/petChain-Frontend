import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from '../entities/role.entity';
import { PermissionEntity } from '../entities/permission.entity';
import { RolePermission } from '../entities/role-permission.entity';
import { RoleName } from '../constants/roles.enum';
import { Permission } from '../constants/permissions.enum';
import { PermissionsService } from '../services/permissions.service';

@Injectable()
export class RolesPermissionsSeeder implements OnModuleInit {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,

    @InjectRepository(RolePermission)
    private readonly rolePermissionRepository: Repository<RolePermission>,

    @InjectRepository(PermissionEntity)
    private readonly permissionRepository: Repository<PermissionEntity>,

    private readonly permissionsService: PermissionsService,
  ) {}

  async onModuleInit() {
    await this.seed();
  }

  async seed() {
    // 1️⃣ Seed permissions first
    await this.permissionsService.seedPermissions();

    // 2️⃣ Create roles if not exist
    const petOwner = await this.createRoleIfNotExists(
      RoleName.PetOwner,
      'Pet owner with limited access',
    );

    const veterinarian = await this.createRoleIfNotExists(
      RoleName.Veterinarian,
      'Licensed veterinarian',
    );

    const vetStaff = await this.createRoleIfNotExists(
      RoleName.VetStaff,
      'Veterinary support staff',
    );

    const admin = await this.createRoleIfNotExists(
      RoleName.Admin,
      'System administrator',
      true,
    );

    // 3️⃣ Attach permissions to roles
    await this.attachPermissions(petOwner, [
      Permission.READ_OWN_PETS,
      Permission.UPDATE_OWN_PETS,
      Permission.CREATE_PETS,
      Permission.SHARE_RECORDS,
    ]);

    await this.attachPermissions(veterinarian, [
      Permission.READ_ALL_PETS,
      Permission.UPDATE_MEDICAL_RECORDS,
      Permission.CREATE_TREATMENTS,
      Permission.PRESCRIBE,
    ]);

    await this.attachPermissions(vetStaff, [
      Permission.READ_ASSIGNED_PETS,
      Permission.UPDATE_APPOINTMENTS,
      Permission.CREATE_NOTES,
    ]);

    // Admin only gets ALL_PERMISSIONS
    await this.attachPermissions(admin, [Permission.ALL_PERMISSIONS]);
  }

  private async createRoleIfNotExists(
    name: RoleName,
    description: string,
    isSystemRole = true,
  ): Promise<Role> {
    let role = await this.roleRepository.findOne({ where: { name } });

    if (!role) {
      role = this.roleRepository.create({
        name,
        description,
        isSystemRole,
      });

      role = await this.roleRepository.save(role);
    }

    return role;
  }

  private async attachPermissions(
    role: Role,
    permissions: Permission[],
  ): Promise<void> {
    for (const permissionName of permissions) {
      const permission = await this.permissionRepository.findOne({
        where: { name: permissionName },
      });

      if (!permission) continue;

      const existing = await this.rolePermissionRepository.findOne({
        where: {
          roleId: role.id,
          permissionId: permission.id,
        },
      });

      if (!existing) {
        const rolePermission = this.rolePermissionRepository.create({
          roleId: role.id,
          permissionId: permission.id,
        });

        await this.rolePermissionRepository.save(rolePermission);
      }
    }
  }
}