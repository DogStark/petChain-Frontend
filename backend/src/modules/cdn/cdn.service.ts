import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as fs from 'fs';
import { CdnConfig } from '../../config/cdn.config';
import { FileType } from '../upload/entities/file-type.enum';

/**
 * Signed URL options
 */
export interface SignedUrlOptions {
  /** Storage key */
  key: string;
  /** Expiration in seconds (default from config) */
  expiresIn?: number;
  /** Custom content disposition */
  contentDisposition?: 'inline' | 'attachment';
  /** Custom filename for download */
  filename?: string;
}

/**
 * Signed URL result
 */
export interface SignedUrl {
  /** The signed URL */
  url: string;
  /** Expiration timestamp */
  expiresAt: Date;
  /** CDN provider used */
  provider: string;
}

/**
 * CDN Service
 *
 * Manages CDN integration, signed URL generation, and cache invalidation.
 *
 * Supports:
 * - AWS CloudFront
 * - Cloudflare
 * - Direct S3/GCS (no CDN)
 */
@Injectable()
export class CdnService {
  private readonly logger = new Logger(CdnService.name);
  private readonly config: CdnConfig;
  private cloudfrontPrivateKey: string | null = null;

  constructor(private readonly configService: ConfigService) {
    this.config = this.configService.get<CdnConfig>('cdn')!;
    this.loadPrivateKey();
  }

  /**
   * Load CloudFront private key
   */
  private loadPrivateKey(): void {
    if (this.config.provider !== 'cloudfront') return;

    const cfConfig = this.config.cloudfront;
    if (!cfConfig) return;

    if (cfConfig.privateKey) {
      this.cloudfrontPrivateKey = cfConfig.privateKey;
    } else if (cfConfig.privateKeyPath) {
      try {
        this.cloudfrontPrivateKey = fs.readFileSync(
          cfConfig.privateKeyPath,
          'utf8',
        );
      } catch (error) {
        this.logger.error('Failed to load CloudFront private key:', error);
      }
    }
  }

  /**
   * Generate a signed URL for a file
   */
  async generateSignedUrl(options: SignedUrlOptions): Promise<SignedUrl> {
    const expiresIn = options.expiresIn || this.config.signedUrlExpiration;
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    switch (this.config.provider) {
      case 'cloudfront':
        return this.generateCloudFrontSignedUrl(options, expiresAt);
      case 'cloudflare':
        return this.generateCloudflareSignedUrl(options, expiresAt);
      default:
        return this.generateDirectUrl(options, expiresAt);
    }
  }

