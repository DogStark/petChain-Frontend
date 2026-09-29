import { useCallback, useEffect, useRef, useState } from 'react';

export interface AttachmentUploadState {
  id: string;
  file: File;
  previewUrl: string;
  progress: number;
  status: 'idle' | 'uploading' | 'success' | 'error' | 'cancelled';
  error?: string;
}

export interface UseAttachmentUploadOptions {
  upload: (
    file: File,
    onProgress: (progress: number) => void,
    signal: AbortSignal,
  ) => Promise<unknown>;
}

export interface UseAttachmentUploadResult {
  attachments: AttachmentUploadState[];
  addFiles: (files: File[]) => void;
  cancel: (id: string) => void;
  retry: (id: string) => void;
  remove: (id: string) => void;
  reset: (id: string) => void;
}

interface UploadAttempt {
  controller: AbortController;
  cancelled: boolean;
}

const createId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `attachment-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function useAttachmentUpload({
  upload,
}: UseAttachmentUploadOptions): UseAttachmentUploadResult {
  const [attachments, setAttachments] = useState<AttachmentUploadState[]>([]);
  const attemptsRef = useRef<Map<string, UploadAttempt>>(new Map());
  const filesRef = useRef<Map<string, File>>(new Map());
  const previewUrlsRef = useRef<Map<string, string>>(new Map());

  const revokePreview = useCallback((id: string) => {
    const url = previewUrlsRef.current.get(id);
    if (url) {
      URL.revokeObjectURL(url);
      previewUrlsRef.current.delete(id);
    }
  }, []);

  const abortAttempt = useCallback((id: string) => {
    const attempt = attemptsRef.current.get(id);
    if (attempt) {
      attempt.cancelled = true;
      attempt.controller.abort();
      attemptsRef.current.delete(id);
    }
  }, []);

  const startUpload = useCallback(
    (id: string, file: File) => {
      abortAttempt(id);

      const controller = new AbortController();
      const attempt: UploadAttempt = { controller, cancelled: false };
      attemptsRef.current.set(id, attempt);

      setAttachments((prev) =>
        prev.map((attachment) =>
          attachment.id === id
            ? { ...attachment, progress: 0, status: 'uploading', error: undefined }
            : attachment,
        ),
      );

      upload(
        file,
        (progress) => {
          if (attempt.cancelled) return;
          setAttachments((prev) =>
            prev.map((attachment) =>
              attachment.id === id ? { ...attachment, progress } : attachment,
            ),
          );
        },
        controller.signal,
      )
        .then(() => {
          if (attempt.cancelled) return;
          attemptsRef.current.delete(id);
          setAttachments((prev) =>
            prev.map((attachment) =>
              attachment.id === id
                ? { ...attachment, progress: 100, status: 'success' }
                : attachment,
            ),
          );
        })
        .catch((error: unknown) => {
          if (attempt.cancelled || controller.signal.aborted) return;
          attemptsRef.current.delete(id);
          setAttachments((prev) =>
            prev.map((attachment) =>
              attachment.id === id
                ? {
                    ...attachment,
                    status: 'error',
                    error: error instanceof Error ? error.message : 'Upload failed',
                  }
                : attachment,
            ),
          );
        });
    },
    [abortAttempt, upload],
  );

  const addFiles = useCallback(
    (files: File[]) => {
      const next: AttachmentUploadState[] = files.map((file) => {
        const id = createId();
        const previewUrl = URL.createObjectURL(file);
        previewUrlsRef.current.set(id, previewUrl);
        filesRef.current.set(id, file);
        return {
          id,
          file,
          previewUrl,
          progress: 0,
          status: 'idle',
        };
      });

      setAttachments((prev) => [...prev, ...next]);
      next.forEach((attachment) => startUpload(attachment.id, attachment.file));
    },
    [startUpload],
  );

  const cancel = useCallback(
    (id: string) => {
      abortAttempt(id);
      revokePreview(id);
      setAttachments((prev) =>
        prev.map((attachment) =>
          attachment.id === id
            ? { ...attachment, status: 'cancelled', progress: 0 }
            : attachment,
        ),
      );
    },
    [abortAttempt, revokePreview],
  );

  const retry = useCallback(
    (id: string) => {
      const file = filesRef.current.get(id);
      if (!file) return;

      abortAttempt(id);
      revokePreview(id);

      const previewUrl = URL.createObjectURL(file);
      previewUrlsRef.current.set(id, previewUrl);

      setAttachments((prev) =>
        prev.map((attachment) =>
          attachment.id === id
            ? {
                ...attachment,
                previewUrl,
                progress: 0,
                status: 'idle',
                error: undefined,
              }
            : attachment,
        ),
      );

      startUpload(id, file);
    },
    [abortAttempt, revokePreview, startUpload],
  );

  const reset = useCallback(
    (id: string) => {
      abortAttempt(id);
      revokePreview(id);
      filesRef.current.delete(id);
      setAttachments((prev) => prev.filter((attachment) => attachment.id !== id));
    },
    [abortAttempt, revokePreview],
  );

  const remove = reset;

  useEffect(() => {
    const attempts = attemptsRef.current;
    const previewUrls = previewUrlsRef.current;
    const files = filesRef.current;
    return () => {
      attempts.forEach((attempt) => {
        attempt.cancelled = true;
        attempt.controller.abort();
      });
      attempts.clear();
      previewUrls.forEach((url) => URL.revokeObjectURL(url));
      previewUrls.clear();
      files.clear();
    };
  }, []);

  return { attachments, addFiles, cancel, retry, remove, reset };
}
