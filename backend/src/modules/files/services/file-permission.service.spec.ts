import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { FilePermissionService } from './file-permission.service';
import {
  FilePermission,
  PermissionType,
  AccessLevel,
} from '../entities/file-permission.entity';
import { FileMetadata } from '../../upload/entities/file-metadata.entity';
import { User } from '../../users/entities/user.entity';

describe('FilePermissionService', () => {
  let service: FilePermissionService;
  let permissionRepository: Repository<FilePermission>;
  let fileMetadataRepository: Repository<FileMetadata>;
  let userRepository: Repository<User>;

  const mockFileMetadata = {
    id: 'file-1',
    ownerId: 'user-1',
    originalFilename: 'test.jpg',
    mimeType: 'image/jpeg',
    storageKey: 's3://bucket/test.jpg',
    sizeBytes: 1024,
  };

  const mockUser = {
    id: 'user-2',
    email: 'user@example.com',
  };

  const mockPermission = {
    id: 'perm-1',
    fileId: 'file-1',
    userId: 'user-2',
    permissionType: PermissionType.VIEWER,
    accessLevel: AccessLevel.PRIVATE,
    sharedBy: 'user-1',
    isActive: true,
    expiresAt: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FilePermissionService,
        {
          provide: getRepositoryToken(FilePermission),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            findAndCount: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(FileMetadata),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<FilePermissionService>(FilePermissionService);
    permissionRepository = module.get<Repository<FilePermission>>(
      getRepositoryToken(FilePermission),
    );
    fileMetadataRepository = module.get<Repository<FileMetadata>>(
      getRepositoryToken(FileMetadata),
    );
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
  });

  describe('canAccessFile', () => {
    it('should return true if user is the owner', async () => {
      jest
        .spyOn(fileMetadataRepository, 'findOne')
        .mockResolvedValue(mockFileMetadata as any);

      const result = await service.canAccessFile('file-1', 'user-1');

      expect(result).toBe(true);
    });

    it('should return true if user has explicit permission', async () => {
      jest
        .spyOn(fileMetadataRepository, 'findOne')
        .mockResolvedValue(mockFileMetadata as any);
      jest
        .spyOn(permissionRepository, 'findOne')
        .mockResolvedValue(mockPermission as any);

      const result = await service.canAccessFile('file-1', 'user-2');

      expect(result).toBe(true);
    });

    it('should return false if user has no access', async () => {
      jest
        .spyOn(fileMetadataRepository, 'findOne')
        .mockResolvedValue(mockFileMetadata as any);
      jest.spyOn(permissionRepository, 'findOne').mockResolvedValue(null);

      const result = await service.canAccessFile('file-1', 'user-3');

      expect(result).toBe(false);
    });

    it('should return false if permission is expired', async () => {
      jest
        .spyOn(fileMetadataRepository, 'findOne')
        .mockResolvedValue(mockFileMetadata as any);
      const expiredPermission = {
        ...mockPermission,
        expiresAt: new Date(Date.now() - 1000), // 1 second ago
      };
      jest
        .spyOn(permissionRepository, 'findOne')
        .mockResolvedValue(expiredPermission as any);

      const result = await service.canAccessFile('file-1', 'user-2');

      expect(result).toBe(false);
    });
  });

  describe('shareFile', () => {
    it('should throw if user is not the owner', async () => {
      jest
        .spyOn(fileMetadataRepository, 'findOne')
        .mockResolvedValue(mockFileMetadata as any);

      await expect(
        service.shareFile('file-1', 'user-2', {
          userId: 'user-3',
          permissionType: PermissionType.VIEWER,
          accessLevel: AccessLevel.PRIVATE,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw if recipient user does not exist', async () => {
      jest
        .spyOn(fileMetadataRepository, 'findOne')
        .mockResolvedValue(mockFileMetadata as any);
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(null);

      await expect(
        service.shareFile('file-1', 'user-1', {
          userId: 'nonexistent-user',
          permissionType: PermissionType.VIEWER,
          accessLevel: AccessLevel.PRIVATE,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should create new permission if not exists', async () => {
      jest
        .spyOn(fileMetadataRepository, 'findOne')
        .mockResolvedValue(mockFileMetadata as any);
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(mockUser as any);
      jest.spyOn(permissionRepository, 'findOne').mockResolvedValue(null);
      jest
        .spyOn(permissionRepository, 'create')
        .mockReturnValue(mockPermission as any);
      jest
        .spyOn(permissionRepository, 'save')
        .mockResolvedValue(mockPermission as any);

      await service.shareFile('file-1', 'user-1', {
        userId: 'user-2',
        permissionType: PermissionType.VIEWER,
        accessLevel: AccessLevel.PRIVATE,
      });

      expect(permissionRepository.create).toHaveBeenCalled();
      expect(permissionRepository.save).toHaveBeenCalled();
    });
  });

  describe('generateShareLink', () => {
    it('should generate share token and URL', async () => {
      jest
        .spyOn(fileMetadataRepository, 'findOne')
        .mockResolvedValue(mockFileMetadata as any);
      jest.spyOn(permissionRepository, 'create').mockReturnValue({
        ...mockPermission,
        createdAt: new Date(),
      } as any);
      jest.spyOn(permissionRepository, 'save').mockResolvedValue({
        ...mockPermission,
        createdAt: new Date(),
      } as any);

      const result = await service.generateShareLink('file-1', 'user-1', {
        permissionType: PermissionType.VIEWER,
      });

      expect(result.shareToken).toBeDefined();
      expect(result.shareUrl).toBeDefined();
      expect(result.fileId).toBe('file-1');
      expect(result.permissionType).toBe(PermissionType.VIEWER);
    });
  });

  describe('revokePermission', () => {
    it('should throw if user is not the owner', async () => {
      jest
        .spyOn(fileMetadataRepository, 'findOne')
        .mockResolvedValue(mockFileMetadata as any);

      await expect(
        service.revokePermission('file-1', 'perm-1', 'user-2'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should revoke permission by setting isActive to false', async () => {
      jest
        .spyOn(fileMetadataRepository, 'findOne')
        .mockResolvedValue(mockFileMetadata as any);
      jest
        .spyOn(permissionRepository, 'findOne')
        .mockResolvedValue(mockPermission as any);
      jest
        .spyOn(permissionRepository, 'save')
        .mockResolvedValue({ ...mockPermission, isActive: false } as any);

      await service.revokePermission('file-1', 'perm-1', 'user-1');

      expect(permissionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false }),
      );
    });
  });

  describe('cleanupExpiredPermissions', () => {
    it('should mark expired permissions as inactive', async () => {
      jest
        .spyOn(permissionRepository, 'update')
        .mockResolvedValue({ affected: 5 } as any);

      const count = await service.cleanupExpiredPermissions();

      expect(count).toBe(5);
      expect(permissionRepository.update).toHaveBeenCalled();
    });
  });
});
