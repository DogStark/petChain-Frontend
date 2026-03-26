import React, { useState } from 'react';
import {
    Plus,
    GripVertical,
    Trash2,
    UserPlus,
    ShieldAlert,
    Phone,
    Stethoscope,
    AlertTriangle
} from 'lucide-react';
import { PetEmergencyInfo, EmergencyContact } from '../../types/pet';
import styles from './EmergencyContactForm.module.css';

interface EmergencyContactFormProps {
    initialData?: PetEmergencyInfo;
    onSave: (data: PetEmergencyInfo) => Promise<void>;
    isLoading?: boolean;
}

export const EmergencyContactForm: React.FC<EmergencyContactFormProps> = ({
    initialData,
    onSave,
    isLoading = false,
}) => {
    const [formData, setFormData] = useState<PetEmergencyInfo>(initialData || {
        petId: 'unknown', // This should be passed in ideally
        contacts: [],
        medicalNotes: '',
    });

    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleContactChange = (id: string, field: keyof EmergencyContact, value: string) => {
        setFormData((prev: PetEmergencyInfo) => ({
            ...prev,
            contacts: prev.contacts.map((c: EmergencyContact) => c.id === id ? { ...c, [field]: value } : c)
        }));
    };

    const addContact = () => {
        const newContact: EmergencyContact = {
            id: Date.now().toString(),
            name: '',
            relationship: '',
            phone: '',
            priority: formData.contacts.length + 1,
        };
        setFormData((prev: PetEmergencyInfo) => ({
            ...prev,
            contacts: [...prev.contacts, newContact]
        }));
    };

    const removeContact = (id: string) => {
        setFormData((prev: PetEmergencyInfo) => ({
            ...prev,
            contacts: prev.contacts.filter((c: EmergencyContact) => c.id !== id)
        }));
    };

    const handleVetChange = (field: string, value: string | boolean) => {
        setFormData((prev: PetEmergencyInfo) => ({
            ...prev,
            emergencyVet: {
                ...(prev.emergencyVet || { name: '', phone: '', address: '', is24Hours: false }),
                [field]: value
            }
        }));
    };

    const handlePoisonChange = (field: string, value: string) => {
        setFormData((prev: PetEmergencyInfo) => ({
            ...prev,
            poisonControl: {
                ...(prev.poisonControl || { name: '', phone: '' }),
                [field]: value
            }
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
            <h2 className={styles.title}>
                <ShieldAlert size={28} color="#ef4444" />
                Emergency Contacts & Info
            </h2>

            <form onSubmit={handleSubmit}>
                {/* Emergency Contacts Section */}
                <div className={styles.section}>
                    <h3 className={styles.sectionTitle}>
                        <UserPlus size={18} /> Primary Contacts (reorder for priority)
                    </h3>
                    <div className={styles.contactList}>
                        {formData.contacts.sort((a: EmergencyContact, b: EmergencyContact) => a.priority - b.priority).map((contact: EmergencyContact) => (
                            <div key={contact.id} className={styles.contactCard}>
                                <div className={styles.dragHandle}>
                                    <GripVertical size={20} />
                                </div>
                                <div className={styles.grid}>
                                    <div className={styles.formGroup}>
                                        <input
                                            className={styles.input}
                                            placeholder="Full Name"
                                            value={contact.name}
                                            onChange={(e) => handleContactChange(contact.id, 'name', e.target.value)}
                                        />
                                    </div>
                                    <div className={styles.formGroup}>
                                        <input
                                            className={styles.input}
                                            placeholder="Relationship (e.g. Spouse)"
                                            value={contact.relationship}
                                            onChange={(e) => handleContactChange(contact.id, 'relationship', e.target.value)}
                                        />
                                    </div>
                                    <div className={styles.formGroup}>
                                        <input
                                            className={styles.input}
                                            placeholder="Phone Number"
                                            value={contact.phone}
                                            onChange={(e) => handleContactChange(contact.id, 'phone', e.target.value)}
                                        />
                                    </div>
                                    <div className={styles.formGroup}>
                                        <input
                                            className={styles.input}
                                            placeholder="Email (Optional)"
                                            value={contact.email || ''}
                                            onChange={(e) => handleContactChange(contact.id, 'email', e.target.value)}
                                        />
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    className={`${styles.iconBtn} ${styles.deleteBtn}`}
                                    onClick={() => removeContact(contact.id)}
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
                            <label className={styles.label}>Clinic Name</label>
                            <input
                                className={styles.input}
                                value={formData.emergencyVet?.name || ''}
                                onChange={(e) => handleVetChange('name', e.target.value)}
                                placeholder="e.g. City Animal ER"
                            />
                        </div>
                        <div className={styles.formGroup}>
                            <label className={styles.label}>Phone Number</label>
                            <input
                                className={styles.input}
                                value={formData.emergencyVet?.phone || ''}
                                onChange={(e) => handleVetChange('phone', e.target.value)}
                                placeholder="+1 (555) 000-0000"
                            />
                        </div>
                    </div>
                    <div className={styles.formGroup} style={{ marginTop: '1rem' }}>
                        <label className={styles.label}>Address</label>
                        <input
                            className={styles.input}
                            value={formData.emergencyVet?.address || ''}
                            onChange={(e) => handleVetChange('address', e.target.value)}
                            placeholder="123 Care St, Pet City"
                        />
                    </div>
                    <div className={styles.formGroup} style={{ marginTop: '1rem', flexDirection: 'row', alignItems: 'center' }}>
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
                            <label className={styles.label}>Service Name</label>
                            <input
                                className={styles.input}
                                value={formData.poisonControl?.name || ''}
                                onChange={(e) => handlePoisonChange('name', e.target.value)}
                                placeholder="e.g. ASPCA Poison Control"
                            />
                        </div>
                        <div className={styles.formGroup}>
                            <label className={styles.label}>Phone Number</label>
                            <input
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
                        <textarea
                            className={`${styles.input} ${styles.textarea}`}
                            value={formData.medicalNotes || ''}
                            onChange={(e) => setFormData(prev => ({ ...prev, medicalNotes: e.target.value }))}
                            placeholder="Explicitly list any allergies, chronic conditions, or required medications that an emergency responder MUST know."
                        />
                    </div>
                </div>

                <div className={styles.saveActions}>
                    <button
                        type="submit"
                        className={styles.saveBtn}
                        disabled={isSubmitting || isLoading}
                    >
                        {isSubmitting ? 'Saving...' : 'Save Emergency Info'}
                    </button>
                </div>
            </form>
        </div>
    );
};
