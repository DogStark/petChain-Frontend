import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sharp from 'sharp';
import { ProcessingConfig } from '../../../config/processing.config';

/**
 * Image processing options
 */
export interface ImageProcessingOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp' | 'avif';
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  withoutEnlargement?: boolean;
}

/**
 * Image processing result
 */
export interface ImageProcessingResult {
  buffer: Buffer;
  width: number;
  height: number;
  format: string;
  size: number;
}

/**
 * Image metadata
 */
export interface ImageMetadata {
  width: number;
  height: number;
  format: string;
  space?: string;
  channels?: number;
  depth?: string;
  density?: number;
  hasAlpha?: boolean;
  orientation?: number;
  exif?: Record<string, unknown>;
  icc?: Buffer;
  iptc?: Record<string, unknown>;
  xmp?: Record<string, unknown>;
}

/**
 * Image Processing Service
 *
 * Uses Sharp for high-performance image processing.
 * Features:
 * - Resize and crop
 * - Format conversion
 * - Quality compression
 * - Thumbnail generation
 * - Watermarking
 * - EXIF stripping
 */
@Injectable()
export class ImageProcessingService {
  private readonly logger = new Logger(ImageProcessingService.name);
  private readonly config: ProcessingConfig['image'] | undefined;

  constructor(private readonly configService: ConfigService) {
    this.config =
      this.configService.get<ProcessingConfig['image']>('processing.image')!;
  }

  /**
   * Get image metadata
   */
  async getMetadata(buffer: Buffer): Promise<ImageMetadata> {
    const metadata = await sharp(buffer).metadata();
    return {
      width: metadata.width || 0,
      height: metadata.height || 0,
      format: metadata.format || 'unknown',
      space: metadata.space,
      channels: metadata.channels,
      depth: metadata.depth,
      density: metadata.density,
      hasAlpha: metadata.hasAlpha,
      orientation: metadata.orientation,
      exif: metadata.exif ? this.parseExif(metadata.exif) : undefined,
    };
  }

  /**
   * Resize image
   */
  async resize(
    buffer: Buffer,
    options: ImageProcessingOptions,
  ): Promise<ImageProcessingResult> {
    this.logger.debug(`Resizing image to ${options.width}x${options.height}`);

    let pipeline = sharp(buffer);

    // Apply resize
    pipeline = pipeline.resize({
      width: options.width,
      height: options.height,
      fit: options.fit || 'inside',
      withoutEnlargement: options.withoutEnlargement ?? true,
    });

    // Apply format conversion and quality
    pipeline = this.applyFormat(pipeline, options.format, options.quality);

    const result = await pipeline.toBuffer({ resolveWithObject: true });

    return {
      buffer: result.data,
      width: result.info.width,
      height: result.info.height,
      format: result.info.format,
      size: result.info.size,
    };
  }

  /**
   * Generate thumbnail
   */
  async generateThumbnail(
    buffer: Buffer,
    width?: number,
    height?: number,
  ): Promise<ImageProcessingResult> {
    const thumbWidth = width || this.config?.thumbnailWidth || 150;
    const thumbHeight = height || this.config?.thumbnailHeight || 150;

    this.logger.debug(`Generating thumbnail: ${thumbWidth}x${thumbHeight}`);

    const result = await sharp(buffer)
      .resize({
        width: thumbWidth,
        height: thumbHeight,
        fit: 'cover',
        position: 'attention', // Focus on the most interesting part
      })
      .jpeg({ quality: 80 })
      .toBuffer({ resolveWithObject: true });

    return {
      buffer: result.data,
      width: result.info.width,
      height: result.info.height,
      format: 'jpeg',
      size: result.info.size,
    };
  }

