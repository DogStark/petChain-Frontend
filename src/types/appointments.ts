export type AppointmentType =
  | 'Checkup'
  | 'Emergency'
  | 'Surgery'
  | 'Vaccination'
  | 'Dental'
  | 'Consultation';
export type AppointmentStatus = 'Scheduled' | 'Completed' | 'Cancelled' | 'No-Show';

export interface Appointment {
  id: string;
  petId: string;
  vetId: string;
  appointmentType: AppointmentType;
  scheduledAt: string; // ISO string
  duration: number; // in minutes
  status: AppointmentStatus;
  notes?: string;
  reminderSent: boolean;
  isRecurring?: boolean;
  recurrencePattern?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Vet {
  id: string;
  name: string;
  specialty: string[];
  avatar?: string;
}

export interface Availability {
  vetId: string;
  dayOfWeek: number; // 0-6
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  isActive: boolean;
}

export interface WaitlistEntry {
  id: string;
  petId: string;
  preferredType: AppointmentType;
  preferredVetId?: string;
  createdAt: string;
}
