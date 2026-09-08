import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { UploadService } from './upload.service';
import { FileMetadata } from './entities/file-metadata.entity';
import { FileVersion } from './entities/file-version.entity';
import { FileVariant } from './entities/file-variant.entity';
import { VariantType } from './entities/variant-type.enum';
import { FileStatus } from './entities/file-status.enum';
import { StorageService } from '../storage/storage.service';
import { ValidationService } from '../validation/validation.service';
import { VirusScannerService } from '../security/virus-scanner.service';
import { EncryptionService } from '../security/encryption.service';

describe('UploadService', () => {
  let service: UploadService;
  let mockStorageService: Partial<StorageService>;

  const mockFileMetadataRepo = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
  };

  const mockFileVersionRepo = {
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockFileVariantRepo = {
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key) => {
      if (key === 'storage') {
        return {
          maxFileSizeMb: 50,
          encryption: { enabled: false },
        };
      }
      return undefined;
    }),
  };

  const mockValidationService = {
    validateFile: jest.fn().mockResolvedValue({
      valid: true,
      errors: [],
      warnings: [],
    }),
  };

  const mockVirusScannerService = {
    scan: jest.fn().mockResolvedValue({ clean: true }),
  };

  const mockEncryptionService = {
    encrypt: jest.fn(),
  };

  beforeEach(async () => {
    mockStorageService = {
      generateKey: jest.fn((options) =>
        `uploads/${options.ownerId || 'default'}/files/${Date.now()}-${options.filename}`,
      ),
      upload: jest.fn().mockResolvedValue({}),
      getPublicUrl: jest.fn((key) => `https://cdn.example.com/${key}`),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UploadService,
        {
          provide: getRepositoryToken(FileMetadata),
          useValue: mockFileMetadataRepo,
        },
        {
          provide: getRepositoryToken(FileVersion),
          useValue: mockFileVersionRepo,
        },
        {
          provide: getRepositoryToken(FileVariant),
          useValue: mockFileVariantRepo,
        },
        {
          provide: StorageService,
          useValue: mockStorageService,
        },
        {
          provide: ValidationService,
          useValue: mockValidationService,
        },
        {
          provide: VirusScannerService,
          useValue: mockVirusScannerService,
        },
        {
          provide: EncryptionService,
          useValue: mockEncryptionService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<UploadService>(UploadService);
    jest.clearAllMocks();
  });

  describe('getFileById - thumbnailUrl population', () => {
    it('should return thumbnailUrl from thumbnail variant CDN URL', async () => {
      const thumbnailVariant = {
        id: 'variant-1',
        variantType: VariantType.THUMBNAIL,
        storageKey: 'uploads/default/files/thumbnail-key',
        sizeBytes: 12345,
        mimeType: 'image/jpeg',
      };

      const fileMetadata = {
        id: 'file-1',
        originalFilename: 'photo.jpg',
        mimeType: 'image/jpeg',
        fileType: 'image',
        status: FileStatus.READY,
        sizeBytes: 102400,
        version: 1,
        description: 'Test photo',
        tags: ['test'],
        variants: [thumbnailVariant],
        owner: {
          id: 'user-1',
          firstName: 'John',
          lastName: 'Doe',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockFileMetadataRepo.findOne.mockResolvedValue(fileMetadata);

      const result = await service.getFileById('file-1');

      expect(result.thumbnailUrl).toBe(
        'https://cdn.example.com/uploads/default/files/thumbnail-key',
      );
      expect(mockStorageService.getPublicUrl).toHaveBeenCalledWith(
        'uploads/default/files/thumbnail-key',
      );
    });

    it('should return undefined thumbnailUrl when no thumbnail variant exists', async () => {
      const fileMetadata = {
        id: 'file-1',
        originalFilename: 'photo.jpg',
        mimeType: 'image/jpeg',
        fileType: 'image',
        status: FileStatus.READY,
        sizeBytes: 102400,
        version: 1,
        description: 'Test photo',
        tags: ['test'],
        variants: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockFileMetadataRepo.findOne.mockResolvedValue(fileMetadata);

      const result = await service.getFileById('file-1');

      expect(result.thumbnailUrl).toBeUndefined();
    });

    it('should handle CDN URL generation failure gracefully', async () => {
      const thumbnailVariant = {
        id: 'variant-1',
        variantType: VariantType.THUMBNAIL,
        storageKey: 'uploads/default/files/thumbnail-key',
        sizeBytes: 12345,
        mimeType: 'image/jpeg',
      };

      const fileMetadata = {
        id: 'file-1',
        originalFilename: 'photo.jpg',
        mimeType: 'image/jpeg',
        fileType: 'image',
        status: FileStatus.READY,
        sizeBytes: 102400,
        version: 1,
        description: 'Test photo',
        tags: ['test'],
        variants: [thumbnailVariant],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockStorageService.getPublicUrl as jest.Mock).mockReturnValue(null);
      mockFileMetadataRepo.findOne.mockResolvedValue(fileMetadata);

      const result = await service.getFileById('file-1');

      expect(result.thumbnailUrl).toBeNull();
    });
  });
});
