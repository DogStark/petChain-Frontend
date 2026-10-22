import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowDown, ArrowUp, Star, Trash2, GripVertical } from 'lucide-react';
import type { PetPhoto } from '@/lib/api/petPhotosAPI';
import styles from './PetPhotos.module.css';

interface PhotoCardProps {
  photo: PetPhoto;
  /** 1-based position in the gallery. */
  position: number;
  total: number;
  onSetPrimary: (photoId: string) => void;
  onDelete: (photoId: string) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

export const PhotoCard: React.FC<PhotoCardProps> = ({
  photo,
  position,
  total,
  onSetPrimary,
  onDelete,
  onMoveUp,
  onMoveDown,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: photo.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const photoLabel = photo.originalFilename || 'photo';
  const isFirst = position <= 1;
  const isLast = position >= total;

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
        {photo.isPrimary && <span className={styles.primaryBadge}>Primary</span>}
        <div
          className={styles.dragHandle}
          aria-label={`Drag to reorder ${photoLabel}, position ${position} of ${total}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical size={16} aria-hidden="true" />
        </div>
      </div>

      <div className={styles.cardActions}>
        <div className={styles.moveControls} role="group" aria-label="Reorder photo">
          <button
            type="button"
            className={styles.moveButton}
            onClick={onMoveUp}
            disabled={isFirst}
            aria-label={`Move ${photoLabel} up`}
            title="Move up"
          >
            <ArrowUp size={14} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={styles.moveButton}
            onClick={onMoveDown}
            disabled={isLast}
            aria-label={`Move ${photoLabel} down`}
            title="Move down"
          >
            <ArrowDown size={14} aria-hidden="true" />
          </button>
        </div>
        {!photo.isPrimary && (
          <button
            type="button"
            className={styles.cardActionBtn}
            onClick={() => onSetPrimary(photo.id)}
            title="Set as primary photo"
          >
            <Star size={14} aria-hidden="true" />
            Primary
          </button>
        )}
        <button
          type="button"
          className={`${styles.cardActionBtn} ${styles.cardActionBtnDanger}`}
          onClick={() => onDelete(photo.id)}
          title="Delete photo"
        >
          <Trash2 size={14} aria-hidden="true" />
          Delete
        </button>
      </div>
    </div>
  );
};
