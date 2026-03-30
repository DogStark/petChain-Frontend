import { EncryptionService } from '../../security/services/encryption.service';

let encryptionServiceInstance: EncryptionService | null = null;

/** Called once during module bootstrap to wire the singleton */
export function setEncryptionService(svc: EncryptionService): void {
  encryptionServiceInstance = svc;
}

/**
 * TypeORM column transformer that transparently encrypts on write
 * and decrypts on read using AES-256-GCM.
 */
export const EncryptedTransformer = {
  to(value: string | null | undefined): string | null {
    if (value == null) return null;
    if (!encryptionServiceInstance) return value;
    return encryptionServiceInstance.encrypt(value);
  },

  from(value: string | null | undefined): string | null {
    if (value == null) return null;
    if (!encryptionServiceInstance) return value;
    if (!encryptionServiceInstance.isEncrypted(value)) return value;
    return encryptionServiceInstance.decrypt(value);
  },
};
