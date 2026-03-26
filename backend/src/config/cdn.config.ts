import { registerAs } from '@nestjs/config';

export interface CdnConfig {
  /** CDN provider: 'cloudfront' | 'cloudflare' | 'none' */
  provider: 'cloudfront' | 'cloudflare' | 'none';

  /** CDN base URL for public assets */
  baseUrl?: string;

  /** CloudFront configuration */
  cloudfront?: {
    distributionId: string;
    keyPairId: string;
    privateKeyPath?: string;
    privateKey?: string;
  };

  /** Cloudflare configuration */
  cloudflare?: {
    accountId: string;
    apiToken: string;
    zoneId: string;
  };

  /** Default signed URL expiration in seconds */
  signedUrlExpiration: number;

  /** Cache TTL settings (in seconds) */
  cacheTtl: {
    images: number;
    videos: number;
    documents: number;
    default: number;
  };

  /** File versioning settings */
  versioning: {
    enabled: boolean;
    maxVersions: number;
    retainDays: number;
  };

  /** Lifecycle policies */
  lifecycle: {
    /** Days before moving to infrequent access */
    moveToIaAfterDays: number;
    /** Days before moving to archive */
    moveToArchiveAfterDays: number;
    /** Days before deletion (0 = never) */
    deleteAfterDays: number;
    /** Apply lifecycle to variants */
    applyToVariants: boolean;
  };
}

export const cdnConfig = registerAs(
  'cdn',
  (): CdnConfig => ({
    provider: (process.env.CDN_PROVIDER as CdnConfig['provider']) || 'none',
    baseUrl: process.env.CDN_BASE_URL,

    cloudfront: process.env.CLOUDFRONT_DISTRIBUTION_ID
      ? {
          distributionId: process.env.CLOUDFRONT_DISTRIBUTION_ID,
          keyPairId: process.env.CLOUDFRONT_KEY_PAIR_ID || '',
          privateKeyPath: process.env.CLOUDFRONT_PRIVATE_KEY_PATH,
          privateKey: process.env.CLOUDFRONT_PRIVATE_KEY,
        }
      : undefined,

    cloudflare: process.env.CLOUDFLARE_ACCOUNT_ID
      ? {
          accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
          apiToken: process.env.CLOUDFLARE_API_TOKEN || '',
          zoneId: process.env.CLOUDFLARE_ZONE_ID || '',
        }
      : undefined,

    signedUrlExpiration: parseInt(
      process.env.SIGNED_URL_EXPIRATION || '3600',
      10,
    ), // 1 hour default

    cacheTtl: {
      images: parseInt(process.env.CACHE_TTL_IMAGES || '604800', 10), // 7 days
      videos: parseInt(process.env.CACHE_TTL_VIDEOS || '86400', 10), // 1 day
      documents: parseInt(process.env.CACHE_TTL_DOCUMENTS || '3600', 10), // 1 hour
      default: parseInt(process.env.CACHE_TTL_DEFAULT || '86400', 10), // 1 day
    },

    versioning: {
      enabled: process.env.FILE_VERSIONING_ENABLED !== 'false',
      maxVersions: parseInt(process.env.FILE_MAX_VERSIONS || '10', 10),
      retainDays: parseInt(process.env.FILE_VERSION_RETAIN_DAYS || '30', 10),
    },

    lifecycle: {
      moveToIaAfterDays: parseInt(
        process.env.LIFECYCLE_MOVE_TO_IA_DAYS || '30',
        10,
      ),
      moveToArchiveAfterDays: parseInt(
        process.env.LIFECYCLE_ARCHIVE_DAYS || '90',
        10,
      ),
      deleteAfterDays: parseInt(process.env.LIFECYCLE_DELETE_DAYS || '0', 10),
      applyToVariants: process.env.LIFECYCLE_APPLY_TO_VARIANTS !== 'false',
    },
  }),
);
