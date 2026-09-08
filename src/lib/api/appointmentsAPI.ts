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
    petId: item.petId,
    vetId: item.vetClinicId,
    appointmentType: TYPE_MAP[item.type] || 'Consultation',
    scheduledAt: item.scheduledDate,
    duration: item.duration ?? 30,
    status: STATUS_MAP[item.status] || 'Scheduled',
    notes: item.notes,
    reminderSent: false,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };

  return {
    appointment,
    petName: item.pet?.name || 'Unknown pet',
    vetName: item.veterinarianName || item.vetClinic?.name || 'Veterinarian',
  };
}

export interface CreateAppointmentDto {
  petId: string;
  vetId: string;
  appointmentType: AppointmentType;
  date: string;
  time: string;
  notes?: string;
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

  async createAppointment(dto: CreateAppointmentDto): Promise<Appointment> {
    // Map camelCase DTO to the backend's expected shape
    const payload = {
      petId: dto.petId,
      vetClinicId: dto.vetId,
      type: dto.appointmentType.toUpperCase(),
      scheduledDate: `${dto.date}T${dto.time}:00`,
      notes: dto.notes,
    };
    const response = await this.api.post<BackendAppointment>('/', payload);
    return mapAppointment(response.data).appointment;
  }

  async getWaitlist(): Promise<Array<{ id: string; petName: string; type: string; joinedAt: string }>> {
    const response = await this.api.get('/waitlist');
    return response.data;
  }

  async addToWaitlist(petId: string, type: string): Promise<void> {
    await this.api.post('/waitlist', { petId, type });
  }

  async removeFromWaitlist(entryId: string): Promise<void> {
    await this.api.delete(`/waitlist/${entryId}`);
  }

  async scheduleFromWaitlist(entryId: string): Promise<void> {
    await this.api.patch(`/waitlist/${entryId}/schedule`);
  }
}

export const appointmentsAPI = new AppointmentsAPI();
export { isAxiosError };