  /**
   * Generate CloudFront signed URL
   */
  private generateCloudFrontSignedUrl(
    options: SignedUrlOptions,
    expiresAt: Date,
  ): SignedUrl {
    if (!this.config.cloudfront || !this.cloudfrontPrivateKey) {
      throw new Error('CloudFront configuration is incomplete');
    }

    const url = `${this.config.baseUrl}/${options.key}`;
    const expires = Math.floor(expiresAt.getTime() / 1000);

    // Create policy
    const policy = JSON.stringify({
      Statement: [
        {
          Resource: url,
          Condition: {
            DateLessThan: { 'AWS:EpochTime': expires },
          },
        },
      ],
    });

    // Sign with RSA-SHA1
    const signer = crypto.createSign('RSA-SHA1');
    signer.update(policy);
    const signature = signer.sign(this.cloudfrontPrivateKey, 'base64');

    // URL-safe base64 encoding
    const urlSafeSignature = signature
      .replace(/\+/g, '-')
      .replace(/=/g, '_')
      .replace(/\//g, '~');

    const urlSafePolicy = Buffer.from(policy)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/=/g, '_')
      .replace(/\//g, '~');

    const signedUrl = `${url}?Expires=${expires}&Policy=${urlSafePolicy}&Signature=${urlSafeSignature}&Key-Pair-Id=${this.config.cloudfront.keyPairId}`;

    return {
      url: signedUrl,
      expiresAt,
      provider: 'cloudfront',
    };
  }

  /**
   * Generate Cloudflare signed URL (using Cloudflare Workers/Token)
   */
  private generateCloudflareSignedUrl(
    options: SignedUrlOptions,
    expiresAt: Date,
  ): SignedUrl {
    if (!this.config.cloudflare) {
      throw new Error('Cloudflare configuration is incomplete');
    }

    const url = `${this.config.baseUrl}/${options.key}`;
    const expires = Math.floor(expiresAt.getTime() / 1000);

    // Create HMAC signature for Cloudflare
    const signaturePayload = `${options.key}${expires}`;
    const signature = crypto
      .createHmac('sha256', this.config.cloudflare.apiToken)
      .update(signaturePayload)
      .digest('hex');

    const signedUrl = `${url}?expires=${expires}&signature=${signature}`;

    return {
      url: signedUrl,
      expiresAt,
      provider: 'cloudflare',
    };
  }

  /**
   * Generate direct URL (no CDN, use storage signed URL)
   */
  private generateDirectUrl(
    options: SignedUrlOptions,
    expiresAt: Date,
  ): SignedUrl {
    // For direct URLs, we'll return a path that the storage service can sign
    const baseUrl = this.config.baseUrl || '/files';
    const url = `${baseUrl}/${options.key}`;

    return {
      url,
      expiresAt,
      provider: 'direct',
    };
  }

  /**
   * Get CDN URL for a file (public, no signature)
   */
  getPublicUrl(key: string): string {
    if (this.config.baseUrl) {
      return `${this.config.baseUrl}/${key}`;
    }
    return `/files/${key}`;
  }

  /**
   * Invalidate CDN cache for a file
   */
  async invalidateCache(keys: string[]): Promise<void> {
    if (keys.length === 0) return;

    this.logger.log(`Invalidating cache for ${keys.length} files`);

    switch (this.config.provider) {
      case 'cloudfront':
        await this.invalidateCloudFrontCache(keys);
        break;
      case 'cloudflare':
        await this.invalidateCloudflareCache(keys);
        break;
      default:
        this.logger.debug('No CDN configured, skipping cache invalidation');
    }
  }

  /**
   * Invalidate CloudFront cache
   */
  private async invalidateCloudFrontCache(keys: string[]): Promise<void> {
    // In production, use AWS SDK to create invalidation
    // For now, log the action
    this.logger.log(
      `CloudFront invalidation requested for: ${keys.join(', ')}`,
    );

    // TODO: Implement with AWS SDK
    // const client = new CloudFrontClient({ region: 'us-east-1' });
    // await client.send(new CreateInvalidationCommand({...}));
  }

  /**
   * Invalidate Cloudflare cache
   */
  private async invalidateCloudflareCache(keys: string[]): Promise<void> {
    if (!this.config.cloudflare) return;

    // Cloudflare API cache purge
    this.logger.log(`Cloudflare cache purge requested for: ${keys.join(', ')}`);

    // TODO: Implement with Cloudflare API
    // const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`, {...});
  }

  /**
   * Get cache TTL for file type
   */
  getCacheTtl(fileType: FileType): number {
    switch (fileType) {
      case FileType.IMAGE:
        return this.config.cacheTtl.images;
      case FileType.VIDEO:
        return this.config.cacheTtl.videos;
      case FileType.DOCUMENT:
        return this.config.cacheTtl.documents;
      default:
        return this.config.cacheTtl.default;
    }
  }

  /**
   * Get versioning configuration
   */
  getVersioningConfig(): CdnConfig['versioning'] {
    return this.config.versioning;
  }

  /**
   * Get lifecycle configuration
   */
  getLifecycleConfig(): CdnConfig['lifecycle'] {
    return this.config.lifecycle;
  }

  /**
   * Check if CDN is enabled
   */
  isEnabled(): boolean {
    return this.config.provider !== 'none' && !!this.config.baseUrl;
  }
}
