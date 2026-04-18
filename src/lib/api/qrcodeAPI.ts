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
  private readonly UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  private readonly QRID_RE = /^[a-zA-Z0-9_-]{1,128}$/;

  private validateId(id: string, type: 'uuid' | 'qrid' = 'uuid'): void {
    const valid = type === 'uuid' ? this.UUID_RE.test(id) : this.QRID_RE.test(id);
    if (!valid) throw new Error(`Invalid ${type} format`);
  }

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
    this.validateId(petId);
    const { data } = await this.api.get('/', { params: { petId } });
    return data;
  }

  async getOne(qrCodeId: string): Promise<QRCodeRecord> {
    this.validateId(qrCodeId, 'qrid');
    const { data } = await this.api.get(`/${qrCodeId}`);
    return data;
  }

  async update(
    qrCodeId: string,
    patch: Partial<Pick<QRCodeRecord, 'isActive' | 'emergencyContact' | 'customMessage'>>
  ): Promise<QRCodeRecord> {
    this.validateId(qrCodeId, 'qrid');
    const { data } = await this.api.patch(`/${qrCodeId}`, patch);
    return data;
  }

  async regenerate(qrCodeId: string): Promise<QRCodeRecord> {
    this.validateId(qrCodeId, 'qrid');
    const { data } = await this.api.post(`/${qrCodeId}/regenerate`);
    return data;
  }

  async getAnalytics(qrCodeId: string): Promise<ScanAnalytics> {
    this.validateId(qrCodeId, 'qrid');
    const { data } = await this.api.get(`/${qrCodeId}/analytics`);
    return data;
  }

  async recordScan(
    qrCodeId: string,
    meta?: { deviceType?: string; city?: string; country?: string }
  ): Promise<void> {
    this.validateId(qrCodeId, 'qrid');
    await this.api.post(`/${qrCodeId}/scan`, meta ?? {});
  }

  getImageUrl(qrCodeId: string): string {
    this.validateId(qrCodeId, 'qrid');
    return `${getApiBaseUrl()}/qrcodes/${qrCodeId}/image`;
  }
}

export const qrcodeAPI = new QRCodeAPI();
