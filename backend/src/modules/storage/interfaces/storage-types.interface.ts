/**
 * Storage Types Interface
 * Common types used across storage providers
 */

/**
 * Options for uploading a file to storage
 */
export interface UploadOptions {
  /** The storage key (path) for the file */
  key: string;

  /** The file buffer or readable stream */
  body: Buffer | NodeJS.ReadableStream;

  /** MIME type of the file */
  contentType: string;

  /** Optional metadata to attach to the file */
  metadata?: Record<string, string>;

  /** Whether the file should be encrypted at rest */
  encrypt?: boolean;

  /** Content disposition (e.g., 'attachment; filename="file.pdf"') */
  contentDisposition?: string;

  /** Cache control header */
  cacheControl?: string;
}

/**
 * Result of a successful upload
 */
export interface UploadResult {
  /** The storage key where the file was stored */
  key: string;

  /** The full URL to access the file (if public) */
  url?: string;

  /** ETag of the uploaded file */
  etag?: string;

  /** Version ID (if versioning is enabled) */
  versionId?: string;

  /** Size of the uploaded file in bytes */
  size: number;
}

/**
 * Options for downloading a file from storage
 */
export interface DownloadOptions {
  /** The storage key of the file to download */
  key: string;

  /** Version ID to download (optional) */
  versionId?: string;

  /** Byte range to download (e.g., 'bytes=0-1000') */
  range?: string;
}

/**
 * Result of a download operation
 */
export interface DownloadResult {
  /** The file content as a buffer */
  body: Buffer;

  /** MIME type of the file */
  contentType: string;

  /** Size of the file in bytes */
  size: number;

  /** ETag of the file */
  etag?: string;

  /** Last modified date */
  lastModified?: Date;

  /** Custom metadata */
  metadata?: Record<string, string>;
}

/**
 * Options for generating a signed URL
 */
export interface SignedUrlOptions {
  /** The storage key of the file */
  key: string;

  /** Expiration time in seconds (default: 3600 = 1 hour) */
  expiresIn?: number;

  /** Type of signed URL */
  operation: 'get' | 'put';

  /** Content type (required for PUT operations) */
  contentType?: string;

  /** Version ID (optional) */
  versionId?: string;

  /** Response content disposition */
  responseContentDisposition?: string;
}

/**
 * Options for deleting a file
 */
export interface DeleteOptions {
  /** The storage key of the file to delete */
  key: string;

  /** Version ID to delete (optional, for versioned buckets) */
  versionId?: string;
}

/**
 * Options for copying a file
 */
export interface CopyOptions {
  /** Source storage key */
  sourceKey: string;

  /** Destination storage key */
  destinationKey: string;

  /** Source version ID (optional) */
  sourceVersionId?: string;

  /** New metadata for the copy (optional) */
  metadata?: Record<string, string>;
}

/**
 * File metadata from storage
 */
export interface FileMetadata {
  /** Storage key */
  key: string;

  /** File size in bytes */
  size: number;

  /** MIME type */
  contentType: string;

  /** ETag */
  etag?: string;

  /** Last modified date */
  lastModified: Date;

  /** Version ID (if versioning enabled) */
  versionId?: string;

  /** Custom metadata */
  metadata?: Record<string, string>;
}

/**
 * Options for listing files
 */
export interface ListOptions {
  /** Prefix to filter files (e.g., 'users/123/') */
  prefix?: string;

  /** Maximum number of files to return */
  maxKeys?: number;

  /** Continuation token for pagination */
  continuationToken?: string;

  /** Delimiter for hierarchical listing */
  delimiter?: string;
}

/**
 * Result of a list operation
 */
export interface ListResult {
  /** Files matching the criteria */
  files: FileMetadata[];

  /** Common prefixes (when delimiter is used) */
  prefixes?: string[];

  /** Whether there are more results */
  isTruncated: boolean;

  /** Token to get next page of results */
  nextContinuationToken?: string;
}
