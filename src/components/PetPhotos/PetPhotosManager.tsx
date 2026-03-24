import React, { useState, useEffect, useCallback } from 'react';
import { petPhotosAPI, type PetPhoto } from '@/lib/api/petPhotosAPI';
import { PhotoUploader } from './PhotoUploader';
import { PhotoGallery } from './PhotoGallery';
import styles from './PetPhotos.module.css';

const MAX_PHOTOS = 10;

interface PetPhotosManagerProps {
  petId: string;
}

export const PetPhotosManager: React.FC<PetPhotosManagerProps> = ({ petId }) => {
  const [photos, setPhotos] = useState<PetPhoto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const fetchPhotos = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await petPhotosAPI.getPhotos(petId);
      setPhotos(data);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load photos');
    } finally {
      setIsLoading(false);
    }
  }, [petId]);

  useEffect(() => {
    fetchPhotos();
  }, [fetchPhotos]);

  const handleUpload = async (files: File[]) => {
    try {
      setIsUploading(true);
      setUploadProgress(0);
      setError(null);

      const uploaded = await petPhotosAPI.uploadPhotos(petId, files, (progress) => {
        setUploadProgress(progress);
      });

      setPhotos((prev) => [...prev, ...uploaded]);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to upload photos');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleSetPrimary = async (photoId: string) => {
    try {
      setError(null);
      await petPhotosAPI.setPrimary(petId, photoId);
      setPhotos((prev) =>
        prev.map((p) => ({
          ...p,
          isPrimary: p.id === photoId,
        })),
      );
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to set primary photo');
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
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete photo');
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
    } catch (err: any) {
      setPhotos(previousPhotos);
      setError(err.response?.data?.message || 'Failed to reorder photos');
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
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      <PhotoUploader
        currentCount={photos.length}
        maxPhotos={MAX_PHOTOS}
        isUploading={isUploading}
        uploadProgress={uploadProgress}
        onUpload={handleUpload}
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
