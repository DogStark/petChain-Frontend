import React, { useState, useCallback } from 'react';
import { Surgery, CreateSurgeryDto, SurgeryStatus } from '../../lib/api/surgeryAPI';
import {
  validateNotFuture,
  validateAfterBirth,
  validateDateOrdering,
} from '../../lib/validation/dateValidation';
import styles from './SurgeryForm.module.css';

interface SurgeryFormProps {
  surgery?: Surgery;
  petId: string;
  petDateOfBirth?: string;
  onSubmit: (data: CreateSurgeryDto, photos?: File[]) => Promise<void>;
  onCancel: () => void;
}

export const SurgeryForm: React.FC<SurgeryFormProps> = ({
  surgery,
  petId,
  petDateOfBirth,
  onSubmit,
  onCancel,
}) => {
  const [formData, setFormData] = useState<CreateSurgeryDto>({
    petId: surgery?.petId || petId,
    surgeryType: surgery?.surgeryType || '',
    surgeryDate: surgery?.surgeryDate || '',
    status: surgery?.status || SurgeryStatus.SCHEDULED,
    preOpNotes: surgery?.preOpNotes || '',
    postOpNotes: surgery?.postOpNotes || '',
    anesthesiaDetails: surgery?.anesthesiaDetails || {},
    complications: surgery?.complications || [],
    recoveryTimeline: surgery?.recoveryTimeline || { expectedDays: 0, milestones: [] },
  });
  const [photos, setPhotos] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = useCallback((): boolean => {
    const next: Record<string, string> = {};

    const futureError = validateNotFuture(formData.surgeryDate, 'Surgery date');
    if (futureError) next.surgeryDate = futureError;

    if (petDateOfBirth) {
      const birthError = validateAfterBirth(formData.surgeryDate, petDateOfBirth, 'Surgery date');
      if (birthError) next.surgeryDate = birthError;
    }

    const orderingErrors = validateDateOrdering({
      surgeryDate: formData.surgeryDate,
    });
    Object.assign(next, orderingErrors);

    setErrors(next);
    return Object.keys(next).length === 0;
  }, [formData.surgeryDate, petDateOfBirth]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      return;
    }
    setLoading(true);
    try {
      await onSubmit(formData, photos);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <div className={styles.field}>
        <label htmlFor="surgeryType">Surgery Type</label>
        <input
          id="surgeryType"
          type="text"
          value={formData.surgeryType}
          onChange={(e) => setFormData({ ...formData, surgeryType: e.target.value })}
          required
          aria-required="true"
          aria-invalid={!formData.surgeryType ? 'true' : 'false'}
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="surgeryDate">Surgery Date</label>
        <input
          id="surgeryDate"
          type="date"
          value={formData.surgeryDate}
          onChange={(e) => {
            setFormData({ ...formData, surgeryDate: e.target.value });
            if (errors.surgeryDate) {
              setErrors((prev) => {
                const next = { ...prev };
                delete next.surgeryDate;
                return next;
              });
            }
          }}
          required
          aria-required="true"
          aria-invalid={!!errors.surgeryDate ? 'true' : 'false'}
        />
        {errors.surgeryDate && (
          <p className={styles.fieldError} role="alert">
            {errors.surgeryDate}
          </p>
        )}
      </div>

      <div className={styles.field}>
        <label>Status</label>
        <select
          value={formData.status}
          onChange={(e) => setFormData({ ...formData, status: e.target.value as SurgeryStatus })}
        >
          {Object.values(SurgeryStatus).map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.field}>
        <label>Pre-Op Notes</label>
        <textarea
          value={formData.preOpNotes}
          onChange={(e) => setFormData({ ...formData, preOpNotes: e.target.value })}
          rows={3}
        />
      </div>

      <div className={styles.field}>
        <label>Post-Op Notes</label>
        <textarea
          value={formData.postOpNotes}
          onChange={(e) => setFormData({ ...formData, postOpNotes: e.target.value })}
          rows={3}
        />
      </div>

      <div className={styles.section}>
        <h3>Anesthesia Details</h3>
        <div className={styles.field}>
          <label>Type</label>
          <input
            type="text"
            value={formData.anesthesiaDetails?.type || ''}
            onChange={(e) =>
              setFormData({
                ...formData,
                anesthesiaDetails: { ...formData.anesthesiaDetails, type: e.target.value },
              })
            }
          />
        </div>
        <div className={styles.field}>
          <label>Dosage</label>
          <input
            type="text"
            value={formData.anesthesiaDetails?.dosage || ''}
            onChange={(e) =>
              setFormData({
                ...formData,
                anesthesiaDetails: { ...formData.anesthesiaDetails, dosage: e.target.value },
              })
            }
          />
        </div>
        <div className={styles.field}>
          <label>Duration (minutes)</label>
          <input
            type="number"
            value={formData.anesthesiaDetails?.duration || ''}
            onChange={(e) =>
              setFormData({
                ...formData,
                anesthesiaDetails: {
                  ...formData.anesthesiaDetails,
                  duration: parseInt(e.target.value),
                },
              })
            }
          />
        </div>
      </div>

      <div className={styles.field}>
        <label>Photos</label>
        <input
          type="file"
          multiple
          accept="image/*"
          onChange={(e) => setPhotos(Array.from(e.target.files || []))}
        />
      </div>

      <div className={styles.actions}>
        <button type="submit" disabled={loading}>
          {loading ? 'Saving...' : 'Save'}
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
};
