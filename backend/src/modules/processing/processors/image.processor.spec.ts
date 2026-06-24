import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ImageProcessor } from './image.processor';
import { ImageProcessingService } from '../services/image-processing.service';
import { StorageService } from '../../storage/storage.service';
import { FileMetadata } from '../../upload/entities/file-metadata.entity';
import { FileVariant } from '../../upload/entities/file-variant.entity';
import { ProcessingJob, ProcessingJobStatus, ProcessingJobType } from '../entities/processing-job.entity';
import { RealtimeGateway } from '../../realtime/realtime.gateway';
import { Job } from 'bullmq';

const mockResult = { buffer: Buffer.from('img'), width: 300, height: 300, format: 'webp', size: 3 };

const mockImageProcessingService = {
  generateThumbnail: jest.fn().mockResolvedValue(mockResult),
  compress: jest.fn().mockResolvedValue(mockResult),
  convertToWebP: jest.fn().mockResolvedValue(mockResult),
  addWatermark: jest.fn().mockResolvedValue(mockResult),
  stripMetadata: jest.fn().mockResolvedValue(mockResult),
};

const mockStorageService = {
  download: jest.fn().mockResolvedValue({ body: Buffer.from('original') }),
  upload: jest.fn().mockResolvedValue({}),
};

const mockFileMetadataRepo = {
  findOne: jest.fn().mockResolvedValue({ id: 'file-1', storageKey: 'uploads/file.jpg', mimeType: 'image/jpeg' }),
};

const mockFileVariantRepo = {
  create: jest.fn().mockReturnValue({}),
  save: jest.fn().mockResolvedValue({}),
};

const mockProcessingJobRepo = {
  update: jest.fn().mockResolvedValue({}),
};

const mockRealtimeGateway = {
  emitProcessingStatus: jest.fn(),
  emitProcessingComplete: jest.fn(),
  emitProcessingError: jest.fn(),
};

const makeJob = (jobType: ProcessingJobType): Job<any> =>
  ({ data: { fileId: 'file-1', processingJobId: 'job-1', jobType } } as Job<any>);

describe('ImageProcessor', () => {
  let processor: ImageProcessor;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ImageProcessor,
        { provide: ImageProcessingService, useValue: mockImageProcessingService },
        { provide: StorageService, useValue: mockStorageService },
        { provide: getRepositoryToken(FileMetadata), useValue: mockFileMetadataRepo },
        { provide: getRepositoryToken(FileVariant), useValue: mockFileVariantRepo },
        { provide: getRepositoryToken(ProcessingJob), useValue: mockProcessingJobRepo },
        { provide: RealtimeGateway, useValue: mockRealtimeGateway },
      ],
    }).compile();
    processor = module.get(ImageProcessor);
    jest.clearAllMocks();
    mockFileMetadataRepo.findOne.mockResolvedValue({ id: 'file-1', storageKey: 'uploads/file.jpg', mimeType: 'image/jpeg' });
    mockImageProcessingService.generateThumbnail.mockResolvedValue(mockResult);
    mockImageProcessingService.compress.mockResolvedValue(mockResult);
    mockImageProcessingService.convertToWebP.mockResolvedValue(mockResult);
    mockImageProcessingService.addWatermark.mockResolvedValue(mockResult);
    mockImageProcessingService.stripMetadata.mockResolvedValue(mockResult);
    mockStorageService.download.mockResolvedValue({ body: Buffer.from('original') });
  });

  it('processes IMAGE_THUMBNAIL', async () => {
    await processor.process(makeJob(ProcessingJobType.IMAGE_THUMBNAIL));
    expect(mockImageProcessingService.generateThumbnail).toHaveBeenCalled();
    expect(mockStorageService.upload).toHaveBeenCalled();
    expect(mockProcessingJobRepo.update).toHaveBeenCalledWith('job-1', expect.objectContaining({ status: ProcessingJobStatus.COMPLETED }));
  });

  it('processes IMAGE_COMPRESS', async () => {
    await processor.process(makeJob(ProcessingJobType.IMAGE_COMPRESS));
    expect(mockImageProcessingService.compress).toHaveBeenCalled();
    expect(mockProcessingJobRepo.update).toHaveBeenCalledWith('job-1', expect.objectContaining({ status: ProcessingJobStatus.COMPLETED }));
  });

  it('processes IMAGE_WEBP', async () => {
    await processor.process(makeJob(ProcessingJobType.IMAGE_WEBP));
    expect(mockImageProcessingService.convertToWebP).toHaveBeenCalled();
    expect(mockProcessingJobRepo.update).toHaveBeenCalledWith('job-1', expect.objectContaining({ status: ProcessingJobStatus.COMPLETED }));
  });

  it('processes IMAGE_WATERMARK', async () => {
    await processor.process(makeJob(ProcessingJobType.IMAGE_WATERMARK));
    expect(mockImageProcessingService.addWatermark).toHaveBeenCalled();
    expect(mockProcessingJobRepo.update).toHaveBeenCalledWith('job-1', expect.objectContaining({ status: ProcessingJobStatus.COMPLETED }));
  });

  it('processes STRIP_METADATA', async () => {
    await processor.process(makeJob(ProcessingJobType.STRIP_METADATA));
    expect(mockImageProcessingService.stripMetadata).toHaveBeenCalled();
    expect(mockStorageService.upload).toHaveBeenCalledWith(expect.objectContaining({ key: 'uploads/file.jpg' }));
    expect(mockProcessingJobRepo.update).toHaveBeenCalledWith('job-1', expect.objectContaining({ status: ProcessingJobStatus.COMPLETED }));
  });

  it('marks job FAILED and emits error on exception', async () => {
    mockImageProcessingService.generateThumbnail.mockRejectedValue(new Error('sharp error'));
    await expect(processor.process(makeJob(ProcessingJobType.IMAGE_THUMBNAIL))).rejects.toThrow('sharp error');
    expect(mockProcessingJobRepo.update).toHaveBeenCalledWith('job-1', expect.objectContaining({ status: ProcessingJobStatus.FAILED, errorMessage: 'sharp error' }));
    expect(mockRealtimeGateway.emitProcessingError).toHaveBeenCalledWith('file-1', 'sharp error');
  });

  it('throws when file not found', async () => {
    mockFileMetadataRepo.findOne.mockResolvedValue(null);
    await expect(processor.process(makeJob(ProcessingJobType.IMAGE_THUMBNAIL))).rejects.toThrow('File not found: file-1');
  });
});
