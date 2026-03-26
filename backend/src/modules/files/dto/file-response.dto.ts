import { FileType } from '../../upload/entities/file-type.enum';
import { FileStatus } from '../../upload/entities/file-status.enum';

export class FileVariantResponseDto {
  type: string;
  url: string;
  width?: number;
  height?: number;
  size: number;
}

export class FileResponseDto {
  id: string;
  originalFilename: string;
  mimeType: string;
  fileType: FileType;
  status: FileStatus;
  size: number;
  url: string; // Signed or public URL
  thumbnailUrl?: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  metadata?: Record<string, unknown>;
  variants: FileVariantResponseDto[];
  description?: string;
  tags?: string[];
}
