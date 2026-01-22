import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PermissionEntity } from '../entities/permission.entity';
import { Permission } from '../constants/permissions.enum';
import { PERMISSION_DEFINITIONS } from '../constants/permission-definitions';

@Injectable()
export class PermissionsService {
  constructor(
    @InjectRepository(PermissionEntity)
    private readonly permissionRepository: Repository<PermissionEntity>,
  ) {}

  /**
   * Get all available permissions
   */
  async getAllPermissions(): Promise<PermissionEntity[]> {
    return await this.permissionRepository.find();
  }

  /**
   * Validate if a permission exists
   */
  async validatePermission(permissionName: string): Promise<boolean> {
    const permission = await this.permissionRepository.findOne({
      where: { name: permissionName as Permission },
    });
    return !!permission;
  }

  /**
   * Get permission by name
   */
  async getPermissionByName(name: Permission): Promise<PermissionEntity | null> {
    return await this.permissionRepository.findOne({
      where: { name },
    });
  }

  /**
   * Check if user has access based on required permission
   * Handles ALL_PERMISSIONS special case
   */
  checkPermissionAccess(
    userPermissions: Permission[],
    requiredPermission: string,
  ): boolean {
    // If user has ALL_PERMISSIONS, grant access
    if (userPermissions.includes(Permission.ALL_PERMISSIONS)) {
      return true;
    }

    // Check if user has the specific required permission
    return userPermissions.includes(requiredPermission as Permission);
  }

  /**
   * Seed all permissions from definitions
   */
  async seedPermissions(): Promise<void> {
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
      }
    }
  }
}
