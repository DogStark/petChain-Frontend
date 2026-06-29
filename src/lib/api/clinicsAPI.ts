import axios, { AxiosInstance, isAxiosError } from 'axios';
import { getApiBaseUrl } from './apiBaseUrl';
import { Clinic, ClinicService, OperatingHours } from '@/types/clinic';

const API_BASE_URL = getApiBaseUrl();

interface BackendVetClinic {
  id: string;
  name: string;
  address: string;
  city?: string;
  state?: string;
  zipCode?: string;
  phone: string;
  email?: string;
  website?: string;
  operatingHours?: Record<string, { open: string; close: string }>;
  services?: string[];
  notes?: string;
}

const DAY_LABELS: OperatingHours['day'][] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

function mapOperatingHours(
  operatingHours?: Record<string, { open: string; close: string }>,
): OperatingHours[] {
  if (!operatingHours) {
    return DAY_LABELS.map((day) => ({
      day,
      open: '09:00',
      close: '17:00',
      isClosed: true,
    }));
  }

  return DAY_LABELS.map((day) => {
    const key = day.toLowerCase();
    const hours = operatingHours[key];
    if (!hours) {
      return { day, open: '09:00', close: '17:00', isClosed: true };
    }
    return {
      day,
      open: hours.open,
      close: hours.close,
      isClosed: false,
    };
  });
}

function mapServices(clinicId: string, services?: string[]): ClinicService[] {
  return (services || []).map((name, index) => ({
    id: `s-${clinicId}-${index}`,
    name,
    description: '',
    priceRange: '',
  }));
}

export function mapVetClinicToClinic(clinic: BackendVetClinic): Clinic {
  return {
    id: clinic.id,
    name: clinic.name,
    description: clinic.notes || `Veterinary care at ${clinic.name}.`,
    locations: [
      {
        id: `${clinic.id}-main`,
        name: clinic.name,
        address: clinic.address,
        city: clinic.city || '',
        phone: clinic.phone,
        email: clinic.email || '',
      },
    ],
    hours: mapOperatingHours(clinic.operatingHours),
    services: mapServices(clinic.id, clinic.services),
    staff: [],
    rating: 0,
    reviewCount: 0,
  };
}

class ClinicsAPI {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: `${API_BASE_URL}/vet-clinics`,
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

  async getClinics(city?: string): Promise<Clinic[]> {
    const response = await this.api.get<BackendVetClinic[]>('/', {
      params: city ? { city } : undefined,
    });
    return response.data.map(mapVetClinicToClinic);
  }

  async getClinicById(id: string): Promise<Clinic> {
    const response = await this.api.get<BackendVetClinic>(`/${id}`);
    return mapVetClinicToClinic(response.data);
  }
}

export const clinicsAPI = new ClinicsAPI();
export { isAxiosError };
