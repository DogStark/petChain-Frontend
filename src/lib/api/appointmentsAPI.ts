import axios, { AxiosInstance, isAxiosError } from 'axios';
import { getApiBaseUrl } from './apiBaseUrl';
import { Appointment, AppointmentStatus, AppointmentType } from '@/types/appointments';

const API_BASE_URL = getApiBaseUrl();

interface BackendPet {
  id: string;
  name: string;
}

interface BackendVetClinic {
  id: string;
  name: string;
}

interface BackendAppointment {
  id: string;
  petId: string;
  vetClinicId: string;
  scheduledDate: string;
  duration?: number;
  status: string;
  type: string;
  notes?: string;
  veterinarianName?: string;
  createdAt: string;
  updatedAt: string;
  pet?: BackendPet;
  vetClinic?: BackendVetClinic;
}

export interface UpcomingAppointmentView {
  appointment: Appointment;
  petName: string;
  vetName: string;
}

const STATUS_MAP: Record<string, AppointmentStatus> = {
  SCHEDULED: 'Scheduled',
  CONFIRMED: 'Scheduled',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  NO_SHOW: 'No-Show',
};

const TYPE_MAP: Record<string, AppointmentType> = {
  VACCINATION: 'Vaccination',
  CHECKUP: 'Checkup',
  EMERGENCY: 'Emergency',
  GROOMING: 'Dental',
  OTHER: 'Consultation',
};

function mapAppointment(item: BackendAppointment): UpcomingAppointmentView {
  const appointment: Appointment = {
    id: item.id,
    pet_id: item.petId,
    vet_id: item.vetClinicId,
    appointment_type: TYPE_MAP[item.type] || 'Consultation',
    scheduled_at: item.scheduledDate,
    duration: item.duration ?? 30,
    status: STATUS_MAP[item.status] || 'Scheduled',
    notes: item.notes,
    reminder_sent: false,
    created_at: item.createdAt,
    updated_at: item.updatedAt,
  };

  return {
    appointment,
    petName: item.pet?.name || 'Unknown pet',
    vetName: item.veterinarianName || item.vetClinic?.name || 'Veterinarian',
  };
}

class AppointmentsAPI {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: `${API_BASE_URL}/appointments`,
      withCredentials: true,
    });

    this.api.interceptors.request.use((config) => {
      if (typeof window !== 'undefined') {
        const token = localStorage.getItem('authToken');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      }
      return config;
    });
  }

  async getUpcomingAppointments(): Promise<UpcomingAppointmentView[]> {
    const response = await this.api.get<BackendAppointment[]>('/upcoming');
    return response.data.map(mapAppointment);
  }
}

export const appointmentsAPI = new AppointmentsAPI();
export { isAxiosError };
