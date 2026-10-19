import React, { useCallback, useEffect, useRef, useState } from 'react';
import { uploadAttachment, cancelAttachmentUpload } from '../api/attachments';

export interface AttachmentUploadProps {
  onUploaded?: (attachmentId: string) => void;
  onError?: (attachmentId: string, error: unknown) => void;
  multiple?: boolean;
}

interface UploadEntry {
  id: string;
  file: File;
  previewUrl: string | null;
  progress: number;
  status: 'uploading' | 'done' | 'error' | 'cancelled';
  controller: AbortController;
}

const createId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `att-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const isPreviewable = (file: File): boolean =>
  file.type.startsWith('image/') || file.type.startsWith('video/');

export const AttachmentUpload: React.FC<AttachmentUploadProps> = ({
  onUploaded,
  onError,
  multiple = true,
}) => {
  const [uploads, setUploads] = useState<UploadEntry[]>([]);
  const uploadsRef = useRef<UploadEntry[]>([]);

  // Keep a ref in sync so unmount cleanup can revoke every live preview URL.
  useEffect(() => {
    uploadsRef.current = uploads;
  }, [uploads]);

  const revokePreview = useCallback((entry: UploadEntry) => {
    if (entry.previewUrl) {
      URL.revokeObjectURL(entry.previewUrl);
    }
  }, []);

  // Centralized cleanup: abort network work, revoke previews, drop state by id.
  const cleanupEntry = useCallback(
    (id: string, status: UploadEntry['status']) => {
      setUploads((prev) => {
        const entry = prev.find((u) => u.id === id);
        if (entry) {
          entry.controller.abort();
          revokePreview(entry);
        }
        return prev.map((u) =>
          u.id === id
            ? { ...u, status, previewUrl: null, progress: status === 'done' ? 100 : u.progress }
            : u,
        );
      });
    },
    [revokePreview],
  );

  const startUpload = useCallback(
    (entry: UploadEntry) => {
      uploadAttachment(entry.file, {
        signal: entry.controller.signal,
        onProgress: (progress) => {
          setUploads((prev) =>
            prev.map((u) =>
              u.id === entry.id && u.status === 'uploading' ? { ...u, progress } : u,
            ),
          );
        },
      })
        .then(() => {
          setUploads((prev) => {
            const current = prev.find((u) => u.id === entry.id);
            // Ignore late resolution after a cancel.
            if (!current || current.status !== 'uploading') return prev;
            revokePreview(current);
            return prev.map((u) =>
              u.id === entry.id
                ? { ...u, status: 'done', progress: 100, previewUrl: null }
                : u,
            );
          });
          onUploaded?.(entry.id);
        })
        .catch((error) => {
          if (entry.controller.signal.aborted) return;
          setUploads((prev) =>
            prev.map((u) => (u.id === entry.id ? { ...u, status: 'error' } : u)),
          );
          onError?.(entry.id, error);
        });
    },
    [onUploaded, onError, revokePreview],
  );

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const selected = multiple ? Array.from(files) : [files[0]];
      const entries: UploadEntry[] = selected.map((file) => ({
        id: createId(),
        file,
        previewUrl: isPreviewable(file) ? URL.createObjectURL(file) : null,
        progress: 0,
        status: 'uploading',
        controller: new AbortController(),
      }));
      setUploads((prev) => [...prev, ...entries]);
      entries.forEach(startUpload);
    },
    [multiple, startUpload],
  );

  const handleCancel = useCallback(
    (id: string) => {
      cleanupEntry(id, 'cancelled');
    },
    [cleanupEntry],
  );

  const handleRetry = useCallback(
    (id: string) => {
      setUploads((prev) => {
        const entry = prev.find((u) => u.id === id);
        if (!entry) return prev;
        // Fresh attempt: new controller, reset progress, re-create preview URL.
        const fresh: UploadEntry = {
          ...entry,
          controller: new AbortController(),
          progress: 0,
          status: 'uploading',
          previewUrl: isPreviewable(entry.file) ? URL.createObjectURL(entry.file) : null,
        };
        startUpload(fresh);
        return prev.map((u) => (u.id === id ? fresh : u));
      });
    },
    [startUpload],
  );

  const handleRemove = useCallback(
    (id: string) => {
      cleanupEntry(id, 'cancelled');
      setUploads((prev) => prev.filter((u) => u.id !== id));
    },
    [cleanupEntry],
  );

  // Abort in-flight uploads and revoke previews when the component unmounts.
  useEffect(() => {
    return () => {
      uploadsRef.current.forEach((entry) => {
        entry.controller.abort();
        revokePreview(entry);
      });
    };
  }, [revokePreview]);

  return (
    <div className="attachment-upload">
      <input
        type="file"
        multiple={multiple}
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <ul className="attachment-upload__list">
        {uploads.map((entry) => (
          <li key={entry.id} className={`attachment-upload__item is-${entry.status}`}>
            {entry.previewUrl && (
              <img src={entry.previewUrl} alt={entry.file.name} className="attachment-upload__preview" />
            )}
            <span className="attachment-upload__name">{entry.file.name}</span>
            {entry.status === 'uploading' && (
              <progress value={entry.progress} max={100} />
            )}
            {entry.status === 'uploading' && (
              <button type="button" onClick={() => handleCancel(entry.id)}>
                Cancel
              </button>
            )}
            {(entry.status === 'error' || entry.status === 'cancelled') && (
              <button type="button" onClick={() => handleRetry(entry.id)}>
                Retry
              </button>
            )}
            <button type="button" onClick={() => handleRemove(entry.id)}>
              Remove
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default AttachmentUpload;
