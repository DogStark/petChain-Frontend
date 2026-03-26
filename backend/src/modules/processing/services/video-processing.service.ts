import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import ffmpeg from 'fluent-ffmpeg';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { randomUUID } from 'crypto';
import { ProcessingConfig } from '../../../config/processing.config';

// Set FFmpeg path
try {
  const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
  ffmpeg.setFfmpegPath(ffmpegPath);
} catch {
  // FFmpeg path will use system default
}

/**
 * Video processing options
 */
export interface VideoProcessingOptions {
  width?: number;
  height?: number;
  duration?: number;
  format?: 'mp4' | 'webm';
  quality?: 'low' | 'medium' | 'high';
}

/**
 * Video processing result
 */
export interface VideoProcessingResult {
  buffer: Buffer;
  width: number;
  height: number;
  format: string;
  duration: number;
  size: number;
}

/**
 * Video metadata
 */
export interface VideoMetadata {
  width: number;
  height: number;
  duration: number;
  format: string;
  codec: string;
  bitrate: number;
  fps: number;
  hasAudio: boolean;
}

/**
 * Video Processing Service
 *
 * Uses FFmpeg for video processing.
 * Features:
 * - Thumbnail extraction
 * - Preview clip generation
 * - Video transcoding
 * - Metadata extraction
 */
@Injectable()
export class VideoProcessingService {
  private readonly logger = new Logger(VideoProcessingService.name);
  private readonly config: ProcessingConfig['video'];
  private readonly tempDir: string;

  constructor(private readonly configService: ConfigService) {
    this.config =
      this.configService.get<ProcessingConfig['video']>('processing.video')!;
    this.tempDir = path.join(os.tmpdir(), 'petchain-video');

    // Ensure temp directory exists
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Get video metadata
   */
  async getMetadata(buffer: Buffer): Promise<VideoMetadata> {
    const inputPath = await this.writeToTempFile(buffer, 'input');

    try {
      return await new Promise((resolve, reject) => {
        ffmpeg.ffprobe(inputPath, (err, metadata) => {
          if (err) {
            reject(err);
            return;
          }

          const videoStream = metadata.streams.find(
            (s) => s.codec_type === 'video',
          );
          const audioStream = metadata.streams.find(
            (s) => s.codec_type === 'audio',
          );

          resolve({
            width: videoStream?.width || 0,
            height: videoStream?.height || 0,
            duration: parseFloat(String(metadata.format.duration || '0')),
            format: metadata.format.format_name || 'unknown',
            codec: videoStream?.codec_name || 'unknown',
            bitrate: parseInt(String(metadata.format.bit_rate || '0'), 10),
            fps: this.parseFps(videoStream?.r_frame_rate),
            hasAudio: !!audioStream,
          });
        });
      });
    } finally {
      await this.cleanupTempFile(inputPath);
    }
  }

  /**
   * Extract thumbnail from video
   */
  async extractThumbnail(
    buffer: Buffer,
    position?: string,
    width?: number,
    height?: number,
  ): Promise<Buffer> {
    const inputPath = await this.writeToTempFile(buffer, 'input');
    const outputPath = path.join(this.tempDir, `thumb-${randomUUID()}.jpg`);

    try {
      const thumbPosition =
        position || this.config?.thumbnailPosition || '00:00:01';
      const thumbWidth = width || 320;
      const thumbHeight = height || 180;

      this.logger.debug(`Extracting thumbnail at ${thumbPosition}`);

      await new Promise<void>((resolve, reject) => {
        ffmpeg(inputPath)
          .screenshots({
            timestamps: [thumbPosition],
            filename: path.basename(outputPath),
            folder: path.dirname(outputPath),
            size: `${thumbWidth}x${thumbHeight}`,
          })
          .on('end', () => resolve())
          .on('error', (err) => reject(err));
      });

      const thumbnailBuffer = await fs.promises.readFile(outputPath);
      return thumbnailBuffer;
    } finally {
      await this.cleanupTempFile(inputPath);
      await this.cleanupTempFile(outputPath);
    }
  }

  /**
   * Generate preview clip
   */
  async generatePreview(
    buffer: Buffer,
    options?: VideoProcessingOptions,
  ): Promise<VideoProcessingResult> {
    const inputPath = await this.writeToTempFile(buffer, 'input');
    const outputPath = path.join(this.tempDir, `preview-${randomUUID()}.mp4`);

    try {
      const duration = options?.duration || this.config?.previewDuration || 10;
      const width = options?.width || this.config?.previewWidth || 480;
      const height = options?.height || this.config?.previewHeight || 270;

      this.logger.debug(
        `Generating ${duration}s preview at ${width}x${height}`,
      );

      await new Promise<void>((resolve, reject) => {
        ffmpeg(inputPath)
          .setDuration(duration)
          .videoFilters(
            `scale=${width}:${height}:force_original_aspect_ratio=decrease`,
          )
          .outputOptions([
            '-c:v libx264',
            '-preset fast',
            '-crf 28',
            '-an', // No audio
          ])
          .output(outputPath)
          .on('end', () => resolve())
          .on('error', (err) => reject(err))
          .run();
      });

      const previewBuffer = await fs.promises.readFile(outputPath);
      const metadata = await this.getMetadataFromFile(outputPath);

      return {
        buffer: previewBuffer,
        width: metadata.width,
        height: metadata.height,
        format: 'mp4',
        duration: metadata.duration,
        size: previewBuffer.length,
      };
    } finally {
      await this.cleanupTempFile(inputPath);
      await this.cleanupTempFile(outputPath);
    }
  }

  /**
   * Transcode video to standard format
   */
  async transcode(
    buffer: Buffer,
    options?: VideoProcessingOptions,
  ): Promise<VideoProcessingResult> {
    const inputPath = await this.writeToTempFile(buffer, 'input');
    const format = options?.format || 'mp4';
    const outputPath = path.join(
      this.tempDir,
      `transcode-${randomUUID()}.${format}`,
    );

    try {
      const width = options?.width || 1280;
      const height = options?.height || 720;
      const quality = options?.quality || 'medium';

      this.logger.debug(
        `Transcoding to ${format} at ${width}x${height} (${quality})`,
      );

      const crfValues = { low: 32, medium: 26, high: 20 };
      const crf = crfValues[quality];

      await new Promise<void>((resolve, reject) => {
        let command = ffmpeg(inputPath)
          .videoFilters(
            `scale=${width}:${height}:force_original_aspect_ratio=decrease`,
          )
          .outputOptions([
            '-c:v libx264',
            '-preset medium',
            `-crf ${crf}`,
            '-c:a aac',
            '-b:a 128k',
          ])
          .output(outputPath);

        if (format === 'webm') {
          command = ffmpeg(inputPath)
            .videoFilters(
              `scale=${width}:${height}:force_original_aspect_ratio=decrease`,
            )
            .outputOptions([
              '-c:v libvpx-vp9',
              `-crf ${crf}`,
              '-b:v 0',
              '-c:a libopus',
              '-b:a 128k',
            ])
            .output(outputPath);
        }

        command
          .on('end', () => resolve())
          .on('error', (err) => reject(err))
          .run();
      });

      const transcodedBuffer = await fs.promises.readFile(outputPath);
      const metadata = await this.getMetadataFromFile(outputPath);

      return {
        buffer: transcodedBuffer,
        width: metadata.width,
        height: metadata.height,
        format,
        duration: metadata.duration,
        size: transcodedBuffer.length,
      };
    } finally {
      await this.cleanupTempFile(inputPath);
      await this.cleanupTempFile(outputPath);
    }
  }

  /**
   * Strip metadata from video
   */
  async stripMetadata(buffer: Buffer): Promise<Buffer> {
    const inputPath = await this.writeToTempFile(buffer, 'input');
    const outputPath = path.join(this.tempDir, `stripped-${randomUUID()}.mp4`);

    try {
      this.logger.debug('Stripping metadata from video');

      await new Promise<void>((resolve, reject) => {
        ffmpeg(inputPath)
          .outputOptions([
            '-map_metadata -1', // Remove all metadata
            '-c copy', // Copy streams without re-encoding
          ])
          .output(outputPath)
          .on('end', () => resolve())
          .on('error', (err) => reject(err))
          .run();
      });

      return await fs.promises.readFile(outputPath);
    } finally {
      await this.cleanupTempFile(inputPath);
      await this.cleanupTempFile(outputPath);
    }
  }

  /**
   * Get metadata from file
   */
  private async getMetadataFromFile(filePath: string): Promise<VideoMetadata> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
          reject(err);
          return;
        }

