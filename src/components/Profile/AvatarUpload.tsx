import React, { useState, useRef, useEffect, useCallback } from 'react';
import Avatar from '@/components/Avatar';
import styles from './AvatarUpload.module.css';

/** Size (in px) of the square crop viewport. */
export const CROP_VIEWPORT_SIZE = 256;
/** Size (in px) of the exported avatar image. */
export const CROPPED_OUTPUT_SIZE = 512;
/** Aspect ratio is locked to 1:1 for avatars. */
export const CROP_ASPECT_RATIO = 1;

export interface CropArea {
  /** Horizontal offset of the crop square, in source-image pixels. */
  x: number;
  /** Vertical offset of the crop square, in source-image pixels. */
  y: number;
  /** Side length of the crop square, in source-image pixels. */
  size: number;
}

export interface CropState {
  /** Natural dimensions of the selected image. */
  imageWidth: number;
  imageHeight: number;
  /** Side length of the crop square, in source-image pixels. */
  size: number;
  /** Crop square offset, in source-image pixels. */
  x: number;
  y: number;
  /** Zoom multiplier applied to the crop square (1 = largest square). */
  zoom: number;
}

interface AvatarUploadProps {
  currentAvatar?: string;
  onUploadSuccess: (avatarUrl: string) => void;
  onUploadError: (error: string) => void;
  isLoading?: boolean;
  userName?: string;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/** Largest 1:1 crop square that fits inside the image. */
const maxCropSize = (width: number, height: number) => Math.min(width, height);

/** Converts the crop state into source-image pixel coordinates. */
export const getCropArea = (crop: CropState): CropArea => ({
  x: Math.round(crop.x),
  y: Math.round(crop.y),
  size: Math.round(crop.size),
});

/** Keeps the crop square inside the image bounds. */
export const clampCropState = (crop: CropState): CropState => {
  const size = clamp(crop.size, 1, maxCropSize(crop.imageWidth, crop.imageHeight));
  return {
    ...crop,
    size,
    x: clamp(crop.x, 0, crop.imageWidth - size),
    y: clamp(crop.y, 0, crop.imageHeight - size),
  };
};

/** Renders the cropped square to a data URL. */
export const cropImageToDataUrl = (
  image: HTMLImageElement,
  area: CropArea,
  outputSize: number = CROPPED_OUTPUT_SIZE,
): string => {
  const canvas = document.createElement('canvas');
  canvas.width = outputSize;
  canvas.height = outputSize;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas is not supported in this browser');
  }
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, area.x, area.y, area.size, area.size, 0, 0, outputSize, outputSize);
  return canvas.toDataURL('image/jpeg', 0.9);
};

