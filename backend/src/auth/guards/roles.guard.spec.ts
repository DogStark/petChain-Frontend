import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { RolesGuard } from './roles.guard';
import { RolesService } from '../services/roles.service';
import { PermissionsService } from '../services/permissions.service';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { User } from '../../modules/users/entities/user.entity';
import { Role } from '../entities/role.entity';
import { RoleName } from '../constants/roles.enum';
import { Permission } from '../constants/permissions.enum';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let rolesService: RolesService;
  let permissionsService: PermissionsService;
  let reflector: Reflector;

  const mockRolesService = {
    getUserRoles: jest.fn(),
    getUserPermissions: jest.fn(),
  };

  const mockPermissionsService = {
    checkPermissionAccess: jest.fn(),
  };

  const mockReflector = {
    getAllAndOverride: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesGuard,
        {
          provide: RolesService,
          useValue: mockRolesService,
        },
        {
          provide: PermissionsService,
          useValue: mockPermissionsService,
        },
        {
          provide: Reflector,
          useValue: mockReflector,
        },
      ],
    }).compile();

    guard = module.get<RolesGuard>(RolesGuard);
    rolesService = module.get<RolesService>(RolesService);
    permissionsService = module.get<PermissionsService>(PermissionsService);
    reflector = module.get<Reflector>(Reflector);

    jest.clearAllMocks();
  });

  const createMockExecutionContext = (
    user: User | null,
    requiredRoles?: string[],
    requiredPermissions?: string[],
  ): ExecutionContext => {
    const request = {
      user,
    };

    mockReflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === ROLES_KEY) {
        return requiredRoles;
      }
      if (key === PERMISSIONS_KEY) {
        return requiredPermissions;
      }
      return undefined;
    });

    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as unknown as ExecutionContext;
  };

  describe('canActivate', () => {
    const mockUser: User = {
      id: 'user-1',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      isActive: true,
    } as User;

    it('should allow access if no roles or permissions are required', async () => {
      const context = createMockExecutionContext(mockUser);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(rolesService.getUserRoles).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException if user is not authenticated', async () => {
      const context = createMockExecutionContext(null, ['Admin']);

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
    });

    describe('Role-based access', () => {
      it('should allow access if user has required role', async () => {
        const mockRole: Role = {
          id: 'role-1',
          name: RoleName.Admin,
        } as Role;

        mockRolesService.getUserRoles.mockResolvedValue([mockRole]);

        const context = createMockExecutionContext(mockUser, ['Admin']);

        const result = await guard.canActivate(context);

        expect(result).toBe(true);
        expect(rolesService.getUserRoles).toHaveBeenCalledWith(mockUser.id);
      });

      it('should allow access if user has one of the required roles', async () => {
        const mockRole: Role = {
          id: 'role-1',
          name: RoleName.Veterinarian,
        } as Role;

        mockRolesService.getUserRoles.mockResolvedValue([mockRole]);

        const context = createMockExecutionContext(mockUser, [
          'Veterinarian',
          'Admin',
        ]);

        const result = await guard.canActivate(context);

        expect(result).toBe(true);
      });

      it('should throw ForbiddenException if user does not have required role', async () => {
        const mockRole: Role = {
          id: 'role-1',
          name: RoleName.PetOwner,
        } as Role;

        mockRolesService.getUserRoles.mockResolvedValue([mockRole]);

        const context = createMockExecutionContext(mockUser, ['Admin']);

        await expect(guard.canActivate(context)).rejects.toThrow(
          ForbiddenException,
        );
      });
    });

    describe('Permission-based access', () => {
      it('should allow access if user has required permission', async () => {
        const userPermissions = [
          Permission.READ_OWN_PETS,
          Permission.CREATE_PETS,
        ];

        mockRolesService.getUserPermissions.mockResolvedValue(userPermissions);
        mockPermissionsService.checkPermissionAccess.mockReturnValue(true);

        const context = createMockExecutionContext(mockUser, undefined, [
          'READ_OWN_PETS',
        ]);

        const result = await guard.canActivate(context);

        expect(result).toBe(true);
        expect(rolesService.getUserPermissions).toHaveBeenCalledWith(
          mockUser.id,
        );
      });

      it('should allow access if user has ALL_PERMISSIONS', async () => {
        const userPermissions = [Permission.ALL_PERMISSIONS];

        mockRolesService.getUserPermissions.mockResolvedValue(userPermissions);
        mockPermissionsService.checkPermissionAccess.mockReturnValue(true);

        const context = createMockExecutionContext(mockUser, undefined, [
          'READ_OWN_PETS',
        ]);

        const result = await guard.canActivate(context);

        expect(result).toBe(true);
      });

      it('should throw ForbiddenException if user does not have required permission', async () => {
        const userPermissions = [Permission.READ_OWN_PETS];

        mockRolesService.getUserPermissions.mockResolvedValue(userPermissions);
        mockPermissionsService.checkPermissionAccess.mockReturnValue(false);

        const context = createMockExecutionContext(mockUser, undefined, [
          'CREATE_PETS',
        ]);

        await expect(guard.canActivate(context)).rejects.toThrow(
          ForbiddenException,
        );
      });

      it('should require all permissions if multiple are specified', async () => {
        const userPermissions = [Permission.READ_OWN_PETS];

        mockRolesService.getUserPermissions.mockResolvedValue(userPermissions);
        mockPermissionsService.checkPermissionAccess
          .mockReturnValueOnce(true) // READ_OWN_PETS
          .mockReturnValueOnce(false); // CREATE_PETS

        const context = createMockExecutionContext(mockUser, undefined, [
          'READ_OWN_PETS',
          'CREATE_PETS',
        ]);

        await expect(guard.canActivate(context)).rejects.toThrow(
          ForbiddenException,
        );
      });
    });

    describe('Combined role and permission checks', () => {
      it('should allow access if user has required role and permissions', async () => {
        const mockRole: Role = {
          id: 'role-1',
          name: RoleName.Admin,
        } as Role;

        const userPermissions = [Permission.READ_OWN_PETS];

        mockRolesService.getUserRoles.mockResolvedValue([mockRole]);
        mockRolesService.getUserPermissions.mockResolvedValue(userPermissions);
        mockPermissionsService.checkPermissionAccess.mockReturnValue(true);

        const context = createMockExecutionContext(
          mockUser,
          ['Admin'],
          ['READ_OWN_PETS'],
        );

        const result = await guard.canActivate(context);

        expect(result).toBe(true);
      });
    });
  });
});
