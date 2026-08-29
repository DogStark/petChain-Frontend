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

export interface ScanEventMeta {
  deviceType?: string;
  locationConsent?: boolean;
  region?: string;
  country?: string;
  city?: string;
  userAgent?: string;
  ipAddress?: string;
  latitude?: number;
  longitude?: number;
  emergencyContact?: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const QRID_RE = /^[a-zA-Z0-9_-]{1,128}$/;
const ALLOWED_DEVICE_TYPES = new Set(['mobile', 'desktop', 'tablet', 'unknown']);

/**
 * Scan analytics intentionally record only minimal, consented metadata.
 * Raw IPs, exact coordinates, and contact details are never sent.
 */
function sanitizeScanEvent(meta?: ScanEventMeta): Record<string, string | boolean> {
  if (!meta) return {};

  const sanitized: Record<string, string | boolean> = {};

  const deviceType = typeof meta.deviceType === 'string' ? meta.deviceType.toLowerCase() : '';
  if (deviceType && ALLOWED_DEVICE_TYPES.has(deviceType)) {
    sanitized.deviceType = deviceType;
  }

  if (meta.locationConsent === true) {
    const country = typeof meta.country === 'string' ? meta.country.trim().toUpperCase() : '';
    if (/^[A-Z]{2}$/.test(country)) {
      sanitized.country = country;
    }

    const region = typeof meta.region === 'string' ? meta.region.trim() : '';
    if (region && region.length <= 64) {
      sanitized.region = region;
    }
  }

  return sanitized;
}

/** Returns a sanitized, URL-safe copy — breaks taint flow for CodeQL */
function safeUuid(id: string): string {
  if (!UUID_RE.test(id)) throw new Error('Invalid UUID');
  return id.replace(/[^0-9a-f-]/gi, '');
}

function safeQrId(id: string): string {
  if (!QRID_RE.test(id)) throw new Error('Invalid QR ID');
  return id.replace(/[^a-zA-Z0-9_-]/g, '');
}

export class QRCodeAPI {
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
    const { data } = await this.api.get(`/${safe}`);
    return data;
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
    meta?: ScanEventMeta
  ): Promise<void> {
    const safe = safeQrId(qrCodeId);
    const payload = sanitizeScanEvent(meta);
    await this.api.post(`/${safe}/scan`, payload);
  }

  getImageUrl(qrCodeId: string): string {
    const safe = safeQrId(qrCodeId);
    return `${getApiBaseUrl()}/qrcodes/${safe}/image`;
  }
}

export const qrcodeAPI = new QRCodeAPI();
