import React, { useState, useRef } from 'react';
import styles from './AvatarUpload.module.css';

interface AvatarUploadProps {
  currentAvatar?: string;
  onUploadSuccess: (avatarUrl: string) => void;
  onUploadError: (error: string) => void;
  isLoading?: boolean;
}

export const AvatarUpload: React.FC<AvatarUploadProps> = ({
  currentAvatar,
  onUploadSuccess,
  onUploadError,
  isLoading = false,
}) => {
  const [preview, setPreview] = useState<string | undefined>(currentAvatar);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (file: File) => {
    if (!file) return;

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      onUploadError('File size must be less than 5MB');
      return;
    }

    // Validate file type
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      onUploadError('Only JPEG, PNG, WebP, and GIF files are allowed');
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Here you would typically upload the file
    // For now, we'll emit the file for parent handling
    onUploadSuccess(URL.createObjectURL(file));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className={styles.container}>
      <div
        className={`${styles.uploadArea} ${isDragging ? styles.dragging : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleInputChange}
          disabled={isLoading}
          className={styles.input}
        />

        {preview ? (
          <div className={styles.previewContainer}>
            <img
              src={preview}
              alt="Avatar preview"
              className={styles.preview}
            />
            {isLoading && <div className={styles.loader} />}
          </div>
        ) : (
          <div className={styles.placeholder}>
            <svg className={styles.icon} fill="none" viewBox="0 0 24 24">
              <path
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            <p className={styles.text}>
              {isDragging
                ? 'Drop your image here'
                : 'Drag and drop or click to upload'}
            </p>
            <p className={styles.subtext}>
              JPEG, PNG, WebP or GIF (Max 5MB)
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
