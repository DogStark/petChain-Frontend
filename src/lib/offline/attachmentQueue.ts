/**
 * Offline attachment upload queue (#1143)
 *
 * Queued lab-report PDFs are kept in IndexedDB so they survive page reloads
 * while the browser is offline. Each record holds the local file only until it
 * is uploaded successfully (the record, including its blob, is then deleted) or
 * the user removes it from the queue.
 *
 * Progress is tracked in memory while an upload runs; status, retry count and
 * the last error are persisted so a reload does not lose the retry state.
 */

import { validateAttachment } from '@/utils/attachmentValidation';

export type AttachmentUploadStatus = 'queued' | 'uploading' | 'failed';

/** Full queue record, including the local file. Never sent to the UI. */
export interface QueuedAttachmentRecord {
  id: number;
  petId: string;
  name: string;
  size: number;
  mimeType: string;
  blob: Blob;
  status: AttachmentUploadStatus;
  /** Upload progress, 0–100. */
  progress: number;
  attempts: number;
  maxAttempts: number;
  lastError?: string;
  createdAt: number;
  updatedAt: number;
}

/** Metadata safe to render — deliberately excludes the local file blob. */
export interface QueuedAttachment {
  id: number;
  petId: string;
  name: string;
  size: number;
  mimeType: string;
  status: AttachmentUploadStatus;
  progress: number;
  attempts: number;
  maxAttempts: number;
  lastError?: string;
  createdAt: number;
  updatedAt: number;
  /** True when a failed upload may be retried without discarding the file. */
  canRetry: boolean;
}

export interface AttachmentQueueStore {
  add(record: Omit<QueuedAttachmentRecord, 'id'>): Promise<number>;
  getAll(): Promise<QueuedAttachmentRecord[]>;
  get(id: number): Promise<QueuedAttachmentRecord | null>;
  put(record: QueuedAttachmentRecord): Promise<void>;
  delete(id: number): Promise<void>;
}

export type AttachmentUploader = (
  record: QueuedAttachmentRecord,
  onProgress: (percent: number) => void,
) => Promise<void>;

export interface AttachmentQueueOptions {
  maxAttempts?: number;
  /** Defaults to the browser's online state; overridable in tests. */
  isOnline?: () => boolean;
  now?: () => number;
}

export const DEFAULT_ATTACHMENT_MAX_ATTEMPTS = 3;

/** Persist progress at most every 10 percentage points. */
const PROGRESS_PERSIST_STEP = 10;

function toMetadata(record: QueuedAttachmentRecord): QueuedAttachment {
  return {
    id: record.id,
    petId: record.petId,
    name: record.name,
    size: record.size,
    mimeType: record.mimeType,
    status: record.status,
    progress: record.progress,
    attempts: record.attempts,
    maxAttempts: record.maxAttempts,
    ...(record.lastError ? { lastError: record.lastError } : {}),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    // Manual retries reset the attempt budget, so any failed record can retry.
    canRetry: record.status === 'failed',
  };
}

function describeError(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const message = (error as { response?: { data?: { message?: unknown } } }).response?.data
      ?.message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  if (error instanceof Error && error.message) return error.message;
  return 'The upload failed. Check your connection and try again.';
}

export class AttachmentQueueManager {
  private readonly store: AttachmentQueueStore;
  private readonly uploader: AttachmentUploader;
  private readonly maxAttempts: number;
  private readonly isOnline: () => boolean;
  private readonly now: () => number;
  private isProcessing = false;

  constructor(
    store: AttachmentQueueStore,
    uploader: AttachmentUploader,
    options: AttachmentQueueOptions = {},
  ) {
    this.store = store;
    this.uploader = uploader;
    this.maxAttempts = options.maxAttempts ?? DEFAULT_ATTACHMENT_MAX_ATTEMPTS;
    this.isOnline =
      options.isOnline ?? (() => typeof navigator === 'undefined' || navigator.onLine);
    this.now = options.now ?? (() => Date.now());
  }

  /** Metadata for the queue, optionally limited to one pet. */
  async list(petId?: string): Promise<QueuedAttachment[]> {
    const records = await this.store.getAll();
    return records
      .filter((record) => petId === undefined || record.petId === petId)
      .sort((a, b) => a.createdAt - b.createdAt)
      .map(toMetadata);
  }

