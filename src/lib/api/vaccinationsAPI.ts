import axios from 'axios';

import { getApiBaseUrl } from './apiBaseUrl';
import { attachCorrelationInterceptor } from './correlationInterceptor';

export interface VaccinationRecord {
  id: string;
  petId: string;
  vaccineName: string;
  administeredDate: string;
  nextDueDate?: string | null;
  veterinarianName?: string | null;
}

export interface CreateVaccinationRecord {
  petId: string;
  vaccineName: string;
  administeredDate: string;
}

const api = axios.create({
  baseURL: `${getApiBaseUrl()}/vaccinations`,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('authToken');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

attachCorrelationInterceptor(api);

export const vaccinationsAPI = {
  async getByPetId(petId: string): Promise<VaccinationRecord[]> {
    const response = await api.get<VaccinationRecord[]>(`/pet/${petId}`);
    return response.data;
  },

  async create(data: CreateVaccinationRecord): Promise<VaccinationRecord> {
    const response = await api.post<VaccinationRecord>('', data);
    return response.data;
  },
};
