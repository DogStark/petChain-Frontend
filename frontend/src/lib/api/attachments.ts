import { apiClient } from './client';

export interface Attachment {
  id: string;
  name: string;
  size: number;
  type: string;
  url?: string;
  previewUrl?: string;
  status: 'pending' | 'uploading' | 'complete' | 'error' | 'cancelled';
  progress: number;
  error?: string;
}

export interface UploadOptions {
  onProgress?: (progress: number) => void;
  signal?: AbortSignal;
}

interface UploadAttempt {
  controller: AbortController;
  previewUrl?: string;
  progress: number;
  status: Attachment['status'];
}

const attempts = new Map<string, UploadAttempt>();

function revokePreview(url?: string): void {
  if (url && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
    URL.revokeObjectURL(url);
  }
}

function cleanupAttempt(id: string): void {
  const attempt = attempts.get(id);
  if (!attempt) {
    return;
  }
  attempt.controller.abort();
  revokePreview(attempt.previewUrl);
  attempts.delete(id);
}

/**
 * Register a preview object URL for an attachment so it can be revoked on
 * cancel, retry, or unmount.
 */
export function registerPreview(id: string, previewUrl: string): void {
  const attempt = attempts.get(id);
  if (attempt) {
    revokePreview(attempt.previewUrl);
    attempt.previewUrl = previewUrl;
  } else {
    attempts.set(id, {
      controller: new AbortController(),
      previewUrl,
      progress: 0,
      status: 'pending',
    });
  }
}

/**
 * Cancel an in-flight upload: abort the network request, stop progress
 * updates, revoke the preview URL, and reset state for the attachment id.
 */
export function cancelUpload(id: string): void {
  cleanupAttempt(id);
}

/**
 * Reset an attachment so a retry starts from a clean upload attempt.
 */
export function resetUpload(id: string): void {
  cleanupAttempt(id);
}

/**
 * Clean up all tracked uploads, e.g. on component unmount.
 */
export function cleanupUploads(): void {
  for (const id of Array.from(attempts.keys())) {
    cleanupAttempt(id);
  }
}

export async function uploadAttachment(
  file: File,
  options: UploadOptions = {},
): Promise<Attachment> {
  const id = `${file.name}-${file.size}-${file.lastModified}`;

  // Retrying must create a clean attempt keyed by attachment id.
  cleanupAttempt(id);

  const controller = new AbortController();
  const attempt: UploadAttempt = {
    controller,
    progress: 0,
    status: 'uploading',
  };
  attempts.set(id, attempt);

  if (options.signal) {
    if (options.signal.aborted) {
      controller.abort();
    } else {
      options.signal.addEventListener('abort', () => controller.abort(), {
        once: true,
      });
    }
  }

  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await apiClient.post<Attachment>('/attachments', formData, {
      signal: controller.signal,
      onUploadProgress: (event) => {
        if (controller.signal.aborted) {
          return;
        }
        const total = event.total ?? file.size;
        const progress = total > 0 ? Math.round((event.loaded / total) * 100) : 0;
        attempt.progress = progress;
        options.onProgress?.(progress);
      },
    });

    if (controller.signal.aborted) {
      throw new DOMException('Upload cancelled', 'AbortError');
    }

    attempt.status = 'complete';
    attempt.progress = 100;
    return { ...response.data, status: 'complete', progress: 100 };
  } catch (error) {
    if (controller.signal.aborted) {
      attempt.status = 'cancelled';
      throw new DOMException('Upload cancelled', 'AbortError');
    }
    attempt.status = 'error';
    throw error;
  } finally {
    // Keep the attempt entry only while it may still hold a preview URL that
    // needs revoking; otherwise drop it to avoid leaking state.
    const current = attempts.get(id);
    if (current && current.controller === controller && !current.previewUrl) {
      attempts.delete(id);
    }
  }
}
