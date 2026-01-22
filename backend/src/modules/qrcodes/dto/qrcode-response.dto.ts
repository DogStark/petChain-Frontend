import { QRCode } from '../entities/qrcode.entity';
import { QRCodeScan } from '../entities/qrcode-scan.entity';

/**
 * QR Code data structure matching the technical specification
 */
export interface QRCodeData {
  petId: string;
  emergencyContact: string;
  customMessage: string;
  encryptedData: string;
  expiresAt: Date;
}

/**
 * Response DTO for QR Code
 */
export class QRCodeResponseDto {
  id: string;
  petId: string;
  qrCodeId: string;
  emergencyContact?: string;
  customMessage?: string;
  expiresAt?: Date;
  isActive: boolean;
  scanCount: number;
  createdAt: Date;
  updatedAt: Date;

  static fromEntity(qrcode: QRCode): QRCodeResponseDto {
    return {
      id: qrcode.id,
      petId: qrcode.petId,
      qrCodeId: qrcode.qrCodeId,
      emergencyContact: qrcode.emergencyContact,
      customMessage: qrcode.customMessage,
      expiresAt: qrcode.expiresAt,
      isActive: qrcode.isActive,
      scanCount: qrcode.scanCount,
      createdAt: qrcode.createdAt,
      updatedAt: qrcode.updatedAt,
    };
  }
}

/**
 * Response DTO for Scan Analytics
 */
export class ScanAnalyticsResponseDto {
  totalScans: number;
  scans: QRCodeScan[];
  scansByLocation: Array<{ city: string; country: string; count: number }>;
  scansByDevice: Array<{ deviceType: string; count: number }>;
  recentScans: QRCodeScan[];
}

/**
 * Response DTO for Scan Record
 */
export class ScanRecordResponseDto {
  qrcode: QRCodeResponseDto;
  scan: {
    id: string;
    latitude?: number;
    longitude?: number;
    deviceType?: string;
    city?: string;
    country?: string;
    scannedAt: Date;
  };
}
