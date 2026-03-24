import React, { useState, useRef, useCallback } from 'react';
import { Upload } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import styles from './PetPhotos.module.css';

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const remainingSlots = maxPhotos - currentCount;

  const compressFile = async (file: File): Promise<File> => {
    if (!file.type.startsWith('image/')) return file;

    try {
      const compressed = await imageCompression(file, {
        maxSizeMB: COMPRESSION_MAX_SIZE_MB,
        maxWidthOrHeight: COMPRESSION_MAX_DIMENSION,
        useWebWorker: true,
        preserveExif: false,
      });
      return new File([compressed], file.name, { type: compressed.type });
    } catch {
      return file;
    }
  };

  const processFiles = useCallback(
    async (rawFiles: FileList | File[]) => {
      const fileArray = Array.from(rawFiles);

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
        const compressed = await Promise.all(toProcess.map(compressFile));

        const previews: PreviewFile[] = compressed.map((file) => ({
          file,
          previewUrl: URL.createObjectURL(file),
        }));

        setStagedFiles((prev) => [...prev, ...previews]);
      } finally {
        setIsCompressing(false);
      }
    },
    [remainingSlots, stagedFiles.length],
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
    stagedFiles.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    setStagedFiles([]);
  };

  const handleCancel = () => {
    stagedFiles.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    setStagedFiles([]);
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
      >
        <input
          ref={fileInputRef}
          type="file"
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
              ? 'Compressing images...'
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

      {stagedFiles.length > 0 && (
        <>
          <div className={styles.previewGrid}>
            {stagedFiles.map((pf, i) => (
              <div key={i} className={styles.previewItem}>
                <img
                  src={pf.previewUrl}
                  alt={pf.file.name}
                  className={styles.previewImage}
                />
                <button
                  className={styles.removePreview}
                  onClick={() => removeStaged(i)}
                  title="Remove"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <div className={styles.uploadActions}>
            <button
              className={styles.uploadButton}
              onClick={handleUpload}
              disabled={isUploading}
            >
              {isUploading ? 'Uploading...' : `Upload ${stagedFiles.length} photo${stagedFiles.length !== 1 ? 's' : ''}`}
            </button>
            <button
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
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
          <p className={styles.progressText}>{uploadProgress}%</p>
        </div>
      )}
    </div>
  );
};
