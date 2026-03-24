// auth/services/roles.service.ts

import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Role } from '../entities/role.entity';
import { UserRole } from '../entities/user-role.entity';
import { RolePermission } from '../entities/role-permission.entity';
import { RoleAuditLog, RoleAuditAction } from '../entities/role-audit-log.entity';
import { Permission } from '../constants/permissions.enum';
import { AssignRoleDto, RemoveRoleDto } from '../dto/role.dto';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,

    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,

    @InjectRepository(RolePermission)
    private readonly rolePermissionRepository: Repository<RolePermission>,

    @InjectRepository(RoleAuditLog)
    private readonly roleAuditRepository: Repository<RoleAuditLog>,
  ) {}

  /*
   |--------------------------------------------------------------------------
   | GET USER ROLES (ACTIVE ONLY)
   |--------------------------------------------------------------------------
   */
  async getUserRoles(userId: string): Promise<Role[]> {
    const userRoles = await this.userRoleRepository.find({
      where: { userId, isActive: true },
      relations: ['role'],
    });

    return userRoles.map((ur) => ur.role);
  }

  /*
   |--------------------------------------------------------------------------
   | GET USER PERMISSIONS (WITH HIERARCHY SUPPORT)
   |--------------------------------------------------------------------------
   */
  async getUserPermissions(userId: string): Promise<Permission[]> {
    const roles = await this.getUserRoles(userId);

    const visitedRoles = new Set<string>();
    const permissionSet = new Set<Permission>();

    for (const role of roles) {
      await this.collectRolePermissions(role.id, permissionSet, visitedRoles);
    }

    return Array.from(permissionSet);
  }

  private async collectRolePermissions(
    roleId: string,
    permissionSet: Set<Permission>,
    visitedRoles: Set<string>,
  ) {
    if (visitedRoles.has(roleId)) return;

    visitedRoles.add(roleId);

    const role = await this.roleRepository.findOne({
      where: { id: roleId },
      relations: [
        'rolePermissions',
        'rolePermissions.permission',
        'parentRole',
      ],
    });

    if (!role) return;

    for (const rp of role.rolePermissions) {
      permissionSet.add(rp.permission.name);
    }

    if (role.parentRole) {
      await this.collectRolePermissions(
        role.parentRole.id,
        permissionSet,
        visitedRoles,
      );
    }
  }

  /*
   |--------------------------------------------------------------------------
   | ASSIGN ROLE (ADMIN ONLY)
   |--------------------------------------------------------------------------
   */
  async assignRole(dto: AssignRoleDto, performedBy: string) {
    const { userId, roleId, reason } = dto;

    const role = await this.roleRepository.findOne({
      where: { id: roleId },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    const existing = await this.userRoleRepository.findOne({
      where: { userId, roleId },
    });

    if (existing && existing.isActive) {
      throw new BadRequestException('User already has this role');
    }

    if (existing) {
      existing.isActive = true;
      await this.userRoleRepository.save(existing);
    } else {
      const newUserRole = this.userRoleRepository.create({
        userId,
        roleId,
        assignedBy: performedBy,
        isActive: true,
      });

      await this.userRoleRepository.save(newUserRole);
    }

    // Audit log
    await this.roleAuditRepository.save({
      userId,
      roleId,
      action: RoleAuditAction.ASSIGNED,
      performedBy,
      reason,
    });

    return { message: 'Role assigned successfully' };
  }

  /*
   |--------------------------------------------------------------------------
   | REMOVE ROLE (SOFT REMOVE)
   |--------------------------------------------------------------------------
   */
  async removeRole(dto: RemoveRoleDto, performedBy: string) {
    const { userId, roleId, reason } = dto;

    if (userId === performedBy) {
      throw new BadRequestException('You cannot remove your own role');
    }

    const userRole = await this.userRoleRepository.findOne({
      where: { userId, roleId, isActive: true },
    });

    if (!userRole) {
      throw new NotFoundException('Active role not found for user');
    }

    userRole.isActive = false;
    await this.userRoleRepository.save(userRole);

    // Audit log
    await this.roleAuditRepository.save({
      userId,
      roleId,
      action: RoleAuditAction.REMOVED,
      performedBy,
      reason,
    });

    return { message: 'Role removed successfully' };
  }
}