import React, { useState, useRef, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Plus,
  GripVertical,
  Trash2,
  UserPlus,
  ShieldAlert,
  Phone,
  Stethoscope,
  AlertTriangle,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { PetEmergencyInfo, EmergencyContact } from '../../types/pet';
import styles from './EmergencyContactForm.module.css';

interface SortableContactCardProps {
  contact: EmergencyContact;
  styles: Record<string, string>;
  onFieldChange: (id: string, field: keyof EmergencyContact, value: string) => void;
  onRemove: (id: string) => void;
}

function SortableContactCard({ contact, styles, onFieldChange, onRemove }: SortableContactCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: contact.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} className={styles.contactCard}>
      <div className={styles.dragHandle} {...attributes} {...listeners} style={{ cursor: 'grab' }}>
        <GripVertical size={20} />
      </div>
      <div className={styles.grid}>
        <div className={styles.formGroup}>
          <input
            className={styles.input}
            placeholder="Full Name"
            value={contact.name}
            onChange={(e) => onFieldChange(contact.id, 'name', e.target.value)}
          />
        </div>
        <div className={styles.formGroup}>
          <input
            className={styles.input}
            placeholder="Relationship (e.g. Spouse)"
            value={contact.relationship}
            onChange={(e) => onFieldChange(contact.id, 'relationship', e.target.value)}
          />
        </div>
        <div className={styles.formGroup}>
          <input
            className={styles.input}
            placeholder="Phone Number"
            value={contact.phone}
            onChange={(e) => onFieldChange(contact.id, 'phone', e.target.value)}
          />
        </div>
        <div className={styles.formGroup}>
          <input
            className={styles.input}
            placeholder="Email (Optional)"
            value={contact.email || ''}
            onChange={(e) => onFieldChange(contact.id, 'email', e.target.value)}
          />
        </div>
      </div>
      <button
        type="button"
        className={`${styles.iconBtn} ${styles.deleteBtn}`}
        onClick={() => onRemove(contact.id)}
      >
        <Trash2 size={18} />
      </button>
    </div>
  );
}

interface EmergencyContactFormProps {
  initialData?: PetEmergencyInfo;
  onSave: (data: PetEmergencyInfo) => Promise<void>;
  isLoading?: boolean;
}

/**
 * Normalise priorities so they are unique consecutive integers starting at 1,
 * ordered by the current array order.
 */
function normalisePriorities(contacts: EmergencyContact[]): EmergencyContact[] {
  return contacts.map((c, i) => ({ ...c, priority: i + 1 }));
}

