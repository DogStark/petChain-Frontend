import { FileType } from '../entities/file-type.enum';
import { FileStatus } from '../entities/file-status.enum';
import { VariantType } from '../entities/variant-type.enum';

/**
 * Response DTO for file variant information
 */
export class FileVariantResponseDto {
  id: string;
  variantType: VariantType;
  width?: number;
  height?: number;
  sizeBytes: number;
  mimeType: string;
  format?: string;
  url?: string;
}

/**
 * Response DTO for file metadata
 */
export class FileResponseDto {
  id: string;
  originalFilename: string;
  mimeType: string;
  fileType: FileType;
  status: FileStatus;
  sizeBytes: number;
  version: number;
  description?: string;
  tags?: string[];
  metadata?: {
    width?: number;
    height?: number;
    duration?: number;
  };
  variants?: FileVariantResponseDto[];
  url?: string;
  thumbnailUrl?: string;
  createdAt: Date;
  updatedAt: Date;

  /**
   * Owner information (limited)
   */
  owner?: {
    id: string;
    name?: string;
  };

  /**
   * Pet information (limited)
   */
  pet?: {
    id: string;
    name: string;
  };
}

/**
 * Response DTO for upload operation
 */
export class UploadResponseDto {
  id: string;
  originalFilename: string;
  mimeType: string;
  fileType: FileType;
  status: FileStatus;
  sizeBytes: number;
  message: string;

  /**
   * Estimated processing time in seconds (for async processing)
   */
  estimatedProcessingTime?: number;
}

/**
 * Response DTO for chunked upload initialization
 */
export class ChunkedUploadInitResponseDto {
  uploadId: string;
  chunkSize: number;
  totalChunks: number;
  expiresAt: Date;
}

/**
 * Response DTO for chunk upload
 */
export class ChunkUploadResponseDto {
  uploadId: string;
  chunkNumber: number;
  totalChunks: number;
  uploadedChunks: number;
  complete: boolean;
}

/**
 * Response DTO for file list (paginated)
 */
export class FileListResponseDto {
  files: FileResponseDto[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Response DTO for signed URL
 */
export class SignedUrlResponseDto {
  url: string;
  expiresAt: Date;
  method: 'GET' | 'PUT';
}
