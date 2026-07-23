import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { SurgeriesService } from './surgeries.service';
import { Surgery, SurgeryStatus } from './entities/surgery.entity';
import { StorageService } from '../storage/storage.service';

describe('SurgeriesService', () => {
  let service: SurgeriesService;
  let mockStorageService: Partial<StorageService>;

  const mockSurgeriesRepo = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  beforeEach(async () => {
    mockStorageService = {
      generateKey: jest.fn((options) =>
        `uploads/${options.variant}/${Date.now()}-${options.filename}`,
      ),
      upload: jest.fn().mockResolvedValue({}),
      getPublicUrl: jest.fn((key) => `https://cdn.example.com/${key}`),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SurgeriesService,
        {
          provide: getRepositoryToken(Surgery),
          useValue: mockSurgeriesRepo,
        },
        {
          provide: StorageService,
          useValue: mockStorageService,
        },
      ],
    }).compile();

    service = module.get<SurgeriesService>(SurgeriesService);
    jest.clearAllMocks();
  });

  describe('savePhoto', () => {
    const mockFile: Express.Multer.File = {
      fieldname: 'photos',
      originalname: 'surgery-photo.jpg',
      encoding: '7bit',
      mimetype: 'image/jpeg',
      size: 102400,
      buffer: Buffer.from('fake image data'),
      destination: '',
      filename: '',
      path: '',
    };

    it('should upload file and return public URL', async () => {
      const result = await service.savePhoto(mockFile);

      expect(mockStorageService.generateKey).toHaveBeenCalledWith({
        prefix: 'uploads',
        filename: 'surgery-photo.jpg',
        variant: 'surgeries',
      });

      expect(mockStorageService.upload).toHaveBeenCalledWith({
        key: expect.any(String),
        body: mockFile.buffer,
        contentType: 'image/jpeg',
        metadata: {
          originalFilename: 'surgery-photo.jpg',
          uploadedAt: expect.any(String),
        },
      });

      expect(result).toMatch(/^https:\/\/cdn\.example\.com\//);
    });

    it('should handle storage upload errors', async () => {
      (mockStorageService.upload as jest.Mock).mockRejectedValue(
        new Error('Storage service unavailable'),
      );

      await expect(service.savePhoto(mockFile)).rejects.toThrow(
        'Storage service unavailable',
      );
    });

    it('should return storage key if public URL not available', async () => {
      (mockStorageService.getPublicUrl as jest.Mock).mockReturnValue(null);

      const result = await service.savePhoto(mockFile);

      expect(result).toMatch(/uploads\/surgeries\//);
    });
  });

  describe('findOne', () => {
    it('should return a surgery when found', async () => {
      const surgery = {
        id: 'surgery-1',
        petId: 'pet-1',
        surgeryType: 'Spay',
        surgeryDate: new Date(),
        status: SurgeryStatus.COMPLETED,
      };

      mockSurgeriesRepo.findOne.mockResolvedValue(surgery);

      const result = await service.findOne('surgery-1');

      expect(result).toEqual(surgery);
      expect(mockSurgeriesRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'surgery-1' },
        relations: ['pet', 'vet'],
      });
    });

    it('should throw NotFoundException when surgery not found', async () => {
      mockSurgeriesRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('surgery-not-found')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
