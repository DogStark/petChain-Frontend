import { useCallback, useEffect, useRef, useState } from 'react';
import { uploadLabReport } from '@/lib/api/labResultsAPI';
import {
  AttachmentQueueManager,
  createIndexedDbAttachmentStore,
  type QueuedAttachment,
} from '@/lib/offline/attachmentQueue';
import { useAnnouncement } from '@/hooks/useAnnouncement';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

const attachmentQueue = new AttachmentQueueManager(
  createIndexedDbAttachmentStore(),
  async (record, onProgress) => {
    const file = new File([record.blob], record.name, { type: record.mimeType });
    await uploadLabReport(record.petId, file, undefined, { onProgress });
  },
);

export interface AttachmentQueueState {
  attachments: QueuedAttachment[];
  isOnline: boolean;
  isProcessing: boolean;
  error: string | null;
  clearError: () => void;
  addFiles: (files: FileList | File[]) => Promise<void>;
  removeAttachment: (id: number) => Promise<void>;
  retryAttachment: (id: number) => Promise<void>;
}

/**
 * Queue lab-report attachments locally and upload them when the browser is
 * online. Files are deleted from storage as soon as their upload succeeds.
 */
export function useAttachmentQueue(petId: string | undefined): AttachmentQueueState {
  const isOnline = useOnlineStatus();
  const { announce } = useAnnouncement();
  const [attachments, setAttachments] = useState<QueuedAttachment[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!petId) {
      if (isMountedRef.current) setAttachments([]);
      return;
    }
    try {
      const items = await attachmentQueue.list(petId);
      if (isMountedRef.current) {
        setAttachments(items);
        setError(null);
      }
    } catch {
      if (isMountedRef.current) {
        setError('Unable to read the offline attachment queue in this browser.');
      }
    }
  }, [petId]);

  const processQueue = useCallback(async () => {
    if (!petId || !isOnline) return;
    setIsProcessing(true);
    try {
      const result = await attachmentQueue.process(petId, (items) => {
        if (isMountedRef.current) setAttachments(items);
      });
      if (isMountedRef.current) {
        await refresh();
        if (result.uploaded > 0) {
          announce(
            `${result.uploaded} attachment${result.uploaded === 1 ? '' : 's'} uploaded.`,
            'success',
          );
        }
        if (result.failed > 0) {
          announce(
            `${result.failed} attachment${result.failed === 1 ? '' : 's'} failed to upload. Retry when you are ready.`,
            'error',
          );
        }
      }
    } catch {
      if (isMountedRef.current) {
        setError('Unable to upload queued attachments. Check your connection and try again.');
      }
    } finally {
      if (isMountedRef.current) setIsProcessing(false);
    }
  }, [announce, isOnline, petId, refresh]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!isOnline) return;
    void processQueue();
  }, [isOnline, processQueue]);

  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      if (!petId) {
        setError('Open a pet profile to queue attachments.');
        return;
      }

      const fileArray = Array.from(files);
      if (fileArray.length === 0) return;

      let added = 0;
      let firstError: string | null = null;
      for (const file of fileArray) {
        try {
          await attachmentQueue.enqueue(file, petId);
          added += 1;
        } catch (err) {
          if (!firstError) {
            firstError =
              err instanceof Error ? err.message : 'This attachment cannot be queued.';
          }
        }
      }

      await refresh();
      setError(firstError);
      if (added > 0) {
        announce(
          `${added} attachment${added === 1 ? '' : 's'} queued${isOnline ? '.' : ' for upload when you reconnect.'}`,
          'success',
        );
        if (isOnline) void processQueue();
      }
    },
    [announce, isOnline, petId, processQueue, refresh],
  );

  const removeAttachment = useCallback(
    async (id: number) => {
      try {
        await attachmentQueue.remove(id, petId);
        await refresh();
        announce('Attachment removed from the upload queue.', 'success');
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Unable to remove this attachment right now.',
        );
      }
    },
    [announce, petId, refresh],
  );

  const retryAttachment = useCallback(
    async (id: number) => {
      try {
        await attachmentQueue.retry(id, petId);
        await refresh();
        if (isOnline) void processQueue();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Unable to retry this attachment right now.',
        );
      }
    },
    [isOnline, petId, processQueue, refresh],
  );

  return {
    attachments,
    isOnline,
    isProcessing,
    error,
    clearError: () => setError(null),
    addFiles,
    removeAttachment,
    retryAttachment,
  };
}
