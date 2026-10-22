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
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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

  return (
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
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
};
