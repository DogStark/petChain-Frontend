export type AppointmentType =
  | "Checkup"
  | "Emergency"
  | "Surgery"
  | "Vaccination"
  | "Dental"
  | "Consultation";
export type AppointmentStatus =
  | "Scheduled"
  | "Completed"
  | "Cancelled"
  | "No-Show";

export interface Appointment {
  id: string;
  pet_id: string;
  vet_id: string;
  appointment_type: AppointmentType;
  scheduled_at: string; // ISO string
  duration: number; // in minutes
  status: AppointmentStatus;
  notes?: string;
  reminder_sent: boolean;
  is_recurring?: boolean;
  recurrence_pattern?: string;
  created_at: string;
  updated_at: string;
}

export interface Vet {
  id: string;
  name: string;
  specialty: string[];
  avatar?: string;
}

export interface Availability {
  vet_id: string;
  day_of_week: number; // 0-6
  start_time: string; // HH:mm
  end_time: string; // HH:mm
  is_active: boolean;
}

export interface WaitlistEntry {
  id: string;
  pet_id: string;
  preferred_type: AppointmentType;
  preferred_vet_id?: string;
  created_at: string;
}