export const AvatarUpload: React.FC<AvatarUploadProps> = ({
  currentAvatar,
  onUploadSuccess,
  onUploadError,
  isLoading = false,
  userName = '',
}) => {
  const [preview, setPreview] = useState<string | undefined>(currentAvatar);
  const [isDragging, setIsDragging] = useState(false);
  const [pendingImage, setPendingImage] = useState<HTMLImageElement | null>(null);
  const [crop, setCrop] = useState<CropState | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragStartRef = useRef<{ pointerX: number; pointerY: number; x: number; y: number } | null>(
    null,
  );
  // Tracks whether the next `currentAvatar` change was caused by our own
  // local file selection (via onUploadSuccess bubbling back up), so that
  // sync effect below doesn't clobber the just-picked local preview.
  const hasLocalSelectionRef = useRef(false);

  // Keep the preview in sync with the currentAvatar prop, which may arrive
  // asynchronously (e.g. after the user's profile finishes loading) or
  // change when switching between different users/profiles.
  useEffect(() => {
    if (hasLocalSelectionRef.current) {
      hasLocalSelectionRef.current = false;
      return;
    }
    setPreview(currentAvatar);
  }, [currentAvatar]);

  const handleFileSelect = (file: File) => {
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

    // Load the image and open the crop tool instead of uploading immediately.
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const size = maxCropSize(image.naturalWidth, image.naturalHeight);
      setPendingImage(image);
      setCrop({
        imageWidth: image.naturalWidth,
        imageHeight: image.naturalHeight,
        size,
        x: (image.naturalWidth - size) / 2,
        y: (image.naturalHeight - size) / 2,
        zoom: 1,
      });
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      onUploadError('Could not read the selected image');
    };
    image.src = objectUrl;
  };

  const closeCrop = useCallback(() => {
    if (pendingImage) {
      URL.revokeObjectURL(pendingImage.src);
    }
    setPendingImage(null);
    setCrop(null);
    dragStartRef.current = null;
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [pendingImage]);

  const handleZoomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const zoom = Number(e.target.value);
    setCrop((prev) => {
      if (!prev) return prev;
      const maxSize = maxCropSize(prev.imageWidth, prev.imageHeight);
      const size = maxSize / zoom;
      const centerX = prev.x + prev.size / 2;
      const centerY = prev.y + prev.size / 2;
      return clampCropState({
        ...prev,
        zoom,
        size,
        x: centerX - size / 2,
        y: centerY - size / 2,
      });
    });
  };

  const handleCropPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!crop) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragStartRef.current = { pointerX: e.clientX, pointerY: e.clientY, x: crop.x, y: crop.y };
  };

  const handleCropPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const start = dragStartRef.current;
    if (!start || !crop) return;
    const scale = crop.size / CROP_VIEWPORT_SIZE;
    setCrop(
      clampCropState({
        ...crop,
        x: start.x - (e.clientX - start.pointerX) * scale,
        y: start.y - (e.clientY - start.pointerY) * scale,
      }),
    );
  };

  const handleCropPointerUp = () => {
    dragStartRef.current = null;
  };

  const handleCropKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!crop) return;
    const step = Math.max(1, Math.round(crop.size / 20));
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const move = moves[e.key];
    if (!move) return;
    e.preventDefault();
    setCrop(clampCropState({ ...crop, x: crop.x + move[0], y: crop.y + move[1] }));
  };

  const handleCropSave = () => {
    if (!pendingImage || !crop) return;
    setIsSaving(true);
    try {
      const dataUrl = cropImageToDataUrl(pendingImage, getCropArea(crop));
      hasLocalSelectionRef.current = true;
      setPreview(dataUrl);
      onUploadSuccess(dataUrl);
      closeCrop();
    } catch (error) {
      onUploadError(error instanceof Error ? error.message : 'Failed to crop image');
    } finally {
      setIsSaving(false);
    }
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
    if (pendingImage) return;
    fileInputRef.current?.click();
  };

  if (pendingImage && crop) {
    const scale = CROP_VIEWPORT_SIZE / crop.size;
    return (
      <div className={styles.container}>
        <div className={styles.cropPanel} data-testid="avatar-crop-tool">
          <p className={styles.cropTitle} id="avatar-crop-title">
            Crop your avatar
          </p>
          <p className={styles.cropHint} id="avatar-crop-hint">
            Drag to reposition, use the slider or arrow keys to zoom. Aspect ratio is locked to 1:1.
          </p>
          <div
            className={styles.cropViewport}
            style={{ width: CROP_VIEWPORT_SIZE, height: CROP_VIEWPORT_SIZE }}
            role="application"
            aria-label="Avatar crop area"
            aria-describedby="avatar-crop-hint"
            tabIndex={0}
            onPointerDown={handleCropPointerDown}
            onPointerMove={handleCropPointerMove}
            onPointerUp={handleCropPointerUp}
            onPointerCancel={handleCropPointerUp}
            onKeyDown={handleCropKeyDown}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={pendingImage.src}
              alt="Selected avatar to crop"
              className={styles.cropImage}
              draggable={false}
              style={{
                width: crop.imageWidth * scale,
                height: crop.imageHeight * scale,
                transform: `translate(${-crop.x * scale}px, ${-crop.y * scale}px)`,
              }}
            />
            <div className={styles.cropOverlay} aria-hidden="true" />
          </div>

          <div className={styles.cropControls}>
            <label className={styles.cropLabel} htmlFor="avatar-crop-zoom">
              Zoom
            </label>
            <input
              id="avatar-crop-zoom"
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={crop.zoom}
              onChange={handleZoomChange}
              className={styles.cropSlider}
              aria-valuetext={`${Math.round(crop.zoom * 100)}%`}
            />
          </div>

          <div className={styles.cropPreviewRow}>
            <span className={styles.cropLabel}>Preview</span>
            <div className={styles.cropPreview} data-testid="avatar-crop-preview">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={pendingImage.src}
                alt="Avatar preview"
                draggable={false}
                style={{
                  width: (crop.imageWidth / crop.size) * 96,
                  height: (crop.imageHeight / crop.size) * 96,
                  transform: `translate(${(-crop.x / crop.size) * 96}px, ${(-crop.y / crop.size) * 96}px)`,
                }}
              />
            </div>
          </div>

          <div className={styles.cropActions}>
            <button
              type="button"
              className={styles.cropCancel}
              onClick={closeCrop}
              disabled={isSaving || isLoading}
            >
              Cancel
            </button>
            <button
              type="button"
              className={styles.cropSave}
              onClick={handleCropSave}
              disabled={isSaving || isLoading}
            >
              {isSaving ? 'Saving…' : 'Save avatar'}
            </button>
          </div>
        </div>
      </div>
    );
  }

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
            <Avatar
              src={preview}
              name={userName}
              type="user"
              size={96}
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
              {isDragging ? 'Drop your image here' : 'Drag and drop or click to upload'}
            </p>
            <p className={styles.subtext}>JPEG, PNG, WebP or GIF (Max 5MB)</p>
          </div>
        )}
      </div>
    </div>
  );
};
