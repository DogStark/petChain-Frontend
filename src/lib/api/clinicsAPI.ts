import axios, { AxiosInstance, isAxiosError } from 'axios';
import { getApiBaseUrl } from './apiBaseUrl';
import { attachCorrelationInterceptor } from './correlationInterceptor';
import { Clinic, ClinicReview, ClinicService, OperatingHours } from '@/types/clinic';

const API_BASE_URL = getApiBaseUrl();

function getCsrfToken(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

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
  rating?: number;
  reviewCount?: number;
  reviews?: ClinicReview[];
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
    rating: clinic.rating ?? 0,
    reviewCount: clinic.reviewCount ?? clinic.reviews?.length ?? 0,
    reviews: clinic.reviews ?? [],
  };
}

class ClinicsAPI {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: `${API_BASE_URL}/vet-clinics`,
      withCredentials: true,
    });

    attachCorrelationInterceptor(this.api);

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

  /**
   * Fetch vet clinics. The backend only supports an optional `city` filter;
   * there is no free-text search parameter, so callers filter the returned
   * list client-side.
   *
   * Pass an `AbortSignal` to cancel an in-flight request when a newer one
   * supersedes it (see `useClinicSearch`).
   */
  async getClinics(city?: string, signal?: AbortSignal): Promise<Clinic[]> {
    const response = await this.api.get<BackendVetClinic[]>('/', {
      params: city ? { city } : undefined,
      signal,
    });
    return response.data.map(mapVetClinicToClinic);
  }

  async getClinicById(id: string): Promise<Clinic> {
    const response = await this.api.get<BackendVetClinic>(`/${id}`);
    return mapVetClinicToClinic(response.data);
  }

  async submitReview(
    clinicId: string,
    review: { rating: number; comment: string },
  ): Promise<ClinicReview> {
    const csrfToken = getCsrfToken();
    const response = await this.api.post<ClinicReview>(
      `/${encodeURIComponent(clinicId)}/reviews`,
      review,
      { headers: csrfToken ? { 'X-CSRF-Token': csrfToken } : undefined },
    );
    return response.data;
  }

  async saveAvailability(clinicId: string, availability: Array<{day: string; slots: string; active: boolean}>): Promise<void> {
    await this.api.patch(`/${clinicId}/availability`, { availability });
  }
}

export const clinicsAPI = new ClinicsAPI();
export { isAxiosError };
