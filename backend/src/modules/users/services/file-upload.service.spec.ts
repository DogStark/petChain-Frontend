import { Test, TestingModule } from '@nestjs/testing';
import { FileUploadService } from './file-upload.service';
import { ConfigService } from '@nestjs/config';
import { StorageService } from '../../storage/storage.service';
import { BadRequestException } from '@nestjs/common';

describe('FileUploadService', () => {
  let service: FileUploadService;
  const mockConfig = {
    get: jest.fn((key: string, def?: any) => {
      if (key === 'UPLOADS_DIR') return './tmp-avatars';
      return def;
    }),
  };
  const mockStorage = {
    providerName: 's3',
    upload: jest.fn(),
    generateKey: jest.fn().mockReturnValue('avatars/key.png'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FileUploadService,
        { provide: ConfigService, useValue: mockConfig },
        { provide: StorageService, useValue: mockStorage },
      ],
    }).compile();

    service = module.get<FileUploadService>(FileUploadService);
    jest.clearAllMocks();
  });

  it('should throw if no file', async () => {
    await expect(service.uploadAvatar(null as any, 'u1')).rejects.toThrow(BadRequestException);
  });

  it('should reject unsupported mime types', async () => {
    const file = { size: 100, mimetype: 'text/plain' } as any;
    await expect(service.uploadAvatar(file, 'u1')).rejects.toThrow(BadRequestException);
  });

  it('should upload to storage when provider is s3', async () => {
    const file = { size: 100, mimetype: 'image/png', originalname: 'a.png', buffer: Buffer.from('') } as any;
    mockStorage.upload.mockResolvedValue({ url: 'http://url' });
    const url = await service.uploadAvatar(file, 'u1');
    expect(mockStorage.generateKey).toHaveBeenCalled();
    expect(mockStorage.upload).toHaveBeenCalled();
    expect(url).toBe('http://url');
  });
});
