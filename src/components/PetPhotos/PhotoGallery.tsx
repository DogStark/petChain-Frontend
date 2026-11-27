import React, { useCallback, useEffect, useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { ChevronLeft, ChevronRight, ImageIcon, X } from 'lucide-react';
import { PhotoCard } from './PhotoCard';
import { useAnnouncement } from '@/hooks/useAnnouncement';
import type { PetPhoto } from '@/lib/api/petPhotosAPI';
import styles from './PetPhotos.module.css';

interface PhotoGalleryProps {
  photos: PetPhoto[];
  onSetPrimary: (photoId: string) => void;
  onDelete: (photoId: string) => void;
  onReorder: (photoIds: string[]) => void;
}

export const PhotoGallery: React.FC<PhotoGalleryProps> = ({
  photos,
  onSetPrimary,
  onDelete,
  onReorder,
}) => {
  const { announce } = useAnnouncement();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const openLightbox = useCallback((index: number) => {
    setLightboxIndex(index);
  }, []);

  const closeLightbox = useCallback(() => {
    setLightboxIndex(null);
  }, []);

  const prevPhoto = useCallback(() => {
    setLightboxIndex((i) => (i === null ? null : (i - 1 + photos.length) % photos.length));
  }, [photos.length]);

  const nextPhoto = useCallback(() => {
    setLightboxIndex((i) => (i === null ? null : (i + 1) % photos.length));
  }, [photos.length]);

  // Keyboard navigation for the lightbox
  useEffect(() => {
    if (lightboxIndex === null) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') prevPhoto();
      if (e.key === 'ArrowRight') nextPhoto();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [lightboxIndex, closeLightbox, prevPhoto, nextPhoto]);

  /**
   * Move a photo one position with the keyboard-accessible controls. Screen
   * readers hear the new position once the parent accepts the reorder.
   */
  const movePhoto = (index: number, offset: -1 | 1) => {
    const nextIndex = index + offset;
    if (nextIndex < 0 || nextIndex >= photos.length) return;

    const reordered = [...photos];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(nextIndex, 0, moved);

    onReorder(reordered.map((p) => p.id));
    announce(
      `Photo moved ${offset === -1 ? 'up' : 'down'} to position ${nextIndex + 1} of ${photos.length}.`,
      'success',
    );
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = photos.findIndex((p) => p.id === active.id);
    const newIndex = photos.findIndex((p) => p.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = [...photos];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);

    onReorder(reordered.map((p) => p.id));
    announce(`Photo moved to position ${newIndex + 1} of ${photos.length}.`, 'success');
  };

  if (photos.length === 0) {
    return (
      <div className={styles.emptyState}>
        <ImageIcon className={styles.emptyIcon} />
        <p className={styles.emptyText}>No photos yet</p>
        <p className={styles.emptySubtext}>Upload photos to create a gallery for your pet</p>
      </div>
    );
  }

  const activeLightboxPhoto = lightboxIndex !== null ? photos[lightboxIndex] : null;

  return (
    <>
      <div className={styles.gallerySection}>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={photos.map((p) => p.id)} strategy={rectSortingStrategy}>
            <div className={styles.galleryGrid}>
              {photos.map((photo, index) => (
                <PhotoCard
                  key={photo.id}
                  photo={photo}
                  position={index + 1}
                  total={photos.length}
                  onSetPrimary={onSetPrimary}
                  onDelete={onDelete}
                  onMoveUp={() => movePhoto(index, -1)}
                  onMoveDown={() => movePhoto(index, 1)}
                  onOpenLightbox={() => openLightbox(index)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      {/* Lightbox overlay (issue #1391) */}
      {activeLightboxPhoto !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Photo ${(lightboxIndex ?? 0) + 1} of ${photos.length}`}
          className={styles.lightboxOverlay}
          onClick={closeLightbox}
        >
          <button
            className={styles.lightboxClose}
            aria-label="Close lightbox"
            onClick={closeLightbox}
          >
            <X size={28} />
          </button>

          {photos.length > 1 && (
            <button
              className={`${styles.lightboxNav} ${styles.lightboxNavPrev}`}
              aria-label="Previous photo"
              onClick={(e) => { e.stopPropagation(); prevPhoto(); }}
            >
              <ChevronLeft size={36} />
            </button>
          )}

          <div
            className={styles.lightboxContent}
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={activeLightboxPhoto.photoUrl}
              alt={`Pet photo ${(lightboxIndex ?? 0) + 1} of ${photos.length}`}
              className={styles.lightboxImage}
              draggable={false}
            />
            <p className={styles.lightboxCounter}>
              {(lightboxIndex ?? 0) + 1} / {photos.length}
            </p>
          </div>

          {photos.length > 1 && (
            <button
              className={`${styles.lightboxNav} ${styles.lightboxNavNext}`}
              aria-label="Next photo"
              onClick={(e) => { e.stopPropagation(); nextPhoto(); }}
            >
              <ChevronRight size={36} />
            </button>
          )}
        </div>
      )}
    </>
  );
};
