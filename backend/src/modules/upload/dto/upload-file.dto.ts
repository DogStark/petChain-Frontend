import {
  IsString,
  IsOptional,
  IsUUID,
  IsArray,
  MaxLength,
  IsEnum,
} from 'class-validator';
import { FileType } from '../entities/file-type.enum';

/**
 * DTO for file upload request
 */
export class UploadFileDto {
  /**
   * Pet ID to associate the file with (optional)
   */
  @IsOptional()
  @IsUUID()
  petId?: string;

  /**
   * Description or caption for the file
   */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  /**
   * Tags for categorization
   */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  /**
   * Force a specific file type (auto-detected if not provided)
   */
  @IsOptional()
  @IsEnum(FileType)
  fileType?: FileType;
}

/**
 * DTO for chunked upload initialization
 */
export class InitChunkedUploadDto {
  /**
   * Original filename
   */
  @IsString()
  filename: string;

  /**
   * Total file size in bytes
   */
  @IsString()
  totalSize: string;

  /**
   * MIME type of the file
   */
  @IsString()
  mimeType: string;

  /**
   * Pet ID to associate the file with (optional)
   */
  @IsOptional()
  @IsUUID()
  petId?: string;

  /**
   * Description for the file
   */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

/**
 * DTO for uploading a chunk
 */
export class UploadChunkDto {
  /**
   * Upload session ID
   */
  @IsUUID()
  uploadId: string;

  /**
   * Chunk number (0-indexed)
   */
  @IsString()
  chunkNumber: string;

  /**
   * Total number of chunks
   */
  @IsString()
  totalChunks: string;
}

/**
 * DTO for completing a chunked upload
 */
export class CompleteChunkedUploadDto {
  /**
   * Upload session ID
   */
  @IsUUID()
  uploadId: string;
}
