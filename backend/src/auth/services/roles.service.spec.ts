import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { RolesService } from './roles.service';
import { PermissionsService } from './permissions.service';
import { Role } from '../entities/role.entity';
import { PermissionEntity } from '../entities/permission.entity';
import { UserRole } from '../entities/user-role.entity';
import {
  RoleAuditLog,
  RoleAuditAction,
} from '../entities/role-audit-log.entity';
import { RoleName } from '../constants/roles.enum';
import { Permission } from '../constants/permissions.enum';

describe('RolesService', () => {
  let service: RolesService;
  let roleRepository: Repository<Role>;
  let permissionRepository: Repository<PermissionEntity>;
  let userRoleRepository: Repository<UserRole>;
  let auditLogRepository: Repository<RoleAuditLog>;
  let permissionsService: PermissionsService;

  const mockRoleRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockPermissionRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
  };

  const mockUserRoleRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockAuditLogRepository = {
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockPermissionsService = {
    checkPermissionAccess: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesService,
        {
          provide: getRepositoryToken(Role),
          useValue: mockRoleRepository,
        },
        {
          provide: getRepositoryToken(PermissionEntity),
          useValue: mockPermissionRepository,
        },
        {
          provide: getRepositoryToken(UserRole),
          useValue: mockUserRoleRepository,
        },
        {
          provide: getRepositoryToken(RoleAuditLog),
          useValue: mockAuditLogRepository,
        },
        {
          provide: PermissionsService,
          useValue: mockPermissionsService,
        },
      ],
    }).compile();

    service = module.get<RolesService>(RolesService);
    roleRepository = module.get<Repository<Role>>(getRepositoryToken(Role));
    permissionRepository = module.get<Repository<PermissionEntity>>(
      getRepositoryToken(PermissionEntity),
    );
    userRoleRepository = module.get<Repository<UserRole>>(
      getRepositoryToken(UserRole),
    );
    auditLogRepository = module.get<Repository<RoleAuditLog>>(
      getRepositoryToken(RoleAuditLog),
    );
    permissionsService = module.get<PermissionsService>(PermissionsService);

    jest.clearAllMocks();
  });

  describe('assignRole', () => {
    const userId = 'user-1';
    const roleId = 'role-1';
    const assignedBy = 'admin-1';

    it('should assign role to user and create audit log', async () => {
      const mockRole: Role = {
        id: roleId,
        name: RoleName.PetOwner,
        description: 'Pet owner',
        parentRoleId: null,
        isSystemRole: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Role;

      mockRoleRepository.findOne.mockResolvedValue(mockRole);
      mockUserRoleRepository.findOne.mockResolvedValue(null);
      mockUserRoleRepository.create.mockImplementation((data) => ({
        ...data,
        id: 'user-role-1',
      }));
      mockUserRoleRepository.save.mockResolvedValue({
        id: 'user-role-1',
        userId,
        roleId,
        assignedBy,
        isActive: true,
      });
      mockAuditLogRepository.create.mockImplementation((data) => data);
      mockAuditLogRepository.save.mockResolvedValue({});

      const result = await service.assignRole(userId, roleId, assignedBy);

      expect(roleRepository.findOne).toHaveBeenCalledWith({
        where: { id: roleId },
      });
      expect(userRoleRepository.findOne).toHaveBeenCalledWith({
        where: { userId, roleId, isActive: true },
      });
      expect(userRoleRepository.create).toHaveBeenCalled();
      expect(userRoleRepository.save).toHaveBeenCalled();
      expect(auditLogRepository.create).toHaveBeenCalled();
      expect(auditLogRepository.save).toHaveBeenCalled();
      expect(result.isActive).toBe(true);
    });

    it('should throw NotFoundException if role does not exist', async () => {
      mockRoleRepository.findOne.mockResolvedValue(null);

      await expect(
        service.assignRole(userId, roleId, assignedBy),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if user already has the role', async () => {
      const mockRole: Role = {
        id: roleId,
        name: RoleName.PetOwner,
      } as Role;

      const existingUserRole: UserRole = {
        id: 'existing-1',
        userId,
        roleId,
        isActive: true,
      } as UserRole;

      mockRoleRepository.findOne.mockResolvedValue(mockRole);
      mockUserRoleRepository.findOne.mockResolvedValue(existingUserRole);

      await expect(
        service.assignRole(userId, roleId, assignedBy),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('removeRole', () => {
    const userId = 'user-1';
    const roleId = 'role-1';
    const removedBy = 'admin-1';

    it('should remove role from user and create audit log', async () => {
      const existingUserRole: UserRole = {
        id: 'user-role-1',
        userId,
        roleId,
        isActive: true,
      } as UserRole;

      mockUserRoleRepository.findOne.mockResolvedValue(existingUserRole);
      mockUserRoleRepository.save.mockResolvedValue({
        ...existingUserRole,
        isActive: false,
      });
      mockAuditLogRepository.create.mockImplementation((data) => data);
      mockAuditLogRepository.save.mockResolvedValue({});

      await service.removeRole(userId, roleId, removedBy);

      expect(userRoleRepository.findOne).toHaveBeenCalledWith({
        where: { userId, roleId, isActive: true },
      });
      expect(userRoleRepository.save).toHaveBeenCalledWith({
        ...existingUserRole,
        isActive: false,
      });
      expect(auditLogRepository.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException if user does not have the role', async () => {
      mockUserRoleRepository.findOne.mockResolvedValue(null);

      await expect(
        service.removeRole(userId, roleId, removedBy),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getUserRoles', () => {
    it('should return all active roles for a user', async () => {
      const userId = 'user-1';
      const mockRole: Role = {
        id: 'role-1',
        name: RoleName.PetOwner,
        description: 'Pet owner',
        parentRoleId: null,
        isSystemRole: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Role;

      const mockUserRole: UserRole = {
        id: 'user-role-1',
        userId,
        roleId: 'role-1',
        role: mockRole,
        isActive: true,
      } as UserRole;

      mockUserRoleRepository.find.mockResolvedValue([mockUserRole]);

      const result = await service.getUserRoles(userId);

      expect(userRoleRepository.find).toHaveBeenCalledWith({
        where: { userId, isActive: true },
        relations: [
          'role',
          'role.parentRole',
          'role.rolePermissions',
          'role.rolePermissions.permission',
        ],
      });
      expect(result).toEqual([mockRole]);
    });
  });

  describe('getUserPermissions', () => {
    it('should return ALL_PERMISSIONS if user has admin role', async () => {
      const userId = 'user-1';
      const adminRole: Role = {
        id: 'admin-role',
        name: RoleName.Admin,
        rolePermissions: [
          {
            permission: {
              name: Permission.ALL_PERMISSIONS,
            },
          },
        ],
      } as Role;

      const mockUserRole: UserRole = {
        id: 'user-role-1',
        userId,
        roleId: 'admin-role',
        role: adminRole,
        isActive: true,
      } as UserRole;

      mockUserRoleRepository.find.mockResolvedValue([mockUserRole]);
      mockRoleRepository.find.mockResolvedValue([adminRole]);

      const result = await service.getUserPermissions(userId);

      expect(result).toEqual([Permission.ALL_PERMISSIONS]);
    });

    it('should aggregate permissions from user roles and hierarchy', async () => {
      const userId = 'user-1';
      const petOwnerRole: Role = {
        id: 'pet-owner-role',
        name: RoleName.PetOwner,
        parentRoleId: null,
        rolePermissions: [
          {
            permission: {
              name: Permission.READ_OWN_PETS,
            },
          },
        ],
      } as Role;

      const mockUserRole: UserRole = {
        id: 'user-role-1',
        userId,
        roleId: 'pet-owner-role',
        role: petOwnerRole,
        isActive: true,
      } as UserRole;

      mockUserRoleRepository.find.mockResolvedValue([mockUserRole]);
      mockRoleRepository.find.mockResolvedValue([petOwnerRole]);
      // Mock getRoleHierarchy to return empty array
      jest.spyOn(service, 'getRoleHierarchy').mockResolvedValue([]);

      const result = await service.getUserPermissions(userId);

      expect(result).toContain(Permission.READ_OWN_PETS);
    });
  });

  describe('hasRole', () => {
    it('should return true if user has the role', async () => {
      const userId = 'user-1';
      const mockRole: Role = {
        id: 'role-1',
        name: RoleName.PetOwner,
      } as Role;

      const mockUserRole: UserRole = {
        id: 'user-role-1',
        userId,
        roleId: 'role-1',
        role: mockRole,
        isActive: true,
      } as UserRole;

      mockUserRoleRepository.find.mockResolvedValue([mockUserRole]);

      const result = await service.hasRole(userId, RoleName.PetOwner);

      expect(result).toBe(true);
    });

    it('should return false if user does not have the role', async () => {
      const userId = 'user-1';
      mockUserRoleRepository.find.mockResolvedValue([]);

      const result = await service.hasRole(userId, RoleName.Admin);

      expect(result).toBe(false);
    });
  });

  describe('hasPermission', () => {
    it('should return true if user has the permission', async () => {
      const userId = 'user-1';
      const userPermissions = [Permission.READ_OWN_PETS];

      jest
        .spyOn(service, 'getUserPermissions')
        .mockResolvedValue(userPermissions);
      mockPermissionsService.checkPermissionAccess.mockReturnValue(true);

      const result = await service.hasPermission(
        userId,
        Permission.READ_OWN_PETS,
      );

      expect(result).toBe(true);
    });

    it('should return false if user does not have the permission', async () => {
      const userId = 'user-1';
      const userPermissions = [Permission.READ_OWN_PETS];

      jest
        .spyOn(service, 'getUserPermissions')
        .mockResolvedValue(userPermissions);
      mockPermissionsService.checkPermissionAccess.mockReturnValue(false);

      const result = await service.hasPermission(
        userId,
        Permission.CREATE_PETS,
      );

      expect(result).toBe(false);
    });
  });

  describe('getRoleHierarchy', () => {
    it('should return all parent roles in hierarchy', async () => {
      const roleId = 'pet-owner-role';
      const veterinarianRole: Role = {
        id: 'vet-role',
        name: RoleName.Veterinarian,
        parentRoleId: 'admin-role',
        parentRole: {
          id: 'admin-role',
          name: RoleName.Admin,
          parentRoleId: null,
        },
      } as Role;

      const petOwnerRole: Role = {
        id: roleId,
        name: RoleName.PetOwner,
        parentRoleId: 'vet-role',
        parentRole: veterinarianRole,
      } as Role;

      mockRoleRepository.findOne
        .mockResolvedValueOnce(petOwnerRole)
        .mockResolvedValueOnce(veterinarianRole)
        .mockResolvedValueOnce(null);

      const result = await service.getRoleHierarchy(roleId);

      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('aggregatePermissions', () => {
    it('should return ALL_PERMISSIONS if any role has it', async () => {
      const roleIds = ['role-1'];
      const role: Role = {
        id: 'role-1',
        rolePermissions: [
          {
            permission: {
              name: Permission.ALL_PERMISSIONS,
            },
          },
        ],
      } as Role;

      mockRoleRepository.find.mockResolvedValue([role]);
      jest.spyOn(service, 'getRoleHierarchy').mockResolvedValue([]);

      const result = await service.aggregatePermissions(roleIds);

      expect(result).toEqual([Permission.ALL_PERMISSIONS]);
    });

    it('should aggregate permissions from multiple roles', async () => {
      const roleIds = ['role-1', 'role-2'];
      const role1: Role = {
        id: 'role-1',
        rolePermissions: [
          {
            permission: {
              name: Permission.READ_OWN_PETS,
            },
          },
        ],
      } as Role;

      const role2: Role = {
        id: 'role-2',
        rolePermissions: [
          {
            permission: {
              name: Permission.CREATE_PETS,
            },
          },
        ],
      } as Role;

      mockRoleRepository.find.mockResolvedValue([role1, role2]);
      jest.spyOn(service, 'getRoleHierarchy').mockResolvedValue([]);

      const result = await service.aggregatePermissions(roleIds);

      expect(result).toContain(Permission.READ_OWN_PETS);
      expect(result).toContain(Permission.CREATE_PETS);
    });
  });
});
