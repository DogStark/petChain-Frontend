import React from 'react';
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
import { ImageIcon } from 'lucide-react';
import { PhotoCard } from './PhotoCard';
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
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

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
  };

  if (photos.length === 0) {
    return (
      <div className={styles.emptyState}>
        <ImageIcon className={styles.emptyIcon} />
        <p className={styles.emptyText}>No photos yet</p>
        <p className={styles.emptySubtext}>
          Upload photos to create a gallery for your pet
        </p>
      </div>
    );
  }

  return (
    <div className={styles.gallerySection}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={photos.map((p) => p.id)}
          strategy={rectSortingStrategy}
        >
          <div className={styles.galleryGrid}>
            {photos.map((photo) => (
              <PhotoCard
                key={photo.id}
                photo={photo}
                onSetPrimary={onSetPrimary}
                onDelete={onDelete}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
};
