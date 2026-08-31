import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, X } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import styles from './PetPhotos.module.css';
import { verifyMetadataStripped } from './exifUtils';

const MAX_FILE_SIZE_MB = 10;
const COMPRESSION_MAX_SIZE_MB = 2;
const COMPRESSION_MAX_DIMENSION = 1920;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Upload phases shown to the user as meaningful progress feedback.
 * Each phase has an associated progress range so the combined indicator
 * covers the full 0-100% arc.
 */
export type UploadPhase = 'idle' | 'compressing' | 'verifying' | 'uploading' | 'done' | 'error';

export interface PhaseProgress {
  phase: UploadPhase;
  /** 0–100 value combining all phases. */
  percent: number;
  /** Human-readable label for the current phase. */
  label: string;
}

interface PhotoUploaderProps {
  currentCount: number;
  maxPhotos: number;
  /** Whether an upload is in flight (controlled by parent). */
  isUploading: boolean;
  /** Upload progress 0–100 reported by the parent after onUpload fires. */
  uploadProgress: number;
  /** Called with the files to upload once staging is complete. */
  onUpload: (files: File[], abortSignal: AbortSignal) => void;
  /** Optional: called when the user cancels an in-progress upload. */
  onCancelUpload?: () => void;
}

interface PreviewFile {
  file: File;
  previewUrl: string;
}

/**
 * Compress a single image file and strip all EXIF / XMP metadata.
 *
 * `browser-image-compression` re-encodes through <canvas> with `preserveExif: false`.
 * JPEG orientation is applied to pixel data before encoding so visual appearance is
 * preserved without the tag. Defence-in-depth verification follows compression.
 *
 * @throws {Error} When compression is aborted or metadata verification fails.
 */
async function compressAndStripMetadata(file: File, signal?: AbortSignal): Promise<File> {
  if (!file.type.startsWith('image/')) return file;

  if (signal?.aborted) throw new DOMException('Compression cancelled', 'AbortError');

  const compressed = await imageCompression(file, {
    maxSizeMB: COMPRESSION_MAX_SIZE_MB,
    maxWidthOrHeight: COMPRESSION_MAX_DIMENSION,
    useWebWorker: true,
    // Strips all EXIF / XMP metadata during canvas re-encoding.
    // JPEG orientation is applied to pixel data before encoding.
    preserveExif: false,
    signal,
  });

  if (signal?.aborted) throw new DOMException('Compression cancelled', 'AbortError');

  const result = new File([compressed], file.name, { type: compressed.type });

  // Defence-in-depth: verify output contains no metadata segments.
  const check = await verifyMetadataStripped(result);
  if (!check.clean) {
    throw new Error(
      `Metadata stripping failed for "${file.name}": ` +
        `EXIF=${check.hasExif}, XMP=${check.hasXmp}. Upload blocked for privacy.`
    );
  }

  return result;
}

