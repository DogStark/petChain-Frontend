import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { RolesService } from './roles.service';
import { Role } from '../entities/role.entity';
import { UserRole } from '../entities/user-role.entity';
import { RolePermission } from '../entities/role-permission.entity';
import { RoleAuditLog } from '../entities/role-audit-log.entity';
import { RoleName } from '../constants/roles.enum';
import { Permission } from '../constants/permissions.enum';
import { AssignRoleDto, RemoveRoleDto } from '../dto/role.dto';

describe('RolesService', () => {
  let service: RolesService;
  let roleRepository: Repository<Role>;
  let userRoleRepository: Repository<UserRole>;
  let auditLogRepository: Repository<RoleAuditLog>;

  const mockRoleRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockUserRoleRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockRolePermissionRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockAuditLogRepository = {
    create: jest.fn(),
    save: jest.fn(),
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
          provide: getRepositoryToken(UserRole),
          useValue: mockUserRoleRepository,
        },
        {
          provide: getRepositoryToken(RolePermission),
          useValue: mockRolePermissionRepository,
        },
        {
          provide: getRepositoryToken(RoleAuditLog),
          useValue: mockAuditLogRepository,
        },
      ],
    }).compile();

    service = module.get<RolesService>(RolesService);
    roleRepository = module.get<Repository<Role>>(getRepositoryToken(Role));
    userRoleRepository = module.get<Repository<UserRole>>(
      getRepositoryToken(UserRole),
    );
    auditLogRepository = module.get<Repository<RoleAuditLog>>(
      getRepositoryToken(RoleAuditLog),
    );

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

      const dto: AssignRoleDto = { userId, roleId, reason: 'Test assignment' };
      const result = await service.assignRole(dto, assignedBy);

      expect(roleRepository.findOne).toHaveBeenCalledWith({
        where: { id: roleId },
      });
      expect(userRoleRepository.findOne).toHaveBeenCalledWith({
        where: { userId, roleId },
      });
      expect(userRoleRepository.create).toHaveBeenCalled();
      expect(userRoleRepository.save).toHaveBeenCalled();
      expect(auditLogRepository.save).toHaveBeenCalled();
      expect(result).toEqual({ message: 'Role assigned successfully' });
    });

    it('should throw NotFoundException if role does not exist', async () => {
      mockRoleRepository.findOne.mockResolvedValue(null);
      const dto: AssignRoleDto = { userId, roleId, reason: 'Test' };

      await expect(service.assignRole(dto, assignedBy)).rejects.toThrow(
        NotFoundException,
      );
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
      const dto: AssignRoleDto = { userId, roleId, reason: 'Test' };

      await expect(service.assignRole(dto, assignedBy)).rejects.toThrow(
        BadRequestException,
      );
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

      const dto: RemoveRoleDto = { userId, roleId, reason: 'cleanup' };
      await service.removeRole(dto, removedBy);

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
        service.removeRole({ userId, roleId }, removedBy),
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
        relations: ['role'],
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
      mockRoleRepository.findOne.mockResolvedValue(adminRole);

      const result = await service.getUserPermissions(userId);

      expect(result).toContain(Permission.ALL_PERMISSIONS);
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
      mockRoleRepository.findOne.mockResolvedValue(petOwnerRole);

      const result = await service.getUserPermissions(userId);

      expect(result).toContain(Permission.READ_OWN_PETS);
    });
  });
});
