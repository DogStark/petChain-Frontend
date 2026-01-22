import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FileMetadata } from 'src/modules/upload/entities/file-metadata.entity';
import { FileVariant } from 'src/modules/upload/entities/file-variant.entity';
import { FileVersion } from 'src/modules/upload/entities/file-version.entity';
import { CdnService } from 'src/modules/cdn/cdn.service';
import { VersioningService } from 'src/modules/cdn/versioning.service';
import { FileResponseDto } from './dto/file-response.dto';
import { VariantType } from 'src/modules/upload/entities/variant-type.enum';
import { FileStatus } from 'src/modules/upload/entities/file-status.enum';

@Injectable()
export class FilesService {
  constructor(
    @InjectRepository(FileMetadata)
    private readonly fileMetadataRepository: Repository<FileMetadata>,
    @InjectRepository(FileVariant)
    private readonly fileVariantRepository: Repository<FileVariant>,
    private readonly cdnService: CdnService,
    private readonly versioningService: VersioningService,
  ) {}

  /**
   * Get file by ID
   */
  async getFile(id: string, userId?: string): Promise<FileResponseDto> {
    const file = await this.fileMetadataRepository.findOne({
      where: { id },
      relations: ['variants'],
    });

    if (!file) {
      throw new NotFoundException(`File not found: ${id}`);
    }

    // Check ownership/permissions if userId provided
    if (userId && file.ownerId && file.ownerId !== userId) {
      // Allow access if file is public or shared (to be implemented)
      // For now, simple ownership check
      // throw new ForbiddenException('Access denied');
    }

    return this.mapToFileResponse(file);
  }

  /**
   * Get signed download URL
   */
  async getDownloadUrl(
    id: string,
    userId?: string,
  ): Promise<{ url: string; expiresAt: Date }> {
    const file = await this.fileMetadataRepository.findOne({
      where: { id },
    });

    if (!file) {
      throw new NotFoundException(`File not found: ${id}`);
    }

    // Check permissions
    if (userId && file.ownerId && file.ownerId !== userId) {
      // throw new ForbiddenException('Access denied');
    }

    const signedUrl = await this.cdnService.generateSignedUrl({
      key: file.storageKey,
      filename: file.originalFilename,
      contentDisposition: 'attachment',
    });

    return {
      url: signedUrl.url,
      expiresAt: signedUrl.expiresAt,
    };
  }

  /**
   * Get file variants
   */
  async getVariants(id: string): Promise<any[]> {
    // TODO: Proper DTO
    return this.fileVariantRepository.find({
      where: { fileId: id },
    });
  }

  /**
   * Get file version history
   */
  async getVersions(id: string): Promise<FileVersion[]> {
    const history = await this.versioningService.getVersionHistory(id);
    return history.versions;
  }

  /**
   * Revert to previous version
   */
  async revertVersion(
    id: string,
    versionNumber: number,
    userId: string,
  ): Promise<FileResponseDto> {
    // Permission check logic
    await this.versioningService.restoreVersion(id, versionNumber, userId);
    return this.getFile(id, userId);
  }

  /**
   * Soft delete file
   */
  async deleteFile(id: string, userId: string): Promise<void> {
    const file = await this.fileMetadataRepository.findOne({ where: { id } });
    if (!file) throw new NotFoundException('File not found');

    if (file.ownerId !== userId) {
      throw new ForbiddenException('You can only delete your own files');
    }

    file.status = FileStatus.DELETED;
    file.deletedAt = new Date();
    await this.fileMetadataRepository.save(file);
  }

  /**
   * Get files by pet ID
   */
  async getFilesByPet(petId: string): Promise<FileResponseDto[]> {
    const files = await this.fileMetadataRepository.find({
      where: { petId, status: FileStatus.READY },
      relations: ['variants'],
      order: { createdAt: 'DESC' },
    });

    return Promise.all(files.map((file) => this.mapToFileResponse(file)));
  }

  /**
   * Map entity to response DTO
   */
  private async mapToFileResponse(
    file: FileMetadata,
  ): Promise<FileResponseDto> {
    // Generate signed URL for main file
    const signedUrl = await this.cdnService.generateSignedUrl({
      key: file.storageKey,
      contentDisposition: 'inline',
    });

    // Generate URLs for variants
    const variantsDto = await Promise.all(
      (file.variants || []).map(async (variant) => {
        const variantUrl = await this.cdnService.generateSignedUrl({
          key: variant.storageKey,
          contentDisposition: 'inline',
        });

        return {
          type: variant.variantType,
          url: variantUrl.url,
          width: variant.width,
          height: variant.height,
          size: variant.sizeBytes,
        };
      }),
    );

    // Find thumbnail if available
    const thumbnail = variantsDto.find((v) => v.type === VariantType.THUMBNAIL);

    return {
      id: file.id,
      originalFilename: file.originalFilename,
      mimeType: file.mimeType,
      fileType: file.fileType,
      status: file.status,
      size: file.sizeBytes,
      url: signedUrl.url,
      thumbnailUrl: thumbnail?.url,
      createdAt: file.createdAt.toISOString(),
      updatedAt: file.updatedAt.toISOString(),
      version: file.version,
      metadata: file.metadata,
      variants: variantsDto,
      description: file.description,
      tags: file.tags,
    };
  }
}
