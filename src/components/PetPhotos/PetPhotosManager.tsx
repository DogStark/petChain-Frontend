import React, { useState, useEffect, useCallback, useRef } from 'react';
import { petPhotosAPI, type PetPhoto } from '@/lib/api/petPhotosAPI';
import { PhotoUploader } from './PhotoUploader';
import { PhotoGallery } from './PhotoGallery';
import { useAnnouncement } from '@/hooks/useAnnouncement';
import styles from './PetPhotos.module.css';

const MAX_PHOTOS = 10;

function getApiError(err: unknown, fallback: string): string {
  if (typeof err === 'object' && err !== null && 'response' in err) {
    const msg = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
    if (typeof msg === 'string') return msg;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}

interface PetPhotosManagerProps {
  petId: string;
}

export const PetPhotosManager: React.FC<PetPhotosManagerProps> = ({ petId }) => {
  const { announce } = useAnnouncement();
  const [photos, setPhotos] = useState<PetPhoto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  /**
   * Keep a reference to the active upload AbortController so we can cancel
   * from the parent's handleCancelUpload callback.
   */
  const uploadAbortRef = useRef<AbortController | null>(null);

  const fetchPhotos = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await petPhotosAPI.getPhotos(petId);
      setPhotos(data);
      setError(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? (err as {response?: {data?: {message?: string}}}).response?.data?.message ?? err.message : 'Failed to load photos';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [petId]);

  useEffect(() => {
    fetchPhotos();
  }, [fetchPhotos]);

  /**
   * Receive files from PhotoUploader along with the AbortSignal it generated.
   * Pass the signal to the API layer so the fetch can be cancelled if the user
   * presses "Cancel" during the upload phase.
   */
  const handleUpload = async (files: File[], abortSignal: AbortSignal) => {
    try {
      setIsUploading(true);
      setUploadProgress(0);
      setError(null);

      const uploaded = await petPhotosAPI.uploadPhotos(petId, files, (progress) => {
        if (!abortSignal.aborted) {
          setUploadProgress(progress);
        }
      }, abortSignal);

      if (!abortSignal.aborted) {
        setPhotos((prev) => [...prev, ...uploaded]);
        announce('Photo uploaded successfully.', 'success');
      }
    } catch (err: unknown) {
      // Ignore AbortError — the user intentionally cancelled
      if (err instanceof DOMException && err.name === 'AbortError') return;
      const msg = err instanceof Error ? (err as {response?: {data?: {message?: string}}}).response?.data?.message ?? err.message : 'Failed to upload photos';
      setError(msg);
      announce('Photo upload failed.', 'error');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleCancelUpload = () => {
    uploadAbortRef.current?.abort();
    setIsUploading(false);
    setUploadProgress(0);
  };

  const handleSetPrimary = async (photoId: string) => {
    try {
      setError(null);
      await petPhotosAPI.setPrimary(petId, photoId);
      setPhotos((prev) =>
        prev.map((p) => ({
          ...p,
          isPrimary: p.id === photoId,
        }))
      );
      announce('Primary photo updated.', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? (err as {response?: {data?: {message?: string}}}).response?.data?.message ?? err.message : 'Failed to set primary photo';
      setError(msg);
      announce('Failed to update primary photo.', 'error');
    }
  };

  const handleDelete = async (photoId: string) => {
    try {
      setError(null);
      await petPhotosAPI.deletePhoto(petId, photoId);
      setPhotos((prev) => {
        const remaining = prev.filter((p) => p.id !== photoId);
        const deleted = prev.find((p) => p.id === photoId);
        if (deleted?.isPrimary && remaining.length > 0) {
          remaining[0] = { ...remaining[0], isPrimary: true };
        }
        return remaining;
      });
      announce('Photo deleted.', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? (err as {response?: {data?: {message?: string}}}).response?.data?.message ?? err.message : 'Failed to delete photo';
      setError(msg);
      announce('Failed to delete photo.', 'error');
    }
  };

  const handleReorder = async (photoIds: string[]) => {
    const previousPhotos = [...photos];

    const reordered = photoIds
      .map((id) => photos.find((p) => p.id === id))
      .filter(Boolean) as PetPhoto[];
    setPhotos(reordered);

    try {
      setError(null);
      await petPhotosAPI.reorderPhotos(petId, photoIds);
      announce('Photo order updated.', 'success');
    } catch (err: unknown) {
      setPhotos(previousPhotos);
      const msg = err instanceof Error ? (err as {response?: {data?: {message?: string}}}).response?.data?.message ?? err.message : 'Failed to reorder photos';
      setError(msg);
      announce('Failed to reorder photos.', 'error');
    }
  };

  if (isLoading) {
    return (
      <div className={styles.manager}>
        <div className={styles.loadingContainer}>
          <div className={styles.spinner} />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.manager}>
      <div className={styles.header}>
        <h3 className={styles.title}>
          Photos{' '}
          <span className={styles.photoCount}>
            ({photos.length}/{MAX_PHOTOS})
          </span>
        </h3>
      </div>

      {error && (
        <div className={styles.errorBanner}>
          <span>{error}</span>
          <button onClick={() => setError(null)} aria-label="Dismiss error">×</button>
        </div>
      )}

      <PhotoUploader
        currentCount={photos.length}
        maxPhotos={MAX_PHOTOS}
        isUploading={isUploading}
        uploadProgress={uploadProgress}
        onUpload={handleUpload}
        onCancelUpload={handleCancelUpload}
      />

      <PhotoGallery
        photos={photos}
        onSetPrimary={handleSetPrimary}
        onDelete={handleDelete}
        onReorder={handleReorder}
      />
    </div>
  );
};
