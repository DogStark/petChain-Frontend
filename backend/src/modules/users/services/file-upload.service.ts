import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { StorageService } from '../../storage/storage.service';
import { UploadResult } from '../../storage/interfaces/storage-types.interface';

@Injectable()
export class FileUploadService {
  private readonly uploadsDir: string;
  private readonly maxFileSize: number = 5 * 1024 * 1024; // 5MB
  private readonly allowedMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
  ];
  private readonly logger = new Logger(FileUploadService.name);

  constructor(
    private configService: ConfigService,
    private storageService: StorageService,
  ) {
    this.uploadsDir = this.configService.get<string>(
      'UPLOADS_DIR',
      './uploads/avatars',
    );
    this.ensureUploadsDir();
  }

  /**
   * Ensure uploads directory exists
   */
  private ensureUploadsDir(): void {
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
  }

  /**
   * Upload avatar file
   */
  async uploadAvatar(
    file: Express.Multer.File,
    userId: string,
  ): Promise<string> {
    this.validateFile(file);

    const filename = this.generateFilename(userId, file);

    // if storage provider is s3/gcs use the storage service
    if (
      this.storageService &&
      ['s3', 'gcs'].includes(this.storageService.providerName)
    ) {
      const key = this.storageService.generateKey({
        prefix: 'avatars',
        ownerId: userId,
        filename,
      });
      try {
        const result: UploadResult = await this.storageService.upload({
          key,
          body: file.buffer,
          contentType: file.mimetype,
        });
        // return public url if available or key path
        return result.url || key;
      } catch (err) {
        this.logger.error('Failed to upload avatar to storage', err);
        throw new BadRequestException('Failed to upload avatar');
      }
    }

    // fallback to local filesystem
    const filepath = path.join(this.uploadsDir, filename);
    try {
      fs.writeFileSync(filepath, file.buffer);
      return `/uploads/avatars/${filename}`;
    } catch (error) {
      throw new BadRequestException('Failed to upload avatar');
    }
  }

  /**
   * Delete avatar file
   */
  async deleteAvatar(filename: string): Promise<void> {
    const filepath = path.join(this.uploadsDir, filename);
    try {
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
    } catch (error) {
      // Log error but don't throw - file may already be deleted
      console.error(`Failed to delete avatar: ${error}`);
    }
  }

  /**
   * Validate uploaded file
   */
  private validateFile(file: Express.Multer.File): void {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    if (file.size > this.maxFileSize) {
      throw new BadRequestException(
        `File size exceeds ${this.maxFileSize / 1024 / 1024}MB limit`,
      );
    }

    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed',
      );
    }
  }

  /**
   * Generate unique filename
   */
  private generateFilename(userId: string, file: Express.Multer.File): string {
    const hash = crypto.randomBytes(8).toString('hex');
    const ext = path.extname(file.originalname);
    return `${userId}-${hash}${ext}`;
  }
}
