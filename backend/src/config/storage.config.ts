import { registerAs } from '@nestjs/config';

export interface StorageConfig {
  provider: 's3' | 'gcs';
  maxFileSizeMb: number;
  allowedMimeTypes: string[];
  tempDirectory: string;
  encryption: {
    enabled: boolean;
    key: string;
  };
  s3: {
    bucket: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    endpoint?: string; // For S3-compatible services (MinIO, etc.)
  };
  gcs: {
    bucket: string;
    projectId: string;
    keyFilePath?: string;
  };
}

export const storageConfig = registerAs(
  'storage',
  (): StorageConfig => ({
    provider: (process.env.STORAGE_PROVIDER as 's3' | 'gcs') || 's3',
    maxFileSizeMb: parseInt(process.env.MAX_FILE_SIZE_MB || '50', 10),
    allowedMimeTypes: (
      process.env.ALLOWED_MIME_TYPES ||
      'image/jpeg,image/png,image/webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,video/mp4,video/quicktime'
    ).split(','),
    tempDirectory: process.env.TEMP_UPLOAD_DIR || '/tmp/petchain-uploads',

    encryption: {
      enabled: process.env.FILE_ENCRYPTION_ENABLED === 'true',
      key: process.env.FILE_ENCRYPTION_KEY || '',
    },

    s3: {
      bucket: process.env.AWS_S3_BUCKET || 'petchain-uploads',
      region: process.env.AWS_S3_REGION || 'us-east-1',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      endpoint: process.env.AWS_S3_ENDPOINT,
    },

    gcs: {
      bucket: process.env.GCS_BUCKET || 'petchain-uploads',
      projectId: process.env.GCS_PROJECT_ID || '',
      keyFilePath: process.env.GCS_KEY_FILE,
    },
  }),
);
