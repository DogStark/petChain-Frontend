import axios, { AxiosInstance } from 'axios';
import { getApiBaseUrl } from './apiBaseUrl';

export interface QRCodeRecord {
  id: string;
  petId: string;
  qrCodeId: string;
  emergencyContact?: string;
  customMessage?: string;
  expiresAt?: string;
  isActive: boolean;
  scanCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ScanAnalytics {
  totalScans: number;
  scansByLocation: Array<{ city: string; country: string; count: number }>;
  scansByDevice: Array<{ deviceType: string; count: number }>;
  recentScans: Array<{
    id: string;
    city?: string;
    country?: string;
    deviceType?: string;
    scannedAt: string;
  }>;
}

class QRCodeAPI {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({ baseURL: `${getApiBaseUrl()}/qrcodes` });
    this.api.interceptors.request.use((config) => {
      const token = localStorage.getItem('authToken');
      if (token) config.headers.Authorization = `Bearer ${token}`;
      return config;
    });
  }

  async create(
    petId: string,
    opts?: { emergencyContact?: string; customMessage?: string }
  ): Promise<QRCodeRecord> {
    const { data } = await this.api.post('/', { petId, ...opts });
    return data;
  }

  async getByPetId(petId: string): Promise<QRCodeRecord[]> {
    const { data } = await this.api.get('/', { params: { petId } });
    return data;
  }

  async getOne(qrCodeId: string): Promise<QRCodeRecord> {
    const { data } = await this.api.get(`/${qrCodeId}`);
    return data;
  }

  async update(
    qrCodeId: string,
    patch: Partial<Pick<QRCodeRecord, 'isActive' | 'emergencyContact' | 'customMessage'>>
  ): Promise<QRCodeRecord> {
    const { data } = await this.api.patch(`/${qrCodeId}`, patch);
    return data;
  }

  async regenerate(qrCodeId: string): Promise<QRCodeRecord> {
    const { data } = await this.api.post(`/${qrCodeId}/regenerate`);
    return data;
  }

  async getAnalytics(qrCodeId: string): Promise<ScanAnalytics> {
    const { data } = await this.api.get(`/${qrCodeId}/analytics`);
    return data;
  }

  async recordScan(
    qrCodeId: string,
    meta?: { deviceType?: string; city?: string; country?: string }
  ): Promise<void> {
    await this.api.post(`/${qrCodeId}/scan`, meta ?? {});
  }

  getImageUrl(qrCodeId: string): string {
    return `${getApiBaseUrl()}/qrcodes/${qrCodeId}/image`;
  }
}

export const qrcodeAPI = new QRCodeAPI();
