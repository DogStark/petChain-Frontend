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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const QRID_RE = /^[a-zA-Z0-9_-]{1,128}$/;

/** Returns a sanitized, URL-safe copy — breaks taint flow for CodeQL */
function safeUuid(id: string): string {
  if (!UUID_RE.test(id)) throw new Error('Invalid UUID');
  return id.replace(/[^0-9a-f-]/gi, '');
}

function safeQrId(id: string): string {
  if (!QRID_RE.test(id)) throw new Error('Invalid QR ID');
  return id.replace(/[^a-zA-Z0-9_-]/g, '');
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
    const { data } = await this.api.post('/', { petId: safeUuid(petId), ...opts });
    return data;
  }

  async getByPetId(petId: string): Promise<QRCodeRecord[]> {
    const { data } = await this.api.get('/', { params: { petId: safeUuid(petId) } });
    return data;
  }

  async getOne(qrCodeId: string): Promise<QRCodeRecord> {
    const safe = safeQrId(qrCodeId);
    try {
      const { data } = await this.api.get(`/${safe}`);
      return data;
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 429) {
        // Re-throw with status so callers can distinguish rate-limit errors
        throw Object.assign(new Error('Rate limited'), { status: 429 });
      }
      throw err;
    }
  }

  async update(
    qrCodeId: string,
    patch: Partial<Pick<QRCodeRecord, 'isActive' | 'emergencyContact' | 'customMessage'>>
  ): Promise<QRCodeRecord> {
    const safe = safeQrId(qrCodeId);
    const { data } = await this.api.patch(`/${safe}`, patch);
    return data;
  }

  async regenerate(qrCodeId: string): Promise<QRCodeRecord> {
    const safe = safeQrId(qrCodeId);
    const { data } = await this.api.post(`/${safe}/regenerate`);
    return data;
  }

  async getAnalytics(qrCodeId: string): Promise<ScanAnalytics> {
    const safe = safeQrId(qrCodeId);
    const { data } = await this.api.get(`/${safe}/analytics`);
    return data;
  }

  async recordScan(
    qrCodeId: string,
    meta?: { deviceType?: string; city?: string; country?: string }
  ): Promise<void> {
    const safe = safeQrId(qrCodeId);
    try {
      await this.api.post(`/${safe}/scan`, meta ?? {});
    } catch (err) {
      // Best-effort: swallow non-rate-limit errors so scans never block the UI.
      // Re-throw rate-limit errors so callers can handle them.
      if (axios.isAxiosError(err) && err.response?.status === 429) {
        throw Object.assign(new Error('Rate limited'), { status: 429 });
      }
      // Non-429 errors are intentionally swallowed (best-effort recording).
    }
  }

  getImageUrl(qrCodeId: string): string {
    const safe = safeQrId(qrCodeId);
    return `${getApiBaseUrl()}/qrcodes/${safe}/image`;
  }
}

export const qrcodeAPI = new QRCodeAPI();
