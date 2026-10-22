import axios from 'axios';
import { getApiBaseUrl } from './apiBaseUrl';
import { LabResultItem, LabReport } from '@/types/lab-results';
import { attachCorrelationInterceptor } from './correlationInterceptor';

function client() {
  const api = axios.create({ baseURL: getApiBaseUrl(), withCredentials: true });
  api.interceptors.request.use((config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('authToken');
      if (token) config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });
  attachCorrelationInterceptor(api);
  return api;
}

export async function getLabResults(petId: string): Promise<LabResultItem[]> {
  const { data } = await client().get<LabResultItem[]>(`/pets/${petId}/lab-results`);
  return data;
}

export async function getLabReport(reportId: string): Promise<LabReport> {
  const { data } = await client().get<LabReport>(`/lab-reports/${reportId}`);
  return data;
}

export interface LabReportUploadOptions {
  /** Upload progress, 0–100. */
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
}

export async function uploadLabReport(
  petId: string,
  file: File,
  meta?: Partial<LabReport>,
  options: LabReportUploadOptions = {},
): Promise<LabReport> {
  const form = new FormData();
  form.append('file', file);
  if (meta) form.append('meta', JSON.stringify(meta));
  const { data } = await client().post<LabReport>(`/pets/${petId}/lab-reports`, form, {
    signal: options.signal,
    onUploadProgress: (event) => {
      if (!options.onProgress) return;
      if (event.total && event.total > 0) {
        options.onProgress(Math.min(100, Math.round((event.loaded * 100) / event.total)));
      }
    },
  });
  return data;
}

export async function deleteLabReport(reportId: string): Promise<void> {
  await client().delete(`/lab-reports/${reportId}`);
}
