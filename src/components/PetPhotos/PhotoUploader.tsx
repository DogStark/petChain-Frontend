import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Upload } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import styles from './PetPhotos.module.css';
import { verifyMetadataStripped } from './exifUtils';

const MAX_FILE_SIZE_MB = 10;
const COMPRESSION_MAX_SIZE_MB = 2;
const COMPRESSION_MAX_DIMENSION = 1920;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

interface PhotoUploaderProps {
  currentCount: number;
  maxPhotos: number;
  isUploading: boolean;
  uploadProgress: number;
  onUpload: (files: File[]) => void;
}

interface PreviewFile {
  file: File;
  previewUrl: string;
}

/**
 * Compress a single image file and strip all EXIF / XMP metadata.
 *
 * `browser-image-compression` re-encodes the image through a <canvas>
 * element with `preserveExif: false`, which discards all metadata segments.
 * JPEG orientation (Exif tag 0x0112) is applied to the pixel data before
 * encoding so the visual appearance is preserved without the orientation tag.
 *
 * After compression we call `verifyMetadataStripped` as a defence-in-depth
 * check.  If metadata is unexpectedly present the original uncompressed file
 * is **not** used as a fallback — instead the verification error is surfaced
 * so the upload can be blocked.
 *
 * @throws {Error} When the post-compression metadata check detects residual EXIF/XMP.
 */
async function compressAndStripMetadata(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file;

  const compressed = await imageCompression(file, {
    maxSizeMB: COMPRESSION_MAX_SIZE_MB,
    maxWidthOrHeight: COMPRESSION_MAX_DIMENSION,
    useWebWorker: true,
    // Strips all EXIF / XMP metadata during canvas re-encoding.
    // JPEG orientation is applied to pixel data before encoding — visual
    // appearance is preserved without the orientation tag being present.
    preserveExif: false,
  });

  const result = new File([compressed], file.name, { type: compressed.type });

  // Defence-in-depth: verify the output contains no metadata segments.
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
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [stagedFiles, setStagedFiles] = useState<PreviewFile[]>([]);
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressionError, setCompressionError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Revoke object URLs for any staged files when the component unmounts
  // to avoid memory leaks.
  useEffect(() => {
    return () => {
      setStagedFiles((prev) => {
        prev.forEach((p) => URL.revokeObjectURL(p.previewUrl));
        return [];
      });
    };
  }, []);

  const remainingSlots = maxPhotos - currentCount;

  const processFiles = useCallback(
    async (rawFiles: FileList | File[]) => {
      const fileArray = Array.from(rawFiles);
      setCompressionError(null);

      const valid = fileArray.filter((f) => {
        if (!ALLOWED_TYPES.includes(f.type)) return false;
        if (f.size > MAX_FILE_SIZE_MB * 1024 * 1024) return false;
        return true;
      });

      const slotsAvailable = remainingSlots - stagedFiles.length;
      const toProcess = valid.slice(0, Math.max(0, slotsAvailable));
      if (toProcess.length === 0) return;

      setIsCompressing(true);
      try {
        // Compress and strip metadata; surface errors if verification fails
        const compressed = await Promise.all(toProcess.map(compressAndStripMetadata));

        const previews: PreviewFile[] = compressed.map((file) => ({
          file,
          previewUrl: URL.createObjectURL(file),
        }));

        setStagedFiles((prev) => [...prev, ...previews]);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Image processing failed.';
        setCompressionError(message);
      } finally {
        setIsCompressing(false);
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
    if (!isUploading && !isCompressing) {
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
    onUpload(stagedFiles.map((p) => p.file));
    // Revoke object URLs immediately since we're done with them
    stagedFiles.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    setStagedFiles([]);
  };

  const handleCancel = () => {
    // Revoke object URLs to free memory when the user cancels staging
    stagedFiles.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    setStagedFiles([]);
    setCompressionError(null);
  };

  const disabled = isUploading || remainingSlots <= 0;

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
          <Upload className={styles.uploadIcon} />
          <p className={styles.dropzoneText}>
            {isCompressing
              ? 'Compressing & stripping metadata…'
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

      {compressionError && (
        <div role="alert" className={styles.compressionError}>
          <span>{compressionError}</span>
          <button
            type="button"
            onClick={() => setCompressionError(null)}
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
              onClick={handleCancel}
              disabled={isUploading}
            >
              Cancel
            </button>
          </div>
        </>
      )}

      {isUploading && (
        <div className={styles.progressContainer}>
          <div
            className={styles.progressBar}
            role="progressbar"
            aria-valuenow={uploadProgress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Upload progress"
          >
            <div className={styles.progressFill} style={{ width: `${uploadProgress}%` }} />
          </div>
          <p className={styles.progressText}>{uploadProgress}%</p>
        </div>
      )}
    </div>
  );
};