  /**
   * Validate and persist a file locally. Validation mirrors the lab-report
   * upload rules (PDF only, size limit, safe filename) before anything is
   * written to storage.
   */
  async enqueue(file: File, petId: string): Promise<QueuedAttachment> {
    const validation = validateAttachment(file);
    if (!validation.valid) {
      throw new Error(validation.error ?? 'This attachment cannot be queued.');
    }

    const timestamp = this.now();
    const record: Omit<QueuedAttachmentRecord, 'id'> = {
      petId,
      name: file.name,
      size: file.size,
      mimeType: file.type,
      blob: file.slice(0, file.size, file.type),
      status: 'queued',
      progress: 0,
      attempts: 0,
      maxAttempts: this.maxAttempts,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const id = await this.store.add(record);
    return toMetadata({ ...record, id });
  }

  /**
   * Remove an attachment from the queue before it is uploaded. Active uploads
   * cannot be removed because their bytes are already in flight.
   */
  async remove(id: number, petId?: string): Promise<void> {
    const record = await this.store.get(id);
    if (!record || (petId !== undefined && record.petId !== petId)) {
      throw new Error('This attachment is no longer in the queue.');
    }
    if (record.status === 'uploading') {
      throw new Error('Wait for the current upload to finish before removing this attachment.');
    }
    // Deleting the record also drops the local blob.
    await this.store.delete(id);
  }

  /** Reset a failed attachment so the next process run retries it. */
  async retry(id: number, petId?: string): Promise<void> {
    const record = await this.store.get(id);
    if (!record || (petId !== undefined && record.petId !== petId)) {
      throw new Error('This attachment is no longer in the queue.');
    }
    if (record.status === 'uploading') return;

    await this.store.put({
      ...record,
      status: 'queued',
      progress: 0,
      attempts: 0,
      lastError: undefined,
      updatedAt: this.now(),
    });
  }

  /**
   * Upload queued attachments oldest-first, one at a time. Successful records
   * are deleted immediately so local files are retained only as long as
   * needed. Failures persist their retry state for the next attempt.
   */
  async process(
    petId?: string,
    onUpdate?: (items: QueuedAttachment[]) => void,
  ): Promise<{ uploaded: number; failed: number }> {
    const result = { uploaded: 0, failed: 0 };
    if (!this.isOnline() || this.isProcessing) return result;
    this.isProcessing = true;

    try {
      const records = (await this.store.getAll())
        .filter((record) => petId === undefined || record.petId === petId)
        .sort((a, b) => a.createdAt - b.createdAt);
      if (records.length === 0) return result;

      // Emit from the in-memory records so live progress is visible without a
      // re-read for every update.
      const deletedIds = new Set<number>();
      const emitFromMemory = () => {
        if (!onUpdate) return;
        onUpdate(
          records
            .filter((item) => !deletedIds.has(item.id))
            .map((item) => toMetadata(item)),
        );
      };

      for (const record of records) {
        // A record left in "uploading" by a reload is retried from scratch.
        if (record.status === 'uploading') {
          record.status = 'queued';
          record.progress = 0;
        }
        if (record.attempts >= record.maxAttempts) continue;

        record.status = 'uploading';
        record.progress = 0;
        record.updatedAt = this.now();
        await this.store.put(record);
        emitFromMemory();

        let lastReportedProgress = 0;
        try {
          await this.uploader(record, (percent) => {
            const bounded = Math.max(0, Math.min(100, Math.round(percent)));
            record.progress = bounded;
            if (bounded === 100 || bounded - lastReportedProgress >= PROGRESS_PERSIST_STEP) {
              lastReportedProgress = bounded;
              emitFromMemory();
            }
          });

          // Upload succeeded: drop the record and its local file.
          await this.store.delete(record.id);
          deletedIds.add(record.id);
          result.uploaded += 1;
        } catch (error) {
          record.status = 'failed';
          record.progress = 0;
          record.attempts += 1;
          record.lastError = describeError(error);
          record.updatedAt = this.now();
          await this.store.put(record);
          result.failed += 1;
        }

        emitFromMemory();
      }

      return result;
    } finally {
      this.isProcessing = false;
    }
  }
}

// ─── IndexedDB storage ───────────────────────────────────────────────────────

const DB_NAME = 'petchain-attachments';
const DB_VERSION = 1;
const STORE_NAME = 'attachments';

function openAttachmentDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('Offline attachment storage is not available in this browser.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('petId', 'petId', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
    request.onsuccess = (event) => resolve((event.target as IDBOpenDBRequest).result);
    request.onerror = () => reject((event.target as IDBOpenDBRequest).error);
  });
}

export function createIndexedDbAttachmentStore(): AttachmentQueueStore {
  return {
    async add(record) {
      const db = await openAttachmentDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const request = tx.objectStore(STORE_NAME).add(record);
        request.onsuccess = () => resolve(request.result as number);
        request.onerror = () => reject(request.error);
        tx.oncomplete = () => db.close();
        tx.onerror = () => {
          db.close();
          reject(tx.error);
        };
      });
    },

    async getAll() {
      const db = await openAttachmentDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const request = tx.objectStore(STORE_NAME).index('createdAt').getAll();
        request.onsuccess = () => resolve(request.result as QueuedAttachmentRecord[]);
        request.onerror = () => reject(request.error);
        tx.oncomplete = () => db.close();
      });
    },

    async get(id) {
      const db = await openAttachmentDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const request = tx.objectStore(STORE_NAME).get(id);
        request.onsuccess = () =>
          resolve((request.result as QueuedAttachmentRecord | undefined) ?? null);
        request.onerror = () => reject(request.error);
        tx.oncomplete = () => db.close();
      });
    },

    async put(record) {
      const db = await openAttachmentDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const request = tx.objectStore(STORE_NAME).put(record);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
        tx.oncomplete = () => db.close();
      });
    },

    async delete(id) {
      const db = await openAttachmentDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const request = tx.objectStore(STORE_NAME).delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
        tx.oncomplete = () => db.close();
      });
    },
  };
}
