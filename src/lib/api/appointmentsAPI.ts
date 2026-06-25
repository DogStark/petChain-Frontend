import axios, { AxiosInstance } from 'axios';
import { getApiBaseUrl } from './apiBaseUrl';
import { Appointment, AppointmentType } from '@/types/appointments';

export interface CreateAppointmentRequest {
  pet_id: string;
  vet_id: string;
  appointment_type: AppointmentType;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  notes?: string;
}

class AppointmentsAPI {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: `${getApiBaseUrl()}/appointments`,
      withCredentials: true,
    });

    this.api.interceptors.request.use((config) => {
      const token = localStorage.getItem('authToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
  }

  async createAppointment(data: CreateAppointmentRequest): Promise<Appointment> {
    const response = await this.api.post('/', data);
    return response.data;
  }

  async getAppointment(id: string): Promise<Appointment> {
    const response = await this.api.get(`/${id}`);
    return response.data;
  }

  async listAppointments(params?: { status?: string; limit?: number; offset?: number }): Promise<Appointment[]> {
    const response = await this.api.get('/', { params });
    return response.data;
  }

  async updateAppointment(id: string, data: Partial<Appointment>): Promise<Appointment> {
    const response = await this.api.patch(`/${id}`, data);
    return response.data;
  }

  async cancelAppointment(id: string, reason?: string): Promise<Appointment> {
    const response = await this.api.post(`/${id}/cancel`, { reason });
    return response.data;
  }
}

export const appointmentsAPI = new AppointmentsAPI();
