import axios, { AxiosInstance } from 'axios';
import { getApiBaseUrl } from './apiBaseUrl';
import { attachCorrelationInterceptor } from './correlationInterceptor';

export interface MedicalRecordSummary {
  id: string;
}

class MedicalRecordsAPI {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: `${getApiBaseUrl()}/medical-records`,
      withCredentials: true,
    });

    this.api.interceptors.request.use((config) => {
      const token = localStorage.getItem('authToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    attachCorrelationInterceptor(this.api);
  }

  async getByPetId(petId: string): Promise<MedicalRecordSummary[]> {
    const response = await this.api.get('', { params: { petId } });
    return response.data;
  }
}

export const medicalRecordsAPI = new MedicalRecordsAPI();
