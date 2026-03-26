import React, { useState } from 'react';
import { X } from 'lucide-react';
import { AppointmentType } from '@/types/appointments';
import { TouchSelect, TouchDatePicker, TouchPillGroup, TouchTextarea, TouchButton } from '@/components/TouchUI';
import { useHaptic } from '@/hooks/useHaptic';

interface BookingModalProps {
  onClose: () => void;
}

const APPOINTMENT_TYPES: { value: AppointmentType; label: string; color: string }[] = [
  { value: 'Checkup',      label: 'Checkup',      color: 'bg-green-100 text-green-700 border-green-200' },
  { value: 'Emergency',    label: 'Emergency',    color: 'bg-red-100 text-red-700 border-red-200' },
  { value: 'Surgery',      label: 'Surgery',      color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'Vaccination',  label: 'Vaccination',  color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { value: 'Dental',       label: 'Dental',       color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  { value: 'Consultation', label: 'Consultation', color: 'bg-pink-100 text-pink-700 border-pink-200' },
];

const PET_OPTIONS = [
  { value: 'pet1', label: 'Bella (Golden Retriever)' },
  { value: 'pet2', label: 'Max (Siamese Cat)' },
  { value: 'pet3', label: 'Luna (Rabbit)' },
];

const VET_OPTIONS = [
  { value: 'vet1', label: 'Dr. Sarah Miller (General)' },
  { value: 'vet2', label: 'Dr. James Wilson (Surgeon)' },
  { value: 'vet3', label: 'Dr. Emily Chen (Emergency)' },
];

const TIME_OPTIONS = [
  { value: '09:00', label: '09:00 AM' },
  { value: '10:00', label: '10:00 AM' },
  { value: '11:00', label: '11:00 AM' },
  { value: '14:00', label: '02:00 PM' },
  { value: '15:00', label: '03:00 PM' },
];

export default function BookingModal({ onClose }: BookingModalProps) {
  const { trigger } = useHaptic();
  const [formData, setFormData] = useState({
    pet_id: '',
    vet_id: '',
    appointment_type: 'Checkup' as AppointmentType,
    date: '',
    time: '09:00',
    notes: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validate = () => {
    const next: Record<string, string> = {};
    if (!formData.pet_id) next.pet_id = 'Please select a pet';
    if (!formData.vet_id) next.vet_id = 'Please select a vet';
    if (!formData.date) next.date = 'Please pick a date';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!validate()) {
      trigger('error');
      return;
    }
    setIsSubmitting(true);
    try {
      // Simulate API call
      await new Promise(r => setTimeout(r, 600));
      trigger('success');
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  // Close on backdrop tap
  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="booking-modal-title"
      onClick={handleBackdrop}
    >
      {/* Sheet slides up on mobile, centered modal on desktop */}
      <div className="bg-white w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden animate-slide-up max-h-[92dvh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          {/* Drag handle (mobile) */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 bg-gray-200 rounded-full sm:hidden" aria-hidden="true" />
          <h2 id="booking-modal-title" className="text-xl font-bold text-blue-900">Book Appointment</h2>
          <button
            onClick={onClose}
            aria-label="Close booking modal"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable form body */}
        <form onSubmit={handleSubmit} noValidate className="overflow-y-auto flex-1 px-5 py-5 space-y-5">
          <TouchSelect
            label="Select pet"
            options={PET_OPTIONS}
            placeholder="Choose your pet"
            value={formData.pet_id}
            onChange={e => setFormData(f => ({ ...f, pet_id: e.target.value }))}
            required
            error={errors.pet_id}
          />

          <TouchPillGroup
            label="Appointment type"
            options={APPOINTMENT_TYPES}
            value={formData.appointment_type}
            onChange={v => setFormData(f => ({ ...f, appointment_type: v }))}
          />

          <div className="grid grid-cols-2 gap-3">
            <TouchDatePicker
              label="Date"
              value={formData.date}
              onChange={e => setFormData(f => ({ ...f, date: e.target.value }))}
              min={new Date().toISOString().split('T')[0]}
              required
              error={errors.date}
            />
            <TouchSelect
              label="Time"
              options={TIME_OPTIONS}
              value={formData.time}
              onChange={e => setFormData(f => ({ ...f, time: e.target.value }))}
            />
          </div>

          <TouchSelect
            label="Veterinarian"
            options={VET_OPTIONS}
            placeholder="Select a vet"
            value={formData.vet_id}
            onChange={e => setFormData(f => ({ ...f, vet_id: e.target.value }))}
            required
            error={errors.vet_id}
          />

          <TouchTextarea
            label="Notes (optional)"
            value={formData.notes}
            onChange={e => setFormData(f => ({ ...f, notes: e.target.value }))}
            placeholder="Any special instructions or concerns…"
            rows={3}
          />
        </form>

        {/* Footer actions */}
        <div className="px-5 py-4 border-t border-gray-100 flex gap-3 shrink-0">
          <TouchButton variant="secondary" onClick={onClose} fullWidth haptic="light">
            Cancel
          </TouchButton>
          <TouchButton
            type="submit"
            fullWidth
            loading={isSubmitting}
            haptic="medium"
            onClick={handleSubmit as unknown as React.MouseEventHandler}
          >
            Confirm booking
          </TouchButton>
        </div>
      </div>
    </div>
  );
}
