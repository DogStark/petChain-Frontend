import React, { useState } from 'react';
import { Surgery, CreateSurgeryDto, SurgeryStatus } from '../../lib/api/surgeryAPI';
import styles from './SurgeryForm.module.css';

interface SurgeryFormProps {
  surgery?: Surgery;
  petId: string;
  onSubmit: (data: CreateSurgeryDto, photos?: File[]) => Promise<void>;
  onCancel: () => void;
}

export const SurgeryForm: React.FC<SurgeryFormProps> = ({ surgery, petId, onSubmit, onCancel }) => {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
        <label>Surgery Type</label>
        <input
          type="text"
          value={formData.surgeryType}
          onChange={(e) => setFormData({ ...formData, surgeryType: e.target.value })}
          required
        />
      </div>

      <div className={styles.field}>
        <label>Surgery Date</label>
        <input
          type="date"
          value={formData.surgeryDate}
          onChange={(e) => setFormData({ ...formData, surgeryDate: e.target.value })}
          required
        />
      </div>

      <div className={styles.field}>
        <label>Status</label>
        <select
          value={formData.status}
          onChange={(e) => setFormData({ ...formData, status: e.target.value as SurgeryStatus })}
        >
          {Object.values(SurgeryStatus).map((status) => (
            <option key={status} value={status}>{status}</option>
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
            onChange={(e) => setFormData({
              ...formData,
              anesthesiaDetails: { ...formData.anesthesiaDetails, type: e.target.value }
            })}
          />
        </div>
        <div className={styles.field}>
          <label>Dosage</label>
          <input
            type="text"
            value={formData.anesthesiaDetails?.dosage || ''}
            onChange={(e) => setFormData({
              ...formData,
              anesthesiaDetails: { ...formData.anesthesiaDetails, dosage: e.target.value }
            })}
          />
        </div>
        <div className={styles.field}>
          <label>Duration (minutes)</label>
          <input
            type="number"
            value={formData.anesthesiaDetails?.duration || ''}
            onChange={(e) => setFormData({
              ...formData,
              anesthesiaDetails: { ...formData.anesthesiaDetails, duration: parseInt(e.target.value) }
            })}
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
        <button type="submit" disabled={loading}>{loading ? 'Saving...' : 'Save'}</button>
        <button type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
};