  /**
   * Compress image
   */
  async compress(
    buffer: Buffer,
    quality?: number,
    format?: 'jpeg' | 'webp' | 'avif',
  ): Promise<ImageProcessingResult> {
    const targetQuality = quality || this.config?.compressedQuality || 80;
    const targetFormat = format || 'jpeg';

    this.logger.debug(
      `Compressing image to ${targetFormat} at quality ${targetQuality}`,
    );

    let pipeline = sharp(buffer);

    // Resize if larger than max dimensions
    const metadata = await sharp(buffer).metadata();
    const maxWidth = this.config?.maxWidth || 1920;
    const maxHeight = this.config?.maxHeight || 1080;
    if (
      (metadata.width && metadata.width > maxWidth) ||
      (metadata.height && metadata.height > maxHeight)
    ) {
      pipeline = pipeline.resize({
        width: maxWidth,
        height: maxHeight,
        fit: 'inside',
        withoutEnlargement: true,
      });
    }

    pipeline = this.applyFormat(pipeline, targetFormat, targetQuality);

    const result = await pipeline.toBuffer({ resolveWithObject: true });

    return {
      buffer: result.data,
      width: result.info.width,
      height: result.info.height,
      format: result.info.format,
      size: result.info.size,
    };
  }

  /**
   * Convert to WebP format
   */
  async convertToWebP(
    buffer: Buffer,
    quality?: number,
  ): Promise<ImageProcessingResult> {
    const targetQuality = quality || this.config?.webpQuality || 85;

    this.logger.debug(`Converting to WebP at quality ${targetQuality}`);

    const result = await sharp(buffer)
      .webp({ quality: targetQuality })
      .toBuffer({ resolveWithObject: true });

    return {
      buffer: result.data,
      width: result.info.width,
      height: result.info.height,
      format: 'webp',
      size: result.info.size,
    };
  }

  /**
   * Add watermark to image
   */
  async addWatermark(
    buffer: Buffer,
    watermarkBuffer?: Buffer,
    text?: string,
  ): Promise<ImageProcessingResult> {
    const watermarkConfig = this.config?.watermark;
    if (!watermarkConfig?.enabled) {
      // Return original if watermark disabled
      const metadata = await this.getMetadata(buffer);
      return {
        buffer,
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        size: buffer.length,
      };
    }

    this.logger.debug('Adding watermark to image');

    const image = sharp(buffer);
    const metadata = await image.metadata();
    const imageWidth = metadata.width || 800;
    const imageHeight = metadata.height || 600;

    let watermarkInput: Buffer;

    if (watermarkBuffer) {
      watermarkInput = watermarkBuffer;
    } else if (text || watermarkConfig.text) {
      // Create text watermark
      const watermarkText = text || watermarkConfig.text || 'PetChain';
      const fontSize = Math.max(12, Math.floor(imageWidth / 30));

      watermarkInput = Buffer.from(
        `<svg width="${imageWidth * 0.3}" height="${fontSize * 2}">
          <style>
            .watermark {
              fill: rgba(255, 255, 255, ${watermarkConfig.opacity});
              font-size: ${fontSize}px;
              font-family: Arial, sans-serif;
              font-weight: bold;
            }
          </style>
          <text x="50%" y="50%" class="watermark" text-anchor="middle" dominant-baseline="middle">
            ${watermarkText}
          </text>
        </svg>`,
      );
    } else {
      // Return original if no watermark source
      return {
        buffer,
        width: imageWidth,
        height: imageHeight,
        format: metadata.format || 'jpeg',
        size: buffer.length,
      };
    }

    // Calculate position
    const position = this.calculateWatermarkPosition(
      watermarkConfig.position,
      imageWidth,
      imageHeight,
    );

    const result = await image
      .composite([
        {
          input: watermarkInput,
          gravity: position.gravity,
        },
      ])
      .toBuffer({ resolveWithObject: true });

    return {
      buffer: result.data,
      width: result.info.width,
      height: result.info.height,
      format: result.info.format,
      size: result.info.size,
    };
  }

