import React, { useId, useRef } from 'react';
import { FileText, Paperclip, RefreshCw, Trash2, UploadCloud, WifiOff } from 'lucide-react';
import { useAttachmentQueue } from '@/hooks/useAttachmentQueue';
import type { QueuedAttachment } from '@/lib/offline/attachmentQueue';
import { ALLOWED_EXTENSIONS_LABEL, MAX_FILE_SIZE_BYTES } from '@/utils/attachmentValidation';
import styles from './AttachmentQueue.module.css';

const MAX_FILE_SIZE_MB = MAX_FILE_SIZE_BYTES / (1024 * 1024);

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function statusText(item: QueuedAttachment): string {
  if (item.status === 'uploading') return `Uploading… ${item.progress}%`;
  if (item.status === 'failed') {
    return item.attempts >= item.maxAttempts
      ? `Upload failed after ${item.attempts} attempt${item.attempts === 1 ? '' : 's'}.`
      : `Upload failed (attempt ${item.attempts} of ${item.maxAttempts}).`;
  }
  return 'Waiting to upload';
}

function progressText(item: QueuedAttachment): string {
  if (item.status === 'uploading') return `${item.progress}% uploaded`;
  if (item.status === 'failed') return 'Upload failed';
  return 'Upload not started';
}

interface AttachmentQueueViewProps {
  petId?: string;
}

/**
 * Offline attachment upload queue (#1143).
 *
 * Lists queued lab-report PDFs with their name, size, upload progress and retry
 * state. Attachments can be removed before their upload starts, and the local
 * file is dropped from IndexedDB as soon as the upload succeeds.
 */
export default function AttachmentQueueView({ petId }: AttachmentQueueViewProps) {
  const {
    attachments,
    isOnline,
    isProcessing,
    error,
    clearError,
    addFiles,
    removeAttachment,
    retryAttachment,
  } = useAttachmentQueue(petId);
  const inputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const helpId = useId();

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      void addFiles(event.target.files);
    }
    // Allow selecting the same file again after a validation error.
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <section className={styles.section} aria-labelledby={titleId}>
      <div className={styles.header}>
        <div>
          <h2 id={titleId} className={styles.title}>
            Lab report attachments{' '}
            <span className={styles.count}>({attachments.length})</span>
          </h2>
          <p id={helpId} className={styles.subtitle}>
            Add a PDF while offline and it will upload automatically when the connection
            returns. Files are removed from this device as soon as they upload.
          </p>
        </div>
        <span
          role="status"
          aria-live="polite"
          className={`${styles.statusPill} ${isOnline ? styles.statusOnline : styles.statusOffline}`}
        >
          {isOnline ? <UploadCloud size={14} aria-hidden="true" /> : <WifiOff size={14} aria-hidden="true" />}
          {isOnline ? (isProcessing ? 'Uploading…' : 'Online') : 'Offline'}
        </span>
      </div>

      <div className={styles.toolbar}>
        <input
          ref={inputRef}
          id={`${titleId}-file`}
          type="file"
          accept=".pdf,application/pdf"
          multiple
          className={styles.hiddenInput}
          onChange={handleInputChange}
          aria-label={`Select ${ALLOWED_EXTENSIONS_LABEL} attachments to queue`}
          aria-describedby={helpId}
          disabled={!petId}
        />
        <button
          type="button"
          className={styles.addButton}
          onClick={() => inputRef.current?.click()}
          disabled={!petId}
        >
          <Paperclip size={16} aria-hidden="true" />
          Add attachments
        </button>
        <span className={styles.limitNote}>
          {ALLOWED_EXTENSIONS_LABEL} only · up to {MAX_FILE_SIZE_MB} MB each
        </span>
      </div>

      {!petId && (
        <p role="status" className={styles.notice}>
          Open a pet profile to queue attachments.
        </p>
      )}

      {error && (
        <div className={styles.errorBanner} role="alert">
          <span>{error}</span>
          <button
            type="button"
            className={styles.dismissButton}
            onClick={clearError}
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      )}

      {attachments.length === 0 ? (
        <div className={styles.emptyState}>
          <FileText className={styles.emptyIcon} aria-hidden="true" />
          <p className={styles.emptyText}>Nothing queued</p>
          <p className={styles.emptySubtext}>
            Attachments you add without a connection appear here until they upload.
          </p>
        </div>
      ) : (
        <ul className={styles.list} aria-label="Queued attachments">
          {attachments.map((item) => {
            const isItemUploading = item.status === 'uploading';
            const canRemove = !isProcessing && !isItemUploading;
            return (
              <li key={item.id} className={styles.item}>
                <div className={styles.itemHeader}>
                  <FileText className={styles.itemIcon} aria-hidden="true" />
                  <div className={styles.itemDetails}>
                    <p className={styles.itemName} title={item.name}>
                      {item.name}
                    </p>
                    <p className={styles.itemMeta}>
                      {formatFileSize(item.size)} · {statusText(item)}
                    </p>
                  </div>
                  <div className={styles.itemActions}>
                    {item.status === 'failed' && (
                      <button
                        type="button"
                        className={styles.retryButton}
                        onClick={() => void retryAttachment(item.id)}
                        disabled={!isOnline || isProcessing}
                        aria-label={`Retry uploading ${item.name}`}
                      >
                        <RefreshCw size={14} aria-hidden="true" />
                        Retry
                      </button>
                    )}
                    <button
                      type="button"
                      className={styles.removeButton}
                      onClick={() => void removeAttachment(item.id)}
                      disabled={!canRemove}
                      aria-label={`Remove ${item.name} from the upload queue`}
                    >
                      <Trash2 size={14} aria-hidden="true" />
                      Remove
                    </button>
                  </div>
                </div>

                <div className={styles.progressRow}>
                  <div
                    className={styles.progressBar}
                    role="progressbar"
                    aria-label={`Upload progress for ${item.name}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={item.progress}
                    aria-valuetext={progressText(item)}
                  >
                    <div
                      className={`${styles.progressFill} ${item.status === 'failed' ? styles.progressFillFailed : ''}`}
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                  <span className={styles.progressText}>{item.progress}%</span>
                </div>

                {item.status === 'failed' && (
                  <p className={styles.retryState}>
                    {item.attempts >= item.maxAttempts
                      ? 'Automatic retries are exhausted. Use Retry to try again.'
                      : 'Use Retry to try again.'}
                    {item.lastError ? ` ${item.lastError}` : ''}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
