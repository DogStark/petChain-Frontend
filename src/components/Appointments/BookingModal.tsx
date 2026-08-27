import { X } from 'lucide-react';
import React, { useState, useEffect, useRef } from 'react';

import {
  TouchSelect,
  TouchDatePicker,
  TouchPillGroup,
  TouchTextarea,
  TouchButton,
} from '@/components/TouchUI';
import { useHaptic } from '@/hooks/useHaptic';
import { appointmentsAPI } from '@/lib/api/appointmentsAPI';
import type { AppointmentType } from '@/types/appointments';

interface BookingModalProps {
  onClose: () => void;
  /** Pre-select a clinic so the booking is scoped to it. */
  initialClinicId?: string;
  /** Display name of the pre-selected clinic shown in the modal header area. */
  initialClinicName?: string;
  /** Pre-select an appointment type when the modal is opened from a service card. */
  initialAppointmentType?: AppointmentType;
}

const APPOINTMENT_TYPES: { value: AppointmentType; label: string; color: string }[] = [
  { value: 'Checkup', label: 'Checkup', color: 'bg-green-100 text-green-700 border-green-200' },
  { value: 'Emergency', label: 'Emergency', color: 'bg-red-100 text-red-700 border-red-200' },
  { value: 'Surgery', label: 'Surgery', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  {
    value: 'Vaccination',
    label: 'Vaccination',
    color: 'bg-purple-100 text-purple-700 border-purple-200',
  },
  { value: 'Dental', label: 'Dental', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  {
    value: 'Consultation',
    label: 'Consultation',
    color: 'bg-pink-100 text-pink-700 border-pink-200',
  },
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

export default function BookingModal({
  onClose,
  initialClinicId,
  initialClinicName,
  initialAppointmentType,
}: BookingModalProps) {
  const { trigger } = useHaptic();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const lastFocusedElementRef = useRef<HTMLElement | null>(null);
  const [formData, setFormData] = useState({
    petId: '',
    vetId: initialClinicId ?? '',
    appointmentType: (initialAppointmentType ?? 'Checkup') as AppointmentType,
    date: '',
    time: '09:00',
    notes: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const validate = () => {
    const next: Record<string, string> = {};
    if (!formData.petId) next.petId = 'Please select a pet';
    // Only require vet selection when no clinic is pre-selected from a clinic profile
    if (!initialClinicId && !formData.vetId) next.vetId = 'Please select a vet';
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
    setSubmitError(null);
    try {
      await appointmentsAPI.createAppointment({
        petId: formData.petId,
        vetId: formData.vetId,
        appointmentType: formData.appointmentType,
        date: formData.date,
        time: formData.time,
        notes: formData.notes || undefined,
      });
      trigger('success');
      onClose();
    } catch (err) {
      const apiErr = err as { response?: { data?: { message?: string } }; message?: string };
      const errorMessage = apiErr.response?.data?.message || apiErr.message || 'Booking failed, please try again';
      setSubmitError(errorMessage);
      trigger('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Close on backdrop tap
  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const focusableSelectors = [
      'a[href]',
      'button:not([disabled])',
      'textarea:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(',');

    const focusableElements = Array.from(
      dialog.querySelectorAll<HTMLElement>(focusableSelectors)
    ).filter((el) => !el.hasAttribute('disabled'));

    if (focusableElements.length > 0) {
      focusableElements[0].focus();
    }

    lastFocusedElementRef.current = document.activeElement as HTMLElement;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab') return;

      if (focusableElements.length === 0) {
        event.preventDefault();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement as HTMLElement;

      if (event.shiftKey) {
        if (activeElement === firstElement || !dialog.contains(activeElement)) {
          event.preventDefault();
          lastElement.focus();
        }
      } else {
        if (activeElement === lastElement || !dialog.contains(activeElement)) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      lastFocusedElementRef.current?.focus();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="booking-modal-title"
      onClick={handleBackdrop}
    >
      {/* Sheet slides up on mobile, centered modal on desktop */}
      <div
        className="bg-white w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden animate-slide-up max-h-[92dvh] flex flex-col"
        ref={dialogRef}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          {/* Drag handle (mobile) */}
          <div
            className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 bg-gray-200 rounded-full sm:hidden"
            aria-hidden="true"
          />
          <div>
            <h2 id="booking-modal-title" className="text-xl font-bold text-blue-900">
              Book Appointment
            </h2>
            {initialClinicName && (
              <p className="text-sm text-blue-600 font-semibold mt-0.5">
                at {initialClinicName}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close booking modal"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable form body */}
        <form
          onSubmit={handleSubmit}
          noValidate
          className="overflow-y-auto flex-1 px-5 py-5 space-y-5"
        >
          {submitError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {submitError}
            </div>
          )}
          <TouchSelect
            label="Select pet"
            options={PET_OPTIONS}
            placeholder="Choose your pet"
            value={formData.petId}
            onChange={(e) => setFormData((f) => ({ ...f, petId: e.target.value }))}
            required
            aria-required="true"
            error={errors.petId}
          />

          <TouchPillGroup
            label="Appointment type"
            options={APPOINTMENT_TYPES}
            value={formData.appointmentType}
            onChange={(v) => setFormData((f) => ({ ...f, appointmentType: v }))}
          />

          <div className="grid grid-cols-2 gap-3">
            <TouchDatePicker
              label="Date"
              value={formData.date}
              onChange={(e) => setFormData((f) => ({ ...f, date: e.target.value }))}
              min={new Date().toISOString().split('T')[0]}
              required
              aria-required="true"
              error={errors.date}
            />
            <TouchSelect
              label="Time"
              options={TIME_OPTIONS}
              value={formData.time}
              onChange={(e) => setFormData((f) => ({ ...f, time: e.target.value }))}
            />
          </div>

          {initialClinicId && initialClinicName ? (
            /* Clinic pre-selected — show as a read-only "Veterinarian / Clinic" field */
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">
                Veterinarian / Clinic
              </label>
              <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl text-sm font-semibold text-blue-800">
                <span className="flex-1">{initialClinicName}</span>
                <span className="text-xs text-blue-400 uppercase tracking-wide font-bold">Pre-selected</span>
              </div>
            </div>
          ) : (
            <TouchSelect
              label="Veterinarian"
              options={VET_OPTIONS}
              placeholder="Select a vet"
              value={formData.vetId}
              onChange={(e) => setFormData((f) => ({ ...f, vetId: e.target.value }))}
              required
              aria-required="true"
              error={errors.vetId}
            />
          )}

          <TouchTextarea
            label="Notes (optional)"
            value={formData.notes}
            onChange={(e) => setFormData((f) => ({ ...f, notes: e.target.value }))}
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
