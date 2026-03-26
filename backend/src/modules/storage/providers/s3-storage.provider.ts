import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  CopyObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
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
export class S3StorageProvider implements IStorageProvider, OnModuleInit {
  readonly providerName = 's3';
  private client: S3Client;
  private bucket: string;
  private region: string;
  private readonly logger = new Logger(S3StorageProvider.name);

  constructor(private readonly configService: ConfigService) {
    const config = this.configService.get<StorageConfig>('storage');
    if (!config) {
      throw new Error('Storage configuration not found');
    }

    this.bucket = config.s3.bucket;
    this.region = config.s3.region;

    const clientConfig: ConstructorParameters<typeof S3Client>[0] = {
      region: this.region,
      credentials: {
        accessKeyId: config.s3.accessKeyId,
        secretAccessKey: config.s3.secretAccessKey,
      },
    };

    // Support custom endpoint for S3-compatible services (MinIO, etc.)
    if (config.s3.endpoint) {
      clientConfig.endpoint = config.s3.endpoint;
      clientConfig.forcePathStyle = true;
    }

    this.client = new S3Client(clientConfig);
  }

  async onModuleInit(): Promise<void> {
    await this.initialize();
  }

  async initialize(): Promise<void> {
    this.logger.log(
      `Initializing S3 Storage Provider for bucket: ${this.bucket}`,
    );
    const healthy = await this.healthCheck();
    if (!healthy) {
      this.logger.warn('S3 health check failed during initialization');
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

    // Convert stream to buffer if necessary
    let uploadBody: Buffer;
    if (Buffer.isBuffer(body)) {
      uploadBody = body;
    } else {
      const chunks: Buffer[] = [];
      const stream = body as Readable;
      for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk));
      }
      uploadBody = Buffer.concat(chunks);
    }

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: uploadBody,
      ContentType: contentType,
      Metadata: metadata,
      ContentDisposition: contentDisposition,
      CacheControl: cacheControl || 'max-age=31536000', // 1 year default
    });

    this.logger.debug(`Uploading file to S3: ${key}`);
    const response = await this.client.send(command);

    return {
      key,
      url: this.getPublicUrl(key) || undefined,
      etag: response.ETag?.replace(/"/g, ''),
      versionId: response.VersionId,
      size: uploadBody.length,
    };
  }

  async download(options: DownloadOptions): Promise<DownloadResult> {
    const { key, versionId, range } = options;

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
      VersionId: versionId,
      Range: range,
    });

    this.logger.debug(`Downloading file from S3: ${key}`);
    const response = await this.client.send(command);

    // Convert stream to buffer
    const stream = response.Body as Readable;
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    const body = Buffer.concat(chunks);

    return {
      body,
      contentType: response.ContentType || 'application/octet-stream',
      size: response.ContentLength || body.length,
      etag: response.ETag?.replace(/"/g, ''),
      lastModified: response.LastModified,
      metadata: response.Metadata,
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

    let command;
    if (operation === 'get') {
      command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        VersionId: versionId,
        ResponseContentDisposition: responseContentDisposition,
      });
    } else {
      command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: contentType,
      });
    }

    this.logger.debug(`Generating signed URL for: ${key} (${operation})`);
    return getSignedUrl(this.client, command, { expiresIn });
  }

  async delete(options: DeleteOptions): Promise<void> {
    const { key, versionId } = options;

    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
      VersionId: versionId,
    });

    this.logger.debug(`Deleting file from S3: ${key}`);
    await this.client.send(command);
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
      return true;
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'NotFound') {
        return false;
      }
      throw error;
    }
  }

  async getMetadata(key: string): Promise<FileMetadata> {
    const command = new HeadObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    const response = await this.client.send(command);

    return {
      key,
      size: response.ContentLength || 0,
      contentType: response.ContentType || 'application/octet-stream',
      etag: response.ETag?.replace(/"/g, ''),
      lastModified: response.LastModified || new Date(),
      versionId: response.VersionId,
      metadata: response.Metadata,
    };
  }

  async copy(options: CopyOptions): Promise<FileMetadata> {
    const { sourceKey, destinationKey, sourceVersionId, metadata } = options;

    const command = new CopyObjectCommand({
      Bucket: this.bucket,
      CopySource: sourceVersionId
        ? `${this.bucket}/${sourceKey}?versionId=${sourceVersionId}`
        : `${this.bucket}/${sourceKey}`,
      Key: destinationKey,
      Metadata: metadata,
      MetadataDirective: metadata ? 'REPLACE' : 'COPY',
    });

    this.logger.debug(`Copying file in S3: ${sourceKey} -> ${destinationKey}`);
    await this.client.send(command);

    return this.getMetadata(destinationKey);
  }

  async list(options: ListOptions): Promise<ListResult> {
    const { prefix, maxKeys = 1000, continuationToken, delimiter } = options;

    const command = new ListObjectsV2Command({
      Bucket: this.bucket,
      Prefix: prefix,
      MaxKeys: maxKeys,
      ContinuationToken: continuationToken,
      Delimiter: delimiter,
    });

    const response = await this.client.send(command);

    const files: FileMetadata[] =
      response.Contents?.map((item) => ({
        key: item.Key || '',
        size: item.Size || 0,
        contentType: 'application/octet-stream', // S3 list doesn't return content type
        etag: item.ETag?.replace(/"/g, ''),
        lastModified: item.LastModified || new Date(),
      })) || [];

    return {
      files,
      prefixes: response.CommonPrefixes?.map((p) => p.Prefix || ''),
      isTruncated: response.IsTruncated || false,
      nextContinuationToken: response.NextContinuationToken,
    };
  }

  getPublicUrl(key: string): string | null {
    // Return null if bucket is private
    // Override this if you have a public bucket
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          MaxKeys: 1,
        }),
      );
      return true;
    } catch (error) {
      this.logger.error('S3 health check failed:', error);
      return false;
    }
  }
}
