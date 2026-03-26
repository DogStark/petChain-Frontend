import { registerAs } from '@nestjs/config';

export interface ProcessingConfig {
  redis: {
    host: string;
    port: number;
    password?: string;
  };
  image: {
    thumbnailWidth: number;
    thumbnailHeight: number;
    compressedQuality: number;
    maxWidth: number;
    maxHeight: number;
    webpQuality: number;
    watermark?: {
      enabled: boolean;
      imagePath?: string;
      text?: string;
      position:
        | 'top-left'
        | 'top-right'
        | 'bottom-left'
        | 'bottom-right'
        | 'center';
      opacity: number;
    };
  };
  video: {
    thumbnailPosition: string; // e.g., '00:00:01'
    previewDuration: number; // seconds
    previewWidth: number;
    previewHeight: number;
  };
  concurrency: {
    imageWorkers: number;
    videoWorkers: number;
  };
}

export const processingConfig = registerAs(
  'processing',
  (): ProcessingConfig => ({
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD,
    },
    image: {
      thumbnailWidth: parseInt(process.env.IMAGE_THUMBNAIL_WIDTH || '150', 10),
      thumbnailHeight: parseInt(
        process.env.IMAGE_THUMBNAIL_HEIGHT || '150',
        10,
      ),
      compressedQuality: parseInt(
        process.env.IMAGE_COMPRESSED_QUALITY || '80',
        10,
      ),
      maxWidth: parseInt(process.env.IMAGE_MAX_WIDTH || '1920', 10),
      maxHeight: parseInt(process.env.IMAGE_MAX_HEIGHT || '1080', 10),
      webpQuality: parseInt(process.env.IMAGE_WEBP_QUALITY || '85', 10),
      watermark: {
        enabled: process.env.WATERMARK_ENABLED === 'true',
        imagePath: process.env.WATERMARK_IMAGE_PATH,
        text: process.env.WATERMARK_TEXT || 'PetChain',
        position:
          (process.env.WATERMARK_POSITION as
            | 'top-left'
            | 'top-right'
            | 'bottom-left'
            | 'bottom-right'
            | 'center') || 'bottom-right',
        opacity: parseFloat(process.env.WATERMARK_OPACITY || '0.5'),
      },
    },
    video: {
      thumbnailPosition: process.env.VIDEO_THUMBNAIL_POSITION || '00:00:01',
      previewDuration: parseInt(process.env.VIDEO_PREVIEW_DURATION || '10', 10),
      previewWidth: parseInt(process.env.VIDEO_PREVIEW_WIDTH || '480', 10),
      previewHeight: parseInt(process.env.VIDEO_PREVIEW_HEIGHT || '270', 10),
    },
    concurrency: {
      imageWorkers: parseInt(process.env.IMAGE_WORKERS || '2', 10),
      videoWorkers: parseInt(process.env.VIDEO_WORKERS || '1', 10),
    },
  }),
);