  /**
   * Strip EXIF and metadata from image
   */
  async stripMetadata(buffer: Buffer): Promise<ImageProcessingResult> {
    this.logger.debug('Stripping EXIF metadata from image');

    const metadata = await sharp(buffer).metadata();

    const result = await sharp(buffer)
      .rotate() // Auto-rotate based on EXIF orientation before stripping
      .withMetadata({ orientation: undefined }) // Remove all metadata
      .toBuffer({ resolveWithObject: true });

    return {
      buffer: result.data,
      width: result.info.width,
      height: result.info.height,
      format: metadata.format || 'jpeg',
      size: result.info.size,
    };
  }

  /**
   * Process image with all standard transformations
   */
  async processImage(
    buffer: Buffer,
    options: {
      stripMetadata?: boolean;
      compress?: boolean;
      generateThumbnail?: boolean;
      addWatermark?: boolean;
      convertToWebP?: boolean;
    } = {},
  ): Promise<{
    original: ImageProcessingResult;
    thumbnail?: ImageProcessingResult;
    compressed?: ImageProcessingResult;
    webp?: ImageProcessingResult;
    watermarked?: ImageProcessingResult;
  }> {
    const results: {
      original: ImageProcessingResult;
      thumbnail?: ImageProcessingResult;
      compressed?: ImageProcessingResult;
      webp?: ImageProcessingResult;
      watermarked?: ImageProcessingResult;
    } = {
      original: {
        buffer,
        width: 0,
        height: 0,
        format: 'unknown',
        size: buffer.length,
      },
    };

    // Get original metadata and strip if needed
    let processedBuffer = buffer;
    if (options.stripMetadata !== false) {
      const stripped = await this.stripMetadata(buffer);
      processedBuffer = stripped.buffer;
      results.original = stripped;
    } else {
      const metadata = await this.getMetadata(buffer);
      results.original = {
        buffer,
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        size: buffer.length,
      };
    }

    // Generate variants in parallel
    const tasks: Promise<void>[] = [];

    if (options.generateThumbnail !== false) {
      tasks.push(
        this.generateThumbnail(processedBuffer).then((result) => {
          results.thumbnail = result;
        }),
      );
    }

    if (options.compress !== false) {
      tasks.push(
        this.compress(processedBuffer).then((result) => {
          results.compressed = result;
        }),
      );
    }

    if (options.convertToWebP) {
      tasks.push(
        this.convertToWebP(processedBuffer).then((result) => {
          results.webp = result;
        }),
      );
    }

    if (options.addWatermark) {
      tasks.push(
        this.addWatermark(processedBuffer).then((result) => {
          results.watermarked = result;
        }),
      );
    }

    await Promise.all(tasks);

    return results;
  }

  /**
   * Apply format conversion to Sharp pipeline
   */
  private applyFormat(
    pipeline: sharp.Sharp,
    format?: 'jpeg' | 'png' | 'webp' | 'avif',
    quality?: number,
  ): sharp.Sharp {
    const q = quality || 80;

    switch (format) {
      case 'png':
        return pipeline.png({ quality: q });
      case 'webp':
        return pipeline.webp({ quality: q });
      case 'avif':
        return pipeline.avif({ quality: q });
      case 'jpeg':
      default:
        return pipeline.jpeg({ quality: q });
    }
  }

  /**
   * Calculate watermark position
   */
  private calculateWatermarkPosition(
    position: string,
    _imageWidth: number,
    _imageHeight: number,
  ): { gravity: sharp.Gravity } {
    const gravityMap: Record<string, sharp.Gravity> = {
      'top-left': 'northwest',
      'top-right': 'northeast',
      'bottom-left': 'southwest',
      'bottom-right': 'southeast',
      center: 'center',
    };

    return { gravity: gravityMap[position] || 'southeast' };
  }

  /**
   * Parse EXIF data from buffer
   */
  private parseExif(exifBuffer: Buffer): Record<string, unknown> {
    try {
      // Basic EXIF parsing - in production, use exif-reader
      return { raw: exifBuffer.toString('base64').substring(0, 100) + '...' };
    } catch {
      return {};
    }
  }
}
