import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PermissionsService } from './permissions.service';
import { PermissionEntity } from '../entities/permission.entity';
import { Permission } from '../constants/permissions.enum';

describe('PermissionsService', () => {
  let service: PermissionsService;
  let permissionRepository: Repository<PermissionEntity>;

  const mockPermissionRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionsService,
        {
          provide: getRepositoryToken(PermissionEntity),
          useValue: mockPermissionRepository,
        },
      ],
    }).compile();

    service = module.get<PermissionsService>(PermissionsService);
    permissionRepository = module.get<Repository<PermissionEntity>>(
      getRepositoryToken(PermissionEntity),
    );

    jest.clearAllMocks();
  });

  describe('getAllPermissions', () => {
    it('should return all permissions', async () => {
      const mockPermissions: PermissionEntity[] = [
        {
          id: '1',
          name: Permission.READ_OWN_PETS,
          description: 'Read own pets',
          resource: 'pets',
          action: 'READ',
          createdAt: new Date(),
          updatedAt: new Date(),
        } as PermissionEntity,
      ];

      mockPermissionRepository.find.mockResolvedValue(mockPermissions);

      const result = await service.getAllPermissions();

      expect(permissionRepository.find).toHaveBeenCalled();
      expect(result).toEqual(mockPermissions);
    });
  });

  describe('validatePermission', () => {
    it('should return true if permission exists', async () => {
      const mockPermission: PermissionEntity = {
        id: '1',
        name: Permission.READ_OWN_PETS,
        description: 'Read own pets',
        resource: 'pets',
        action: 'READ',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as PermissionEntity;

      mockPermissionRepository.findOne.mockResolvedValue(mockPermission);

      const result = await service.validatePermission(Permission.READ_OWN_PETS);

      expect(permissionRepository.findOne).toHaveBeenCalledWith({
        where: { name: Permission.READ_OWN_PETS },
      });
      expect(result).toBe(true);
    });

    it('should return false if permission does not exist', async () => {
      mockPermissionRepository.findOne.mockResolvedValue(null);

      const result = await service.validatePermission(Permission.READ_OWN_PETS);

      expect(result).toBe(false);
    });
  });

  describe('getPermissionByName', () => {
    it('should return permission by name', async () => {
      const mockPermission: PermissionEntity = {
        id: '1',
        name: Permission.READ_OWN_PETS,
        description: 'Read own pets',
        resource: 'pets',
        action: 'READ',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as PermissionEntity;

      mockPermissionRepository.findOne.mockResolvedValue(mockPermission);

      const result = await service.getPermissionByName(Permission.READ_OWN_PETS);

      expect(permissionRepository.findOne).toHaveBeenCalledWith({
        where: { name: Permission.READ_OWN_PETS },
      });
      expect(result).toEqual(mockPermission);
    });

    it('should return null if permission not found', async () => {
      mockPermissionRepository.findOne.mockResolvedValue(null);

      const result = await service.getPermissionByName(Permission.READ_OWN_PETS);

      expect(result).toBeNull();
    });
  });

  describe('checkPermissionAccess', () => {
    it('should return true if user has ALL_PERMISSIONS', () => {
      const userPermissions = [Permission.ALL_PERMISSIONS];
      const requiredPermission = Permission.READ_OWN_PETS;

      const result = service.checkPermissionAccess(
        userPermissions,
        requiredPermission,
      );

      expect(result).toBe(true);
    });

    it('should return true if user has the specific required permission', () => {
      const userPermissions = [
        Permission.READ_OWN_PETS,
        Permission.UPDATE_OWN_PETS,
      ];
      const requiredPermission = Permission.READ_OWN_PETS;

      const result = service.checkPermissionAccess(
        userPermissions,
        requiredPermission,
      );

      expect(result).toBe(true);
    });

    it('should return false if user does not have the required permission', () => {
      const userPermissions = [Permission.READ_OWN_PETS];
      const requiredPermission = Permission.CREATE_PETS;

      const result = service.checkPermissionAccess(
        userPermissions,
        requiredPermission,
      );

      expect(result).toBe(false);
    });
  });

  describe('seedPermissions', () => {
    it('should create permissions that do not exist', async () => {
      mockPermissionRepository.findOne.mockResolvedValue(null);
      mockPermissionRepository.create.mockImplementation((data) => data);
      mockPermissionRepository.save.mockResolvedValue({});

      await service.seedPermissions();

      expect(mockPermissionRepository.save).toHaveBeenCalled();
    });

    it('should skip permissions that already exist', async () => {
      const existingPermission: PermissionEntity = {
        id: '1',
        name: Permission.READ_OWN_PETS,
        description: 'Read own pets',
        resource: 'pets',
        action: 'READ',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as PermissionEntity;

      mockPermissionRepository.findOne.mockResolvedValue(existingPermission);

      await service.seedPermissions();

      expect(mockPermissionRepository.create).not.toHaveBeenCalled();
    });
  });
});