        const videoStream = metadata.streams.find(
          (s) => s.codec_type === 'video',
        );
        const audioStream = metadata.streams.find(
          (s) => s.codec_type === 'audio',
        );

        resolve({
          width: videoStream?.width || 0,
          height: videoStream?.height || 0,
          duration: parseFloat(String(metadata.format.duration || '0')),
          format: metadata.format.format_name || 'unknown',
          codec: videoStream?.codec_name || 'unknown',
          bitrate: parseInt(String(metadata.format.bit_rate || '0'), 10),
          fps: this.parseFps(videoStream?.r_frame_rate),
          hasAudio: !!audioStream,
        });
      });
    });
  }

  /**
   * Parse FPS string (e.g., "30/1" or "29.97")
   */
  private parseFps(fpsString?: string): number {
    if (!fpsString) return 0;

    if (fpsString.includes('/')) {
      const [num, den] = fpsString.split('/').map(Number);
      return num / den;
    }

    return parseFloat(fpsString);
  }

  /**
   * Write buffer to temp file
   */
  private async writeToTempFile(
    buffer: Buffer,
    prefix: string,
  ): Promise<string> {
    const filePath = path.join(this.tempDir, `${prefix}-${randomUUID()}`);
    await fs.promises.writeFile(filePath, buffer);
    return filePath;
  }

  /**
   * Cleanup temp file
   */
  private async cleanupTempFile(filePath: string): Promise<void> {
    try {
      await fs.promises.unlink(filePath);
    } catch {
      // Ignore cleanup errors
    }
  }
}
