import axios from 'axios';
import { getApiBaseUrl } from './apiBaseUrl';
import { LabResultItem, LabReport } from '@/types/lab-results';

function client() {
  return axios.create({ baseURL: getApiBaseUrl() });
}

export async function getLabResults(petId: string): Promise<LabResultItem[]> {
  const { data } = await client().get<LabResultItem[]>(`/pets/${petId}/lab-results`);
  return data;
}

export async function getLabReport(reportId: string): Promise<LabReport> {
  const { data } = await client().get<LabReport>(`/lab-reports/${reportId}`);
  return data;
}

export async function uploadLabReport(petId: string, file: File, meta?: Partial<LabReport>): Promise<LabReport> {
  const form = new FormData();
  form.append('file', file);
  if (meta) form.append('meta', JSON.stringify(meta));
  const { data } = await client().post<LabReport>(`/pets/${petId}/lab-reports`, form);
  return data;
}

export async function deleteLabReport(reportId: string): Promise<void> {
  await client().delete(`/lab-reports/${reportId}`);
}
