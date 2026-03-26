import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { StorageService } from '../storage/storage.service';
import { ValidationService } from '../validation/validation.service';
import { VirusScannerService } from '../security/virus-scanner.service';
import { EncryptionService } from '../security/encryption.service';
import { FileMetadata } from './entities/file-metadata.entity';
import { FileVersion } from './entities/file-version.entity';
import { FileVariant } from './entities/file-variant.entity';
import { FileType, getFileTypeFromMime } from './entities/file-type.enum';
import { FileStatus } from './entities/file-status.enum';
import { VariantType } from './entities/variant-type.enum';
import { UploadFileDto } from './dto/upload-file.dto';
import {
  UploadResponseDto,
  FileResponseDto,
  FileVariantResponseDto,
  SignedUrlResponseDto,
} from './dto/file-response.dto';
import { StorageConfig } from '../../config/storage.config';

/**
 * Upload Service
 *
 * Handles file upload operations including validation,
 * security scanning, encryption, storage, and metadata management.
 */
@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private readonly maxFileSizeBytes: number;
  private readonly encryptionEnabled: boolean;

  constructor(
    @InjectRepository(FileMetadata)
    private readonly fileMetadataRepository: Repository<FileMetadata>,
    @InjectRepository(FileVersion)
    private readonly fileVersionRepository: Repository<FileVersion>,
    @InjectRepository(FileVariant)
    private readonly fileVariantRepository: Repository<FileVariant>,
    private readonly storageService: StorageService,
    private readonly validationService: ValidationService,
    private readonly virusScannerService: VirusScannerService,
    private readonly encryptionService: EncryptionService,
    private readonly configService: ConfigService,
  ) {
    const config = this.configService.get<StorageConfig>('storage');
    this.maxFileSizeBytes = (config?.maxFileSizeMb || 50) * 1024 * 1024;
    this.encryptionEnabled = config?.encryption?.enabled || false;
  }

  /**
   * Upload a single file with validation, virus scanning, and optional encryption
   */
  async uploadFile(
    file: Express.Multer.File,
    dto: UploadFileDto,
    ownerId: string,
  ): Promise<UploadResponseDto> {
    this.logger.log(
      `Uploading file: ${file.originalname} for user: ${ownerId}`,
    );

    // Step 1: Validate file (MIME type, magic number, size, security)
    const validationResult = await this.validationService.validateFile(
      file.buffer,
      file.originalname,
      file.mimetype,
    );

    if (!validationResult.valid) {
      throw new BadRequestException({
        message: 'File validation failed',
        errors: validationResult.errors,
        warnings: validationResult.warnings,
      });
    }

    // Log any warnings
    if (validationResult.warnings.length > 0) {
      this.logger.warn(
        `File ${file.originalname} passed with warnings: ${validationResult.warnings.join('; ')}`,
      );
    }

    // Step 2: Virus scan
    const scanResult = await this.virusScannerService.scan(file.buffer);
    if (!scanResult.clean) {
      this.logger.error(
        `Virus detected in file ${file.originalname}: ${scanResult.threat || 'Unknown'}`,
      );
      throw new BadRequestException({
        message: 'File rejected: security threat detected',
        threat: scanResult.threat,
      });
    }

    // Determine file type
    const fileType = dto.fileType || getFileTypeFromMime(file.mimetype);

    // Generate storage key
    const storageKey = this.storageService.generateKey({
      prefix: 'uploads',
      ownerId,
      petId: dto.petId,
      filename: file.originalname,
      variant: 'original',
    });

    // Calculate checksum
    const checksum = this.calculateChecksum(file.buffer);

    // Step 3: Encrypt if enabled
    let uploadBuffer = file.buffer;
    let encryptionIv: string | undefined;
    let isEncrypted = false;

    if (this.encryptionEnabled) {
      try {
        const encrypted = await this.encryptionService.encrypt(file.buffer);
        uploadBuffer = encrypted.encrypted;
        encryptionIv = `${encrypted.iv}:${encrypted.authTag}`;
        isEncrypted = true;
        this.logger.debug(`File encrypted: ${file.originalname}`);
      } catch (error) {
        this.logger.error('Encryption failed:', error);
        throw new BadRequestException('File encryption failed');
      }
    }

    // Create file metadata record
    const fileMetadata = this.fileMetadataRepository.create({
      ownerId,
      petId: dto.petId,
      originalFilename: file.originalname,
      storageKey,
      mimeType: file.mimetype,
      fileType,
      status: FileStatus.PENDING,
      sizeBytes: file.size,
      checksum,
      isEncrypted,
      encryptionIv,
      description: dto.description,
      tags: dto.tags,
      version: 1,
      metadata: {
        virusScanResult: 'clean',
        virusScanDate: new Date().toISOString(),
      },
    });

    // Save metadata first
    const savedMetadata = await this.fileMetadataRepository.save(fileMetadata);

    try {
      // Step 4: Upload to storage
      await this.storageService.upload({
        key: storageKey,
        body: uploadBuffer,
        contentType: file.mimetype,
        metadata: {
          fileId: savedMetadata.id,
          ownerId,
          originalFilename: file.originalname,
          encrypted: isEncrypted ? 'true' : 'false',
        },
      });

      // Update status to ready
      savedMetadata.status = FileStatus.READY;
      await this.fileMetadataRepository.save(savedMetadata);

      this.logger.log(`File uploaded successfully: ${savedMetadata.id}`);

      return {
        id: savedMetadata.id,
        originalFilename: savedMetadata.originalFilename,
        mimeType: savedMetadata.mimeType,
        fileType: savedMetadata.fileType,
        status: savedMetadata.status,
        sizeBytes: savedMetadata.sizeBytes,
        message: 'File uploaded successfully',
      };
    } catch (error) {
      // Mark as failed if upload fails
      savedMetadata.status = FileStatus.FAILED;
      savedMetadata.errorMessage =
        error instanceof Error ? error.message : 'Upload failed';
      await this.fileMetadataRepository.save(savedMetadata);
      throw error;
    }
  }

  /**
   * Get file metadata by ID
   */
  async getFileById(id: string, ownerId?: string): Promise<FileResponseDto> {
    const whereClause: { id: string; ownerId?: string } = { id };
    if (ownerId) {
      whereClause.ownerId = ownerId;
    }

    const file = await this.fileMetadataRepository.findOne({
      where: whereClause,
      relations: ['variants', 'owner', 'pet'],
    });

    if (!file) {
      throw new NotFoundException(`File with ID ${id} not found`);
    }

    return this.toFileResponse(file);
  }

  /**
   * Get files for a specific pet
   */
  async getFilesByPet(
    petId: string,
    ownerId?: string,
  ): Promise<FileResponseDto[]> {
    const whereClause: { petId: string; ownerId?: string; status: FileStatus } =
      {
        petId,
        status: FileStatus.READY,
      };
    if (ownerId) {
      whereClause.ownerId = ownerId;
    }

    const files = await this.fileMetadataRepository.find({
      where: whereClause,
      relations: ['variants'],
      order: { createdAt: 'DESC' },
    });

    return files.map((file) => this.toFileResponse(file));
  }

  /**
   * Get files for a specific owner
   */
  async getFilesByOwner(
    ownerId: string,
    options?: { page?: number; pageSize?: number; fileType?: FileType },
  ): Promise<{ files: FileResponseDto[]; total: number }> {
    const page = options?.page || 1;
    const pageSize = options?.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const whereClause: {
      ownerId: string;
      status: FileStatus;
      fileType?: FileType;
    } = {
      ownerId,
      status: FileStatus.READY,
    };

    if (options?.fileType) {
      whereClause.fileType = options.fileType;
    }

    const [files, total] = await this.fileMetadataRepository.findAndCount({
      where: whereClause,
      relations: ['variants', 'pet'],
      order: { createdAt: 'DESC' },
      skip,
      take: pageSize,
    });

    return {
      files: files.map((file) => this.toFileResponse(file)),
      total,
    };
  }

  /**
   * Get a signed download URL for a file
   */
  async getDownloadUrl(
    id: string,
    ownerId?: string,
    variantType?: VariantType,
  ): Promise<SignedUrlResponseDto> {
    const file = await this.getFileMetadata(id, ownerId);

    let storageKey = file.storageKey;

    // If variant requested, find the variant
    if (variantType && variantType !== VariantType.ORIGINAL) {
      const variant = await this.fileVariantRepository.findOne({
        where: { fileId: id, variantType },
      });

      if (variant) {
        storageKey = variant.storageKey;
      }
    }

    const expiresIn = 3600; // 1 hour
    const url = await this.storageService.getSignedUrl({
      key: storageKey,
      operation: 'get',
      expiresIn,
      responseContentDisposition: `attachment; filename="${file.originalFilename}"`,
    });

    return {
      url,
      expiresAt: new Date(Date.now() + expiresIn * 1000),
      method: 'GET',
    };
  }

  /**
   * Soft delete a file
   */
  async deleteFile(id: string, ownerId: string): Promise<void> {
    const file = await this.getFileMetadata(id, ownerId);

    // Soft delete - mark as deleted
    file.status = FileStatus.DELETED;
    file.deletedAt = new Date();
    await this.fileMetadataRepository.save(file);

    this.logger.log(`File soft deleted: ${id}`);
  }

  /**
   * Permanently delete a file and all its variants
   */
  async permanentlyDeleteFile(id: string): Promise<void> {
    const file = await this.fileMetadataRepository.findOne({
      where: { id },
      relations: ['variants', 'versions'],
    });

    if (!file) {
      throw new NotFoundException(`File with ID ${id} not found`);
    }

    // Delete from storage
    const keysToDelete = [
      file.storageKey,
      ...(file.variants?.map((v) => v.storageKey) || []),
      ...(file.versions?.map((v) => v.storageKey) || []),
    ];

    for (const key of keysToDelete) {
      try {
        await this.storageService.delete({ key });
      } catch (error) {
        this.logger.warn(`Failed to delete storage key: ${key}`, error);
      }
    }

    // Delete from database (cascades to variants and versions)
    await this.fileMetadataRepository.remove(file);

    this.logger.log(`File permanently deleted: ${id}`);
  }

  /**
   * Helper: Get file metadata with owner validation
   */
  private async getFileMetadata(
    id: string,
    ownerId?: string,
  ): Promise<FileMetadata> {
    const whereClause: { id: string; ownerId?: string } = { id };
    if (ownerId) {
      whereClause.ownerId = ownerId;
    }

    const file = await this.fileMetadataRepository.findOne({
      where: whereClause,
    });

    if (!file) {
      throw new NotFoundException(`File with ID ${id} not found`);
    }

    if (file.status === FileStatus.DELETED) {
      throw new NotFoundException(`File with ID ${id} has been deleted`);
    }

    return file;
  }

  /**
   * Helper: Convert entity to response DTO
   */
  private toFileResponse(file: FileMetadata): FileResponseDto {
    const variants: FileVariantResponseDto[] =
      file.variants?.map((v) => ({
        id: v.id,
        variantType: v.variantType,
        width: v.width,
        height: v.height,
        sizeBytes: v.sizeBytes,
        mimeType: v.mimeType,
        format: v.format,
      })) || [];

    // Find thumbnail for thumbnailUrl
    const thumbnail = file.variants?.find(
      (v) => v.variantType === VariantType.THUMBNAIL,
    );

    return {
      id: file.id,
      originalFilename: file.originalFilename,
      mimeType: file.mimeType,
      fileType: file.fileType,
      status: file.status,
      sizeBytes: file.sizeBytes,
      version: file.version,
      description: file.description,
      tags: file.tags,
      metadata: file.metadata
        ? {
            width: file.metadata.width,
            height: file.metadata.height,
            duration: file.metadata.duration,
          }
        : undefined,
      variants,
      thumbnailUrl: thumbnail ? undefined : undefined, // Will be populated by CDN in next milestone
      owner: file.owner
        ? {
            id: file.owner.id,
            name: (file.owner as { firstName?: string; lastName?: string })
              .firstName
              ? `${(file.owner as { firstName?: string; lastName?: string }).firstName} ${(file.owner as { firstName?: string; lastName?: string }).lastName || ''}`
              : undefined,
          }
        : undefined,
      pet: file.pet
        ? {
            id: file.pet.id,
            name: file.pet.name,
          }
        : undefined,
      createdAt: file.createdAt,
      updatedAt: file.updatedAt,
    };
  }

  /**
   * Helper: Calculate SHA-256 checksum
   */
  private calculateChecksum(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex');
  }
}
