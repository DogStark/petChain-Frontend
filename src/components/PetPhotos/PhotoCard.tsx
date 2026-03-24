import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Star, Trash2, GripVertical } from 'lucide-react';
import type { PetPhoto } from '@/lib/api/petPhotosAPI';
import styles from './PetPhotos.module.css';

interface PhotoCardProps {
  photo: PetPhoto;
  onSetPrimary: (photoId: string) => void;
  onDelete: (photoId: string) => void;
}

export const PhotoCard: React.FC<PhotoCardProps> = ({
  photo,
  onSetPrimary,
  onDelete,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: photo.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${styles.photoCard} ${photo.isPrimary ? styles.photoCardPrimary : ''} ${isDragging ? styles.photoCardDragging : ''}`}
    >
      <div className={styles.cardImageWrapper}>
        <img
          src={photo.thumbnailUrl || photo.photoUrl}
          alt={photo.originalFilename || 'Pet photo'}
          className={styles.cardImage}
          loading="lazy"
        />
        {photo.isPrimary && (
          <span className={styles.primaryBadge}>Primary</span>
        )}
        <div
          className={styles.dragHandle}
          {...attributes}
          {...listeners}
        >
          <GripVertical size={16} />
        </div>
      </div>

      <div className={styles.cardActions}>
        {!photo.isPrimary && (
          <button
            className={styles.cardActionBtn}
            onClick={() => onSetPrimary(photo.id)}
            title="Set as primary photo"
          >
            <Star size={14} />
            Primary
          </button>
        )}
        <button
          className={`${styles.cardActionBtn} ${styles.cardActionBtnDanger}`}
          onClick={() => onDelete(photo.id)}
          title="Delete photo"
        >
          <Trash2 size={14} />
          Delete
        </button>
      </div>
    </div>
  );
};