export const EmergencyContactForm: React.FC<EmergencyContactFormProps> = ({
  initialData,
  onSave,
  isLoading = false,
}) => {
  const [formData, setFormData] = useState<PetEmergencyInfo>(() => {
    const base = initialData || { petId: 'unknown', contacts: [], medicalNotes: '' };
    // Ensure priorities are unique and consecutive on initial load
    return { ...base, contacts: normalisePriorities([...base.contacts].sort((a, b) => a.priority - b.priority)) };
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  /**
   * Live-region message for screen-reader announcements after reorder actions.
   * The ref tracks the last message so we can force re-announcement by appending
   * a zero-width space when the same contact moves again.
   */
  const [announcement, setAnnouncement] = useState('');
  const announcementCountRef = useRef(0);

  const announce = useCallback((msg: string) => {
    // Append a cycle counter so the same message re-triggers the live region.
    announcementCountRef.current += 1;
    setAnnouncement(`${msg}\u200B${announcementCountRef.current % 2 === 0 ? '\u200B' : ''}`);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const normalizePriorities = (contacts: EmergencyContact[]): EmergencyContact[] =>
    contacts.map((c, i) => ({ ...c, priority: i + 1 }));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setFormData((prev) => {
      const oldIndex = prev.contacts.findIndex((c) => c.id === active.id);
      const newIndex = prev.contacts.findIndex((c) => c.id === over.id);
      const reordered = arrayMove(prev.contacts, oldIndex, newIndex);
      return { ...prev, contacts: normalizePriorities(reordered) };
    });
  };

  const handleContactChange = (id: string, field: keyof EmergencyContact, value: string) => {
    setFormData((prev) => ({
      ...prev,
      contacts: prev.contacts.map((c) =>
        c.id === id ? { ...c, [field]: value } : c
      ),
    }));
  };

  const addContact = () => {
    const newContact: EmergencyContact = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: '',
      relationship: '',
      phone: '',
      priority: 0, // will be normalized
    };
    setFormData((prev) => ({
      ...prev,
      contacts: normalisePriorities([...prev.contacts, newContact]),
    }));
  };

  const removeContact = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      contacts: normalisePriorities(prev.contacts.filter((c) => c.id !== id)),
    }));
    announce('Contact removed');
  };

  /**
   * Move a contact up or down in priority order.
   * "Move up" means higher priority (lower index).
   */
  const moveContact = useCallback((id: string, direction: 'up' | 'down') => {
    setFormData((prev) => {
      const contacts = [...prev.contacts];
      const idx = contacts.findIndex((c) => c.id === id);
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= contacts.length) return prev;

      // Swap
      [contacts[idx], contacts[swapIdx]] = [contacts[swapIdx], contacts[idx]];
      const normalised = normalisePriorities(contacts);

      const movedContact = normalised.find((c) => c.id === id);
      const displayName = movedContact?.name || 'Contact';
      announce(
        `${displayName} moved ${direction === 'up' ? 'up' : 'down'} to priority ${movedContact?.priority ?? ''}`
      );

      return { ...prev, contacts: normalised };
    });
  }, [announce]);

  const handleVetChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({
      ...prev,
      emergencyVet: {
        ...(prev.emergencyVet || { name: '', phone: '', address: '', is24Hours: false }),
        [field]: value,
      },
    }));
  };

  const handlePoisonChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      poisonControl: {
        ...(prev.poisonControl || { name: '', phone: '' }),
        [field]: value,
      },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSave(formData);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>
      {/* Live region for screen-reader announcements */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={styles.srOnly}
      >
        {announcement}
      </div>

      <h2 className={styles.title}>
        <ShieldAlert size={28} color="#ef4444" />
        Emergency Contacts &amp; Info
      </h2>

      <form onSubmit={handleSubmit}>
        {/* Emergency Contacts Section */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>
            <UserPlus size={18} /> Primary Contacts (reorder for priority)
          </h3>
          <div
            className={styles.contactList}
            role="list"
            aria-label="Emergency contacts list"
          >
            {formData.contacts.map((contact, index) => (
              <div
                key={contact.id}
                className={styles.contactCard}
                role="listitem"
                aria-label={`Contact ${contact.priority}: ${contact.name || 'Unnamed contact'}`}
              >
                {/* Visual drag handle (decorative, keyboard handled below) */}
                <div className={styles.dragHandle} aria-hidden="true">
                  <GripVertical size={20} />
                </div>

                {/* Keyboard reorder buttons */}
                <div className={styles.reorderButtons}>
                  <button
                    type="button"
                    className={styles.iconBtn}
                    onClick={() => moveContact(contact.id, 'up')}
                    disabled={index === 0}
                    aria-label={`Move ${contact.name || 'contact'} up in priority`}
                    aria-disabled={index === 0}
                  >
                    <ChevronUp size={16} />
                  </button>
                  <button
                    type="button"
                    className={styles.iconBtn}
                    onClick={() => moveContact(contact.id, 'down')}
                    disabled={index === formData.contacts.length - 1}
                    aria-label={`Move ${contact.name || 'contact'} down in priority`}
                    aria-disabled={index === formData.contacts.length - 1}
                  >
                    <ChevronDown size={16} />
                  </button>
                </div>

                {/* Priority badge */}
                <span className={styles.priorityBadge} aria-hidden="true">
                  #{contact.priority}
                </span>

                <div className={styles.grid}>
                  <div className={styles.formGroup}>
                    <input
                      className={styles.input}
                      placeholder="Full Name"
                      value={contact.name}
                      aria-label={`Contact ${contact.priority} full name`}
                      onChange={(e) => handleContactChange(contact.id, 'name', e.target.value)}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <input
                      className={styles.input}
                      placeholder="Relationship (e.g. Spouse)"
                      value={contact.relationship}
                      aria-label={`Contact ${contact.priority} relationship`}
                      onChange={(e) =>
                        handleContactChange(contact.id, 'relationship', e.target.value)
                      }
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <input
                      className={styles.input}
                      placeholder="Phone Number"
                      value={contact.phone}
                      aria-label={`Contact ${contact.priority} phone number`}
                      onChange={(e) => handleContactChange(contact.id, 'phone', e.target.value)}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <input
                      className={styles.input}
                      placeholder="Email (Optional)"
                      value={contact.email || ''}
                      aria-label={`Contact ${contact.priority} email address`}
                      onChange={(e) => handleContactChange(contact.id, 'email', e.target.value)}
                    />
                  </div>
                </div>
                <button
                  type="button"
                  className={`${styles.iconBtn} ${styles.deleteBtn}`}
                  onClick={() => removeContact(contact.id)}
                  aria-label={`Remove contact ${contact.name || contact.priority}`}
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
            <button type="button" className={styles.addBtn} onClick={addContact}>
              <Plus size={18} /> Add Contact
            </button>
          </div>
        </div>

        {/* 24/7 Vet Info Section */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>
            <Stethoscope size={18} /> 24/7 Emergency Vet
          </h3>
          <div className={styles.grid}>
            <div className={styles.formGroup}>
              <label className={styles.label} htmlFor="vet-name">Clinic Name</label>
              <input
                id="vet-name"
                className={styles.input}
                value={formData.emergencyVet?.name || ''}
                onChange={(e) => handleVetChange('name', e.target.value)}
                placeholder="e.g. City Animal ER"
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label} htmlFor="vet-phone">Phone Number</label>
              <input
                id="vet-phone"
                className={styles.input}
                value={formData.emergencyVet?.phone || ''}
                onChange={(e) => handleVetChange('phone', e.target.value)}
                placeholder="+1 (555) 000-0000"
              />
            </div>
          </div>
          <div className={styles.formGroup} style={{ marginTop: '1rem' }}>
            <label className={styles.label} htmlFor="vet-address">Address</label>
            <input
              id="vet-address"
              className={styles.input}
              value={formData.emergencyVet?.address || ''}
              onChange={(e) => handleVetChange('address', e.target.value)}
              placeholder="123 Care St, Pet City"
            />
          </div>
          <div
            className={styles.formGroup}
            style={{ marginTop: '1rem', flexDirection: 'row', alignItems: 'center' }}
          >
            <input
              type="checkbox"
              id="is24Hours"
              checked={formData.emergencyVet?.is24Hours || false}
              onChange={(e) => handleVetChange('is24Hours', e.target.checked)}
            />
            <label htmlFor="is24Hours" className={styles.label} style={{ marginLeft: '0.5rem' }}>
              Confirmed 24/7 Service
            </label>
          </div>
        </div>

        {/* Poison Control Section */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>
            <Phone size={18} /> Poison Control
          </h3>
          <div className={styles.grid}>
            <div className={styles.formGroup}>
              <label className={styles.label} htmlFor="poison-name">Service Name</label>
              <input
                id="poison-name"
                className={styles.input}
                value={formData.poisonControl?.name || ''}
                onChange={(e) => handlePoisonChange('name', e.target.value)}
                placeholder="e.g. ASPCA Poison Control"
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label} htmlFor="poison-phone">Phone Number</label>
              <input
                id="poison-phone"
                className={styles.input}
                value={formData.poisonControl?.phone || ''}
                onChange={(e) => handlePoisonChange('phone', e.target.value)}
                placeholder="(888) 426-4435"
              />
            </div>
          </div>
        </div>

        {/* Critical Medical Notes */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>
            <AlertTriangle size={18} /> Critical medical notes
          </h3>
          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="medical-notes">Medical notes</label>
            <textarea
              id="medical-notes"
              className={`${styles.input} ${styles.textarea}`}
              value={formData.medicalNotes || ''}
              onChange={(e) => setFormData((prev) => ({ ...prev, medicalNotes: e.target.value }))}
              placeholder="Explicitly list any allergies, chronic conditions, or required medications that an emergency responder MUST know."
            />
          </div>
        </div>

        <div className={styles.saveActions}>
          <button type="submit" className={styles.saveBtn} disabled={isSubmitting || isLoading}>
            {isSubmitting ? 'Saving...' : 'Save Emergency Info'}
          </button>
        </div>
      </form>
    </div>
  );
};
