import type { QRCodeRecord } from '@/lib/api/qrcodeAPI';

export type EmergencyPassStatus = 'active' | 'expired' | 'revoked' | 'unavailable';

export type EmergencyPassRecord = Pick<QRCodeRecord, 'isActive'> &
  Partial<Pick<QRCodeRecord, 'expiresAt' | 'customMessage'>>;

/** Revocation wins over expiry; a missing record means nothing can be issued. */
export function getEmergencyPassStatus(
  record: EmergencyPassRecord | null | undefined,
  now: number = Date.now()
): EmergencyPassStatus {
  if (!record) return 'unavailable';
  if (!record.isActive) return 'revoked';
  if (record.expiresAt) {
    const expires = Date.parse(record.expiresAt);
    if (Number.isNaN(expires) || expires <= now) return 'expired';
  }
  return 'active';
}
