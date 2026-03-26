import axios, { AxiosInstance } from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

export interface DateRange {
  startDate: string;
  endDate: string;
}

export interface UserMetrics {
  totalUsers: number;
  activeUsers: number;
  newSignups: number;
  retentionRate: number;
}

export interface PetRegistrationTrend {
  date: string;
  registrations: number;
  species: { dogs: number; cats: number; other: number };
}

export interface VaccinationCompliance {
  compliant: number;
  nonCompliant: number;
  overdue: number;
  upcoming: number;
  rate: number;
}

export interface AppointmentStats {
  total: number;
  completed: number;
  cancelled: number;
  upcoming: number;
  averagePerDay: number;
}

export interface GeographicDistribution {
  region: string;
  country: string;
  users: number;
  pets: number;
}

export interface AnalyticsReport {
  userMetrics: UserMetrics;
  petTrends: PetRegistrationTrend[];
  vaccinationCompliance: VaccinationCompliance;
  appointmentStats: AppointmentStats;
  geoDistribution: GeographicDistribution[];
  generatedAt: string;
}

class AnalyticsAPI {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: `${API_BASE_URL}/analytics`,
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

  async getUserMetrics(dateRange?: DateRange): Promise<UserMetrics> {
    const response = await this.api.get('/users', { params: dateRange });
    return response.data;
  }

  async getPetRegistrationTrends(dateRange?: DateRange): Promise<PetRegistrationTrend[]> {
    const response = await this.api.get('/pets/trends', { params: dateRange });
    return response.data;
  }

  async getVaccinationCompliance(dateRange?: DateRange): Promise<VaccinationCompliance> {
    const response = await this.api.get('/vaccinations/compliance', { params: dateRange });
    return response.data;
  }

  async getAppointmentStats(dateRange?: DateRange): Promise<AppointmentStats> {
    const response = await this.api.get('/appointments/stats', { params: dateRange });
    return response.data;
  }

  async getGeographicDistribution(dateRange?: DateRange): Promise<GeographicDistribution[]> {
    const response = await this.api.get('/geographic', { params: dateRange });
    return response.data;
  }

  async getFullReport(dateRange?: DateRange): Promise<AnalyticsReport> {
    const response = await this.api.get('/report', { params: dateRange });
    return response.data;
  }

  async exportReport(format: 'csv' | 'json' | 'pdf', dateRange?: DateRange): Promise<Blob> {
    const response = await this.api.get('/export', {
      params: { format, ...dateRange },
      responseType: 'blob',
    });
    return response.data;
  }
}

export const analyticsAPI = new AnalyticsAPI();
