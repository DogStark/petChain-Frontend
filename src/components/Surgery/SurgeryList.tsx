import React from 'react';
import { Surgery } from '../../lib/api/surgeryAPI';
import styles from './SurgeryList.module.css';

interface SurgeryListProps {
  surgeries: Surgery[];
  onSelect: (surgery: Surgery) => void;
  onDelete: (id: string) => void;
}

export const SurgeryList: React.FC<SurgeryListProps> = ({ surgeries, onSelect, onDelete }) => {
  return (
    <div className={styles.list}>
      {surgeries.map((surgery) => (
        <div key={surgery.id} className={styles.card} onClick={() => onSelect(surgery)}>
          <div className={styles.header}>
            <h3>{surgery.surgeryType}</h3>
            <span className={`${styles.status} ${styles[surgery.status]}`}>{surgery.status}</span>
          </div>
          <p className={styles.date}>{new Date(surgery.surgeryDate).toLocaleDateString()}</p>
          {surgery.preOpNotes && <p className={styles.notes}>{surgery.preOpNotes}</p>}
          <div className={styles.actions}>
            <button onClick={(e) => { e.stopPropagation(); onDelete(surgery.id); }}>Delete</button>
          </div>
        </div>
      ))}
    </div>
  );
};
