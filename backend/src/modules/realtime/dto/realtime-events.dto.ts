export class UploadProgressDto {
  fileId: string;
  progress: number;
  bytesUploaded: number;
  totalBytes: number;
}

export class ProcessingStatusDto {
  fileId: string;
  status: string;
  progress?: number;
  variant?: string;
  error?: string;
}
