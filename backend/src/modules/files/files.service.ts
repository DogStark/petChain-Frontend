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
  async getFilesByPet(
    petId: string,
    _userId?: string,
  ): Promise<FileResponseDto[]> {
    const files = await this.fileMetadataRepository.find({
      where: { petId, status: FileStatus.READY },
      relations: ['variants'],
      order: { createdAt: 'DESC' },
    });

    return Promise.all(files.map((file) => this.mapToFileResponse(file)));
  }

  async getSystemStatistics() {
    const [totalFiles, deletedFiles] = await Promise.all([
      this.fileMetadataRepository.count(),
      this.fileMetadataRepository.count({
        where: { status: FileStatus.DELETED },
      }),
    ]);

    return {
      totalFiles,
      activeFiles: totalFiles - deletedFiles,
      deletedFiles,
    };
  }

  async getSystemFiles(filters: {
    page: number;
    pageSize: number;
    status?: string;
    fileType?: string;
    userId?: string;
  }) {
    const page = Math.max(filters.page || 1, 1);
    const pageSize = Math.max(filters.pageSize || 50, 1);

    const qb = this.fileMetadataRepository.createQueryBuilder('file');
    if (filters.status) {
      qb.andWhere('file.status = :status', { status: filters.status });
    }
    if (filters.fileType) {
      qb.andWhere('file.fileType = :fileType', { fileType: filters.fileType });
    }
    if (filters.userId) {
      qb.andWhere('file.ownerId = :userId', { userId: filters.userId });
    }

    qb.orderBy('file.createdAt', 'DESC');
    qb.skip((page - 1) * pageSize).take(pageSize);

    const [items, total] = await qb.getManyAndCount();
    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getStorageUsageByUser() {
    const rows = await this.fileMetadataRepository
      .createQueryBuilder('file')
      .select('file.ownerId', 'ownerId')
      .addSelect('COUNT(file.id)', 'fileCount')
      .addSelect('COALESCE(SUM(file.sizeBytes), 0)', 'totalBytes')
      .groupBy('file.ownerId')
      .orderBy('totalBytes', 'DESC')
      .getRawMany();
    return rows;
  }

  async getStorageUsageByType() {
    const rows = await this.fileMetadataRepository
      .createQueryBuilder('file')
      .select('file.fileType', 'fileType')
      .addSelect('COUNT(file.id)', 'fileCount')
      .addSelect('COALESCE(SUM(file.sizeBytes), 0)', 'totalBytes')
      .groupBy('file.fileType')
      .orderBy('totalBytes', 'DESC')
      .getRawMany();
    return rows;
  }

  async getFileAuditLog(fileId: string, page: number, pageSize: number) {
    const file = await this.fileMetadataRepository.findOne({
      where: { id: fileId },
    });
    if (!file) {
      throw new NotFoundException(`File not found: ${fileId}`);
    }

    return {
      fileId,
      page,
      pageSize,
      total: 1,
      events: [
        {
          type: 'FILE_METADATA',
          status: file.status,
          timestamp: file.updatedAt,
        },
      ],
    };
  }

  async permanentlyDeleteFile(fileId: string): Promise<void> {
    const file = await this.fileMetadataRepository.findOne({
      where: { id: fileId },
    });
    if (!file) {
      throw new NotFoundException(`File not found: ${fileId}`);
    }
    await this.fileMetadataRepository.remove(file);
  }

  async getPendingDeletions(page: number, pageSize: number) {
    const safePage = Math.max(page || 1, 1);
    const safePageSize = Math.max(pageSize || 50, 1);

    const [items, total] = await this.fileMetadataRepository.findAndCount({
      where: { status: FileStatus.DELETED },
      order: { deletedAt: 'DESC' },
      skip: (safePage - 1) * safePageSize,
      take: safePageSize,
    });

    return {
      items,
      total,
      page: safePage,
      pageSize: safePageSize,
      totalPages: Math.ceil(total / safePageSize),
    };
  }

  async restoreDeletedFile(fileId: string): Promise<FileResponseDto> {
    const file = await this.fileMetadataRepository.findOne({
      where: { id: fileId },
      relations: ['variants'],
    });
    if (!file) {
      throw new NotFoundException(`File not found: ${fileId}`);
    }

    file.status = FileStatus.READY;
    file.deletedAt = null;
    const saved = await this.fileMetadataRepository.save(file);
    return this.mapToFileResponse(saved);
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
