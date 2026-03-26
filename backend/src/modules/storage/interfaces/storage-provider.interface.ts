import {
  UploadOptions,
  UploadResult,
  DownloadOptions,
  DownloadResult,
  SignedUrlOptions,
  DeleteOptions,
  CopyOptions,
  FileMetadata,
  ListOptions,
  ListResult,
} from './storage-types.interface';

/**
 * Abstract Storage Provider Interface
 *
 * This interface defines the contract for all storage providers (S3, GCS, etc.)
 * Implementations must be interchangeable without affecting business logic.
 */
export interface IStorageProvider {
  /**
   * Get the name of the storage provider
   */
  readonly providerName: string;

  /**
   * Upload a file to storage
   * @param options Upload options including key, body, and content type
   * @returns Upload result with key, URL, and metadata
   */
  upload(options: UploadOptions): Promise<UploadResult>;

  /**
   * Download a file from storage
   * @param options Download options including key and optional version
   * @returns Download result with file body and metadata
   */
  download(options: DownloadOptions): Promise<DownloadResult>;

  /**
   * Generate a signed URL for temporary access
   * @param options Signed URL options including key and expiration
   * @returns Signed URL string
   */
  getSignedUrl(options: SignedUrlOptions): Promise<string>;

  /**
   * Delete a file from storage
   * @param options Delete options including key and optional version
   */
  delete(options: DeleteOptions): Promise<void>;

  /**
   * Check if a file exists in storage
   * @param key Storage key to check
   * @returns True if file exists, false otherwise
   */
  exists(key: string): Promise<boolean>;

  /**
   * Get metadata for a file without downloading it
   * @param key Storage key
   * @returns File metadata
   */
  getMetadata(key: string): Promise<FileMetadata>;

  /**
   * Copy a file within storage
   * @param options Copy options including source and destination keys
   * @returns The new file's metadata
   */
  copy(options: CopyOptions): Promise<FileMetadata>;

  /**
   * List files in storage
   * @param options List options including prefix and pagination
   * @returns List result with files and pagination info
   */
  list(options: ListOptions): Promise<ListResult>;

  /**
   * Get the public URL for a file (if bucket is public)
   * @param key Storage key
   * @returns Public URL or null if not applicable
   */
  getPublicUrl(key: string): string | null;

  /**
   * Initialize the provider (called on module init)
   */
  initialize(): Promise<void>;

  /**
   * Health check for the storage provider
   * @returns True if provider is healthy
   */
  healthCheck(): Promise<boolean>;
}

/**
 * Storage provider injection token
 */
export const STORAGE_PROVIDER = Symbol('STORAGE_PROVIDER');
