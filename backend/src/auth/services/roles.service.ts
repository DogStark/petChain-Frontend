import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Role } from '../entities/role.entity';
import { PermissionEntity } from '../entities/permission.entity';
import { UserRole } from '../entities/user-role.entity';
import { RoleAuditLog, RoleAuditAction } from '../entities/role-audit-log.entity';
import { RoleName } from '../constants/roles.enum';
import { Permission } from '../constants/permissions.enum';
import { PermissionsService } from './permissions.service';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(PermissionEntity)
    private readonly permissionRepository: Repository<PermissionEntity>,
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
    @InjectRepository(RoleAuditLog)
    private readonly auditLogRepository: Repository<RoleAuditLog>,
    private readonly permissionsService: PermissionsService,
  ) {}

  /**
   * Assign a role to a user with audit logging
   */
  async assignRole(
    userId: string,
    roleId: string,
    assignedBy: string,
    reason?: string,
  ): Promise<UserRole> {
    // Check if role exists
    const role = await this.roleRepository.findOne({ where: { id: roleId } });
    if (!role) {
      throw new NotFoundException(`Role with ID ${roleId} not found`);
    }

    // Check if user already has this role (active)
    const existingUserRole = await this.userRoleRepository.findOne({
      where: { userId, roleId, isActive: true },
    });

    if (existingUserRole) {
      throw new BadRequestException('User already has this role');
    }

    // Create user role assignment
    const userRole = this.userRoleRepository.create({
      userId,
      roleId,
      assignedBy,
      assignedAt: new Date(),
      isActive: true,
    });

    const savedUserRole = await this.userRoleRepository.save(userRole);

    // Create audit log entry
    await this.createAuditLog(
      userId,
      roleId,
      RoleAuditAction.ASSIGNED,
      assignedBy,
      reason,
    );

    return savedUserRole;
  }

  /**
   * Remove a role from a user with audit logging
   */
  async removeRole(
    userId: string,
    roleId: string,
    removedBy: string,
    reason?: string,
  ): Promise<void> {
    // Find active user role
    const userRole = await this.userRoleRepository.findOne({
      where: { userId, roleId, isActive: true },
    });

    if (!userRole) {
      throw new NotFoundException('User does not have this role');
    }

    // Soft delete by setting isActive to false
    userRole.isActive = false;
    await this.userRoleRepository.save(userRole);

    // Create audit log entry
    await this.createAuditLog(
      userId,
      roleId,
      RoleAuditAction.REMOVED,
      removedBy,
      reason,
    );
  }

  /**
   * Get all active roles for a user
   */
  async getUserRoles(userId: string): Promise<Role[]> {
    const userRoles = await this.userRoleRepository.find({
      where: { userId, isActive: true },
      relations: ['role', 'role.parentRole', 'role.rolePermissions', 'role.rolePermissions.permission'],
    });

    return userRoles.map((ur) => ur.role);
  }

  /**
   * Get all permissions for a user (aggregated from roles and hierarchy)
   */
  async getUserPermissions(userId: string): Promise<Permission[]> {
    const userRoles = await this.getUserRoles(userId);
    const allRoleIds = new Set<string>();

    // Collect all role IDs including parent roles from hierarchy
    for (const role of userRoles) {
      allRoleIds.add(role.id);
      const parentRoles = await this.getRoleHierarchy(role.id);
      parentRoles.forEach((parent) => allRoleIds.add(parent.id));
    }

    // Get all permissions from all roles
    const roles = await this.roleRepository.find({
      where: { id: In(Array.from(allRoleIds)) },
      relations: ['rolePermissions', 'rolePermissions.permission'],
    });

    const permissions = new Set<Permission>();

    for (const role of roles) {
      // Check if role has ALL_PERMISSIONS
      const allPermissions = role.rolePermissions?.find(
        (rp) => rp.permission.name === Permission.ALL_PERMISSIONS,
      );

      if (allPermissions) {
        // Early return - user has all permissions
        return [Permission.ALL_PERMISSIONS];
      }

      // Collect all permissions from this role
      role.rolePermissions?.forEach((rp) => {
        if (rp.permission) {
          permissions.add(rp.permission.name);
        }
      });
    }

    return Array.from(permissions);
  }

  /**
   * Check if user has a specific role
   */
  async hasRole(userId: string, roleName: RoleName): Promise<boolean> {
    const userRoles = await this.getUserRoles(userId);
    return userRoles.some((role) => role.name === roleName);
  }

  /**
   * Check if user has a specific permission
   */
  async hasPermission(
    userId: string,
    permissionName: Permission,
  ): Promise<boolean> {
    const userPermissions = await this.getUserPermissions(userId);
    return this.permissionsService.checkPermissionAccess(
      userPermissions,
      permissionName,
    );
  }

  /**
   * Get all parent roles in the hierarchy for a given role
   */
  async getRoleHierarchy(roleId: string): Promise<Role[]> {
    const hierarchy: Role[] = [];
    let currentRole = await this.roleRepository.findOne({
      where: { id: roleId },
      relations: ['parentRole'],
    });

    while (currentRole?.parentRole) {
      const parent = await this.roleRepository.findOne({
        where: { id: currentRole.parentRoleId },
        relations: ['parentRole'],
      });
      if (parent) {
        hierarchy.push(parent);
        currentRole = parent;
      } else {
        break;
      }
    }

    return hierarchy;
  }

  /**
   * Aggregate permissions from multiple roles (including hierarchy)
   */
  async aggregatePermissions(roleIds: string[]): Promise<Permission[]> {
    const allRoleIds = new Set<string>(roleIds);

    // Add parent roles from hierarchy
    for (const roleId of roleIds) {
      const parents = await this.getRoleHierarchy(roleId);
      parents.forEach((parent) => allRoleIds.add(parent.id));
    }

    // Get all roles with their permissions
    const roles = await this.roleRepository.find({
      where: { id: In(Array.from(allRoleIds)) },
      relations: ['rolePermissions', 'rolePermissions.permission'],
    });

    const permissions = new Set<Permission>();

    for (const role of roles) {
      // Check for ALL_PERMISSIONS
      const allPermissions = role.rolePermissions?.find(
        (rp) => rp.permission.name === Permission.ALL_PERMISSIONS,
      );

      if (allPermissions) {
        return [Permission.ALL_PERMISSIONS];
      }

      // Collect permissions
      role.rolePermissions?.forEach((rp) => {
        if (rp.permission) {
          permissions.add(rp.permission.name);
        }
      });
    }

    return Array.from(permissions);
  }

  /**
   * Create audit log entry
   */
  private async createAuditLog(
    userId: string,
    roleId: string,
    action: RoleAuditAction,
    performedBy: string,
    reason?: string,
    metadata?: Record<string, any>,
  ): Promise<RoleAuditLog> {
    const auditLog = this.auditLogRepository.create({
      userId,
      roleId,
      action,
      performedBy,
      reason,
      metadata,
    });

    return await this.auditLogRepository.save(auditLog);
  }

  /**
   * Get role by name
   */
  async getRoleByName(name: RoleName): Promise<Role | null> {
    return await this.roleRepository.findOne({
      where: { name },
      relations: ['rolePermissions', 'rolePermissions.permission'],
    });
  }

  /**
   * Get all roles
   */
  async getAllRoles(): Promise<Role[]> {
    return await this.roleRepository.find({
      relations: ['parentRole', 'rolePermissions', 'rolePermissions.permission'],
    });
  }
}