export const PhotoUploader: React.FC<PhotoUploaderProps> = ({
  currentCount,
  maxPhotos,
  isUploading,
  uploadProgress,
  onUpload,
  onCancelUpload,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [stagedFiles, setStagedFiles] = useState<PreviewFile[]>([]);
  const [phaseProgress, setPhaseProgress] = useState<PhaseProgress>({
    phase: 'idle',
    percent: 0,
    label: '',
  });
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  /**
   * AbortController for the current compression pipeline.
   * Replaced on each new processFiles() call.
   */
  const compressionAbortRef = useRef<AbortController | null>(null);
  /**
   * AbortController for the active upload, passed to onUpload().
   * Replaced on each handleUpload() call.
   */
  const uploadAbortRef = useRef<AbortController | null>(null);

  const remainingSlots = maxPhotos - currentCount;
  const stagedFilesRef = useRef(stagedFiles);
  stagedFilesRef.current = stagedFiles;

  // Revoke any remaining blob URLs when the component unmounts
  useEffect(() => {
    return () => {
      stagedFilesRef.current.forEach((pf) => URL.revokeObjectURL(pf.previewUrl));
    };
  }, []);

  // Revoke all staged preview URLs on unmount to prevent memory leaks.
  useEffect(() => {
    return () => {
      setStagedFiles((prev) => {
        prev.forEach((p) => URL.revokeObjectURL(p.previewUrl));
        return [];
      });
      compressionAbortRef.current?.abort();
      uploadAbortRef.current?.abort();
    };
  }, []);

  // Sync phase progress with the parent-controlled uploadProgress once uploading.
  useEffect(() => {
    if (isUploading) {
      // Map parent's 0-100 upload progress to the 'uploading' phase range (70-100%)
      const combined = 70 + Math.round(uploadProgress * 0.3);
      setPhaseProgress({
        phase: 'uploading',
        percent: Math.min(combined, 100),
        label: `Uploading… ${uploadProgress}%`,
      });
    } else if (phaseProgress.phase === 'uploading') {
      // Parent says upload is done
      setPhaseProgress({ phase: 'done', percent: 100, label: 'Upload complete' });
    }
  }, [isUploading, uploadProgress]); // eslint-disable-line react-hooks/exhaustive-deps

  const processFiles = useCallback(
    async (rawFiles: FileList | File[]) => {
      // Cancel any running compression
      compressionAbortRef.current?.abort();
      const abortController = new AbortController();
      compressionAbortRef.current = abortController;

      const fileArray = Array.from(rawFiles);
      setError(null);
      setPhaseProgress({ phase: 'compressing', percent: 5, label: 'Compressing images…' });

      const valid = fileArray.filter((f) => {
        if (!ALLOWED_TYPES.includes(f.type)) return false;
        if (f.size > MAX_FILE_SIZE_MB * 1024 * 1024) return false;
        return true;
      });

      const slotsAvailable = remainingSlots - stagedFiles.length;
      const toProcess = valid.slice(0, Math.max(0, slotsAvailable));
      if (toProcess.length === 0) {
        setPhaseProgress({ phase: 'idle', percent: 0, label: '' });
        return;
      }

      try {
        // Compression phase: 5% → 60%
        const totalFiles = toProcess.length;
        const compressedFiles: File[] = [];

        for (let i = 0; i < totalFiles; i++) {
          if (abortController.signal.aborted) return;
          const pct = 5 + Math.round(((i + 0.5) / totalFiles) * 55);
          setPhaseProgress({
            phase: 'compressing',
            percent: pct,
            label: `Compressing ${i + 1}/${totalFiles}…`,
          });
          compressedFiles.push(await compressAndStripMetadata(toProcess[i], abortController.signal));
        }

        if (abortController.signal.aborted) return;

        // Verification phase: 60% → 70%
        setPhaseProgress({ phase: 'verifying', percent: 65, label: 'Verifying metadata removal…' });
        // compressAndStripMetadata already runs the per-file check;
        // this phase marker is for the aggregated confirmation.
        await new Promise<void>((resolve) => setTimeout(resolve, 0)); // yield to event loop

        if (abortController.signal.aborted) return;

        const previews: PreviewFile[] = compressedFiles.map((file) => ({
          file,
          previewUrl: URL.createObjectURL(file),
        }));

        setStagedFiles((prev) => [...prev, ...previews]);
        setPhaseProgress({ phase: 'idle', percent: 0, label: '' });
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          setPhaseProgress({ phase: 'idle', percent: 0, label: '' });
          return;
        }
        const message = err instanceof Error ? err.message : 'Image processing failed.';
        setError(message);
        setPhaseProgress({ phase: 'error', percent: 0, label: 'Processing failed' });
      }
    },
    [remainingSlots, stagedFiles.length]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClickDropzone = () => {
    if (!isUploading && phaseProgress.phase === 'idle') {
      fileInputRef.current?.click();
    }
  };

  const removeStaged = (index: number) => {
    setStagedFiles((prev) => {
      const removed = prev[index];
      URL.revokeObjectURL(removed.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleUpload = () => {
    if (stagedFiles.length === 0) return;
    // Create a fresh AbortController for this upload
    uploadAbortRef.current?.abort(); // cancel any previous
    const abortController = new AbortController();
    uploadAbortRef.current = abortController;

    setPhaseProgress({ phase: 'uploading', percent: 70, label: 'Starting upload…' });

    onUpload(stagedFiles.map((p) => p.file), abortController.signal);
    // Revoke object URLs immediately; the parent now owns the File references
    stagedFiles.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    setStagedFiles([]);
  };

  const handleCancelCompression = () => {
    compressionAbortRef.current?.abort();
    setPhaseProgress({ phase: 'idle', percent: 0, label: '' });
    setError(null);
  };

  const handleCancelUpload = () => {
    uploadAbortRef.current?.abort();
    onCancelUpload?.();
    setPhaseProgress({ phase: 'idle', percent: 0, label: '' });
  };

  const handleCancelStaging = () => {
    // Revoke object URLs to free memory when the user cancels staging
    stagedFiles.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    setStagedFiles([]);
    setError(null);
    setPhaseProgress({ phase: 'idle', percent: 0, label: '' });
  };

  const isCompressing = phaseProgress.phase === 'compressing' || phaseProgress.phase === 'verifying';
  const disabled = isUploading || isCompressing || remainingSlots <= 0;

  return (
    <div className={styles.uploaderSection}>
      <div
        className={`${styles.dropzone} ${isDragging ? styles.dropzoneDragging : ''} ${disabled ? styles.dropzoneDisabled : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClickDropzone}
        role="button"
        tabIndex={0}
        aria-label="Add photos"
        aria-disabled={disabled}
        onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => {
          if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
            e.preventDefault();
            handleClickDropzone();
          }
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          aria-label="Select photos to upload"
          accept={ALLOWED_TYPES.join(',')}
          multiple
          onChange={handleInputChange}
          className={styles.hiddenInput}
          disabled={disabled}
        />
        <div className={styles.dropzoneContent}>
          <Upload className={styles.uploadIcon} aria-hidden="true" />
          <p className={styles.dropzoneText}>
            {isCompressing
              ? phaseProgress.label
              : isDragging
                ? 'Drop your photos here'
                : 'Drag & drop photos or click to browse'}
          </p>
          <p className={styles.dropzoneSubtext}>
            JPEG, PNG, WebP — up to {MAX_FILE_SIZE_MB}MB each —{' '}
            {remainingSlots - stagedFiles.length} slot
            {remainingSlots - stagedFiles.length !== 1 ? 's' : ''} remaining
          </p>
        </div>
      </div>

      {/* Compression / verification progress */}
      {isCompressing && (
        <div className={styles.progressContainer}>
          <div className={styles.progressHeader}>
            <span className={styles.progressLabel}>{phaseProgress.label}</span>
            <button
              type="button"
              className={styles.cancelIconBtn}
              onClick={handleCancelCompression}
              aria-label="Cancel compression"
            >
              <X size={14} />
            </button>
          </div>
          <div
            className={styles.progressBar}
            role="progressbar"
            aria-valuenow={phaseProgress.percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={phaseProgress.label}
          >
            <div className={styles.progressFill} style={{ width: `${phaseProgress.percent}%` }} />
          </div>
          <p className={styles.progressText}>{phaseProgress.percent}%</p>
        </div>
      )}

      {error && (
        <div role="alert" className={styles.compressionError}>
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      )}

      {stagedFiles.length > 0 && (
        <>
          <div className={styles.previewGrid}>
            {stagedFiles.map((pf, i) => (
              <div key={i} className={styles.previewItem}>
                <img src={pf.previewUrl} alt={pf.file.name} className={styles.previewImage} />
                <button
                  type="button"
                  className={styles.removePreview}
                  onClick={() => removeStaged(i)}
                  aria-label={`Remove ${pf.file.name}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <div className={styles.uploadActions}>
            <button
              type="button"
              className={styles.uploadButton}
              onClick={handleUpload}
              disabled={isUploading}
            >
              {isUploading
                ? 'Uploading…'
                : `Upload ${stagedFiles.length} photo${stagedFiles.length !== 1 ? 's' : ''}`}
            </button>
            <button
              type="button"
              className={styles.cancelButton}
              onClick={handleCancelStaging}
              disabled={isUploading}
            >
              Cancel
            </button>
          </div>
        </>
      )}

      {/* Upload progress with cancel button */}
      {isUploading && (
        <div className={styles.progressContainer}>
          <div className={styles.progressHeader}>
            <span className={styles.progressLabel}>{phaseProgress.label}</span>
            <button
              type="button"
              className={styles.cancelIconBtn}
              onClick={handleCancelUpload}
              aria-label="Cancel upload"
            >
              <X size={14} />
            </button>
          </div>
          <div
            className={styles.progressBar}
            role="progressbar"
            aria-valuenow={phaseProgress.percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Upload progress"
          >
            <div className={styles.progressFill} style={{ width: `${phaseProgress.percent}%` }} />
          </div>
          <p className={styles.progressText}>{uploadProgress}%</p>
        </div>
      )}
    </div>
  );
};
