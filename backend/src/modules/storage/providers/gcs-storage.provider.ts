import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Storage, Bucket, File } from '@google-cloud/storage';
import { IStorageProvider } from '../interfaces/storage-provider.interface';
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
} from '../interfaces/storage-types.interface';
import { StorageConfig } from '../../../config/storage.config';
import { Readable } from 'stream';

@Injectable()
export class GCSStorageProvider implements IStorageProvider, OnModuleInit {
  readonly providerName = 'gcs';
  private storage: Storage;
  private bucket: Bucket;
  private bucketName: string;
  private readonly logger = new Logger(GCSStorageProvider.name);

  constructor(private readonly configService: ConfigService) {
    const config = this.configService.get<StorageConfig>('storage');
    if (!config) {
      throw new Error('Storage configuration not found');
    }

    this.bucketName = config.gcs.bucket;

    const storageConfig: ConstructorParameters<typeof Storage>[0] = {
      projectId: config.gcs.projectId,
    };

    // Use key file if provided
    if (config.gcs.keyFilePath) {
      storageConfig.keyFilename = config.gcs.keyFilePath;
    }

    this.storage = new Storage(storageConfig);
    this.bucket = this.storage.bucket(this.bucketName);
  }

  async onModuleInit(): Promise<void> {
    await this.initialize();
  }

  async initialize(): Promise<void> {
    this.logger.log(
      `Initializing GCS Storage Provider for bucket: ${this.bucketName}`,
    );
    const healthy = await this.healthCheck();
    if (!healthy) {
      this.logger.warn('GCS health check failed during initialization');
    }
  }

  async upload(options: UploadOptions): Promise<UploadResult> {
    const {
      key,
      body,
      contentType,
      metadata,
      contentDisposition,
      cacheControl,
    } = options;

    const file = this.bucket.file(key);

    // Prepare upload options
    const uploadOptions: Parameters<File['save']>[1] = {
      contentType,
      metadata: {
        metadata,
        contentDisposition,
        cacheControl: cacheControl || 'max-age=31536000',
      },
    };

    this.logger.debug(`Uploading file to GCS: ${key}`);

    // Convert stream to buffer if necessary
    let buffer: Buffer;
    if (Buffer.isBuffer(body)) {
      buffer = body;
    } else {
      const chunks: Buffer[] = [];
      const stream = body as Readable;
      for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk));
      }
      buffer = Buffer.concat(chunks);
    }

    await file.save(buffer, uploadOptions);

    // Get file metadata for response
    const [fileMetadata] = await file.getMetadata();

    return {
      key,
      url: this.getPublicUrl(key) || undefined,
      etag: fileMetadata.etag,
      versionId: fileMetadata.generation?.toString(),
      size: buffer.length,
    };
  }

  async download(options: DownloadOptions): Promise<DownloadResult> {
    const { key, versionId } = options;

    let file: File;
    if (versionId) {
      file = this.bucket.file(key, { generation: parseInt(versionId, 10) });
    } else {
      file = this.bucket.file(key);
    }

    this.logger.debug(`Downloading file from GCS: ${key}`);

    const [buffer] = await file.download();
    const [metadata] = await file.getMetadata();

    return {
      body: buffer,
      contentType: metadata.contentType || 'application/octet-stream',
      size: parseInt(metadata.size?.toString() || '0', 10),
      etag: metadata.etag,
      lastModified: metadata.updated ? new Date(metadata.updated) : undefined,
      metadata: metadata.metadata as Record<string, string>,
    };
  }

  async getSignedUrl(options: SignedUrlOptions): Promise<string> {
    const {
      key,
      expiresIn = 3600,
      operation,
      contentType,
      versionId,
      responseContentDisposition,
    } = options;

    let file: File;
    if (versionId) {
      file = this.bucket.file(key, { generation: parseInt(versionId, 10) });
    } else {
      file = this.bucket.file(key);
    }

    const signedUrlOptions: Parameters<File['getSignedUrl']>[0] = {
      version: 'v4',
      action: operation === 'get' ? 'read' : 'write',
      expires: Date.now() + expiresIn * 1000,
    };

    if (contentType && operation === 'put') {
      signedUrlOptions.contentType = contentType;
    }

    if (responseContentDisposition) {
      signedUrlOptions.responseDisposition = responseContentDisposition;
    }

    this.logger.debug(`Generating signed URL for: ${key} (${operation})`);
    const [url] = await file.getSignedUrl(signedUrlOptions);
    return url;
  }

  async delete(options: DeleteOptions): Promise<void> {
    const { key, versionId } = options;

    let file: File;
    if (versionId) {
      file = this.bucket.file(key, { generation: parseInt(versionId, 10) });
    } else {
      file = this.bucket.file(key);
    }

    this.logger.debug(`Deleting file from GCS: ${key}`);
    await file.delete();
  }

  async exists(key: string): Promise<boolean> {
    const file = this.bucket.file(key);
    const [exists] = await file.exists();
    return exists;
  }

  async getMetadata(key: string): Promise<FileMetadata> {
    const file = this.bucket.file(key);
    const [metadata] = await file.getMetadata();

    return {
      key,
      size: parseInt(metadata.size?.toString() || '0', 10),
      contentType: metadata.contentType || 'application/octet-stream',
      etag: metadata.etag,
      lastModified: metadata.updated ? new Date(metadata.updated) : new Date(),
      versionId: metadata.generation?.toString(),
      metadata: metadata.metadata as Record<string, string>,
    };
  }

  async copy(options: CopyOptions): Promise<FileMetadata> {
    const { sourceKey, destinationKey, sourceVersionId } = options;

    let sourceFile: File;
    if (sourceVersionId) {
      sourceFile = this.bucket.file(sourceKey, {
        generation: parseInt(sourceVersionId, 10),
      });
    } else {
      sourceFile = this.bucket.file(sourceKey);
    }

    const destinationFile = this.bucket.file(destinationKey);

    this.logger.debug(`Copying file in GCS: ${sourceKey} -> ${destinationKey}`);

    await sourceFile.copy(destinationFile);

    return this.getMetadata(destinationKey);
  }

  async list(options: ListOptions): Promise<ListResult> {
    const { prefix, maxKeys = 1000, continuationToken, delimiter } = options;

    const response = await this.bucket.getFiles({
      prefix,
      maxResults: maxKeys,
      pageToken: continuationToken,
      delimiter,
    });

    const files = response[0];
    const nextQuery = response[1] as { pageToken?: string } | null;
    const apiResponse = response[2] as { prefixes?: string[] } | undefined;

    const fileMetadatas: FileMetadata[] = await Promise.all(
      files.map(async (file) => {
        const [metadata] = await file.getMetadata();
        return {
          key: file.name,
          size: parseInt(metadata.size?.toString() || '0', 10),
          contentType: metadata.contentType || 'application/octet-stream',
          etag: metadata.etag,
          lastModified: metadata.updated
            ? new Date(metadata.updated)
            : new Date(),
          versionId: metadata.generation?.toString(),
        };
      }),
    );

    return {
      files: fileMetadatas,
      prefixes: (apiResponse as { prefixes?: string[] })?.prefixes,
      isTruncated: !!nextQuery?.pageToken,
      nextContinuationToken: nextQuery?.pageToken,
    };
  }

  getPublicUrl(key: string): string | null {
    return `https://storage.googleapis.com/${this.bucketName}/${key}`;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const [exists] = await this.bucket.exists();
      return exists;
    } catch (error) {
      this.logger.error('GCS health check failed:', error);
      return false;
    }
  }
}
