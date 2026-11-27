import axios, { AxiosInstance, isAxiosError } from 'axios';
import { getApiBaseUrl } from './apiBaseUrl';
import { attachCorrelationInterceptor } from './correlationInterceptor';
import { Appointment, AppointmentStatus, AppointmentType } from '@/types/appointments';
import type { AppointmentHistoryPage, AppointmentHistoryTab } from '@/types/appointments';

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

export interface PetAppointmentsPage {
  data: BackendAppointment[];
  total?: number;
  page?: number;
  limit?: number;
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

const CREATE_TYPE_MAP: Record<AppointmentType, CreateAppointmentPayload['type']> = {
  Checkup: 'CHECKUP',
  Emergency: 'EMERGENCY',
  Surgery: 'OTHER',
  Vaccination: 'VACCINATION',
  Dental: 'GROOMING',
  Consultation: 'OTHER',
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

export interface CreateAppointmentPayload {
  petId: string;
  vetClinicId: string;
  scheduledDate: string;
  duration: 30;
  type: 'VACCINATION' | 'CHECKUP' | 'EMERGENCY' | 'GROOMING' | 'OTHER';
  reason?: string;
  notes?: string;
}

export class AppointmentBookingError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly availableSlots: string[];

  constructor(status: number, code?: string, availableSlots: string[] = []) {
    super(code === 'APPOINTMENT_CONFLICT' || status === 409
      ? 'The selected appointment time is unavailable'
      : 'Unable to book appointment');
    this.name = 'AppointmentBookingError';
    this.status = status;
    this.code = code;
    this.availableSlots = availableSlots;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeBookingError(error: unknown): AppointmentBookingError {
  if (error instanceof AppointmentBookingError) return error;

  const response = isRecord(error) ? error.response : undefined;
  const status = isRecord(response) && typeof response.status === 'number'
    ? response.status
    : 0;
  const data = isRecord(response) ? response.data : undefined;
  const code = isRecord(data) && typeof data.code === 'string'
    ? data.code
    : status === 409
      ? 'APPOINTMENT_CONFLICT'
      : undefined;
  const availableSlots = isRecord(data) && Array.isArray(data.availableSlots)
    ? data.availableSlots.filter((slot): slot is string =>
        typeof slot === 'string' && /^\d{2}:\d{2}$/.test(slot))
    : [];

  return new AppointmentBookingError(status, code, availableSlots);
}

export function normalizeAppointmentBookingError(error: unknown): AppointmentBookingError {
  return normalizeBookingError(error);
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

    attachCorrelationInterceptor(this.api);
  }

  async getUpcomingAppointments(): Promise<UpcomingAppointmentView[]> {
    const response = await this.api.get<BackendAppointment[]>('/upcoming');
    return response.data.map(mapAppointment);
  }

  async getPetAppointments(
    petId: string,
    params: { status?: AppointmentHistoryTab; page?: number; limit?: number } = {},
  ): Promise<AppointmentHistoryPage> {
    const response = await this.api.get<BackendAppointment[] | PetAppointmentsPage>(
      `/pet/${encodeURIComponent(petId)}`,
      { params },
    );

    const payload = response.data;
    const items = Array.isArray(payload) ? payload : payload?.data ?? [];
    const total = Array.isArray(payload) ? items.length : payload?.total ?? items.length;
    const page = Array.isArray(payload) ? params.page ?? 1 : payload?.page ?? params.page ?? 1;
    const limit = Array.isArray(payload)
      ? params.limit ?? items.length
      : payload?.limit ?? params.limit ?? items.length;

    return { entries: items.map(mapAppointment), total, page, limit };
  }

  async createAppointment(dto: CreateAppointmentDto): Promise<Appointment> {
    const payload: CreateAppointmentPayload = {
      petId: dto.petId,
      vetClinicId: dto.vetId,
      type: CREATE_TYPE_MAP[dto.appointmentType],
      scheduledDate: `${dto.date}T${dto.time}:00.000`,
      duration: 30,
      reason: dto.notes,
      notes: dto.notes,
    };

    try {
      const response = await this.api.post<BackendAppointment>('/', payload);
      return mapAppointment(response.data).appointment;
    } catch (error: unknown) {
      throw normalizeBookingError(error);
    }
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
