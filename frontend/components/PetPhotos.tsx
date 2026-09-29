import React, { useCallback, useEffect, useId, useRef, useState } from 'react';

export interface PetPhoto {
  id: string;
  url: string;
  alt?: string;
}

export interface PetPhotosProps {
  photos: PetPhoto[];
  onChange?: (photos: PetPhoto[]) => void;
  onAddFiles?: (files: FileList) => void;
  onRemove?: (id: string) => void;
  onPreview?: (photo: PetPhoto) => void;
  maxPhotos?: number;
  accept?: string;
  disabled?: boolean;
}

/**
 * Accessible pet photo manager.
 *
 * Supports mouse/touch drag-and-drop as well as a fully keyboard-operable
 * workflow: a native file input for adding photos, move up/down buttons for
 * reordering (with live-region announcements), a preview modal that restores
 * focus on close, and a confirmation path before removing a photo.
 */
export default function PetPhotos({
  photos,
  onChange,
  onAddFiles,
  onRemove,
  onPreview,
  maxPhotos,
  accept = 'image/*',
  disabled = false,
}: PetPhotosProps) {
  const [announcement, setAnnouncement] = useState('');
  const [previewPhoto, setPreviewPhoto] = useState<PetPhoto | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<PetPhoto | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewTriggerRef = useRef<HTMLElement | null>(null);
  const previewCloseRef = useRef<HTMLButtonElement>(null);
  const removeTriggerRef = useRef<HTMLElement | null>(null);
  const removeConfirmRef = useRef<HTMLButtonElement>(null);

  const baseId = useId();
  const liveRegionId = `${baseId}-live`;
  const previewTitleId = `${baseId}-preview-title`;
  const removeTitleId = `${baseId}-remove-title`;

  const atCapacity = typeof maxPhotos === 'number' && photos.length >= maxPhotos;

  const commit = useCallback(
    (next: PetPhoto[]) => {
      onChange?.(next);
    },
    [onChange],
  );

  const move = useCallback(
    (from: number, to: number) => {
      if (to < 0 || to >= photos.length || from === to) return;
      const next = photos.slice();
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      commit(next);
      setAnnouncement(
        `Moved ${moved.alt || `photo ${from + 1}`} to position ${to + 1} of ${next.length}.`,
      );
    },
    [photos, commit],
  );

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (files && files.length > 0) {
        onAddFiles?.(files);
        setAnnouncement(
          files.length === 1
            ? `Added ${files[0].name}.`
            : `Added ${files.length} photos.`,
        );
      }
      // Allow re-selecting the same file later.
      event.target.value = '';
    },
    [onAddFiles],
  );

  const openPreview = useCallback(
    (photo: PetPhoto, trigger: HTMLElement) => {
      previewTriggerRef.current = trigger;
      setPreviewPhoto(photo);
      onPreview?.(photo);
    },
    [onPreview],
  );

  const closePreview = useCallback(() => {
    setPreviewPhoto(null);
    previewTriggerRef.current?.focus();
    previewTriggerRef.current = null;
  }, []);

  const requestRemoval = useCallback((photo: PetPhoto, trigger: HTMLElement) => {
    removeTriggerRef.current = trigger;
    setPendingRemoval(photo);
  }, []);

  const cancelRemoval = useCallback(() => {
    setPendingRemoval(null);
    removeTriggerRef.current?.focus();
    removeTriggerRef.current = null;
  }, []);

  const confirmRemoval = useCallback(() => {
    if (!pendingRemoval) return;
    const removed = pendingRemoval;
    commit(photos.filter((photo) => photo.id !== removed.id));
    onRemove?.(removed.id);
    setAnnouncement(`Removed ${removed.alt || 'photo'}.`);
    setPendingRemoval(null);
    removeTriggerRef.current?.focus();
    removeTriggerRef.current = null;
  }, [pendingRemoval, photos, commit, onRemove]);

  // Move focus into dialogs when they open.
  useEffect(() => {
    if (previewPhoto) previewCloseRef.current?.focus();
  }, [previewPhoto]);

  useEffect(() => {
    if (pendingRemoval) removeConfirmRef.current?.focus();
  }, [pendingRemoval]);

  // Escape closes whichever dialog is open.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (pendingRemoval) cancelRemoval();
      else if (previewPhoto) closePreview();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [pendingRemoval, previewPhoto, cancelRemoval, closePreview]);

  const handleDragStart = (index: number) => () => setDragIndex(index);

  const handleDrop = (index: number) => (event: React.DragEvent) => {
    event.preventDefault();
    if (dragIndex !== null) move(dragIndex, index);
    setDragIndex(null);
  };

  return (
    <section aria-label="Pet photos">
      <div className="pet-photos__toolbar">
        <input
          ref={fileInputRef}
          id={`${baseId}-file`}
          className="pet-photos__file-input"
          type="file"
          accept={accept}
          multiple
          disabled={disabled || atCapacity}
          onChange={handleFileChange}
        />
        <label htmlFor={`${baseId}-file`} className="pet-photos__file-label">
          Add photos
        </label>
        {atCapacity ? (
          <span className="pet-photos__hint">
            Maximum of {maxPhotos} photos reached.
          </span>
        ) : null}
      </div>

      <ul className="pet-photos__list" aria-label="Photo list">
        {photos.map((photo, index) => (
          <li
            key={photo.id}
            className="pet-photos__item"
            draggable={!disabled}
            onDragStart={handleDragStart(index)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleDrop(index)}
          >
            <img
              className="pet-photos__thumb"
              src={photo.url}
              alt={photo.alt || `Photo ${index + 1}`}
            />
            <div className="pet-photos__actions">
              <button
                type="button"
                disabled={disabled || index === 0}
                onClick={() => move(index, index - 1)}
                aria-label={`Move ${photo.alt || `photo ${index + 1}`} up`}
              >
                Move up
              </button>
              <button
                type="button"
                disabled={disabled || index === photos.length - 1}
                onClick={() => move(index, index + 1)}
                aria-label={`Move ${photo.alt || `photo ${index + 1}`} down`}
              >
                Move down
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={(event) => openPreview(photo, event.currentTarget)}
                aria-label={`Preview ${photo.alt || `photo ${index + 1}`}`}
              >
                Preview
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={(event) => requestRemoval(photo, event.currentTarget)}
                aria-label={`Remove ${photo.alt || `photo ${index + 1}`}`}
              >
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div
        id={liveRegionId}
        className="pet-photos__live"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {announcement}
      </div>

      {previewPhoto ? (
        <div
          className="pet-photos__modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby={previewTitleId}
        >
          <h2 id={previewTitleId}>Photo preview</h2>
          <img
            className="pet-photos__preview"
            src={previewPhoto.url}
            alt={previewPhoto.alt || 'Selected pet photo'}
          />
          <button ref={previewCloseRef} type="button" onClick={closePreview}>
            Close preview
          </button>
        </div>
      ) : null}

      {pendingRemoval ? (
        <div
          className="pet-photos__modal"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby={removeTitleId}
        >
          <h2 id={removeTitleId}>Remove photo?</h2>
          <p>
            {pendingRemoval.alt || 'This photo'} will be removed from your pet's
            profile.
          </p>
          <button ref={removeConfirmRef} type="button" onClick={confirmRemoval}>
            Confirm remove
          </button>
          <button type="button" onClick={cancelRemoval}>
            Cancel
          </button>
        </div>
      ) : null}
    </section>
  );
}
