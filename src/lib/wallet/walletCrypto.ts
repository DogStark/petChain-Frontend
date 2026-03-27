/**
 * Wallet Crypto Utilities
 * AES-256-GCM encryption with PBKDF2 key derivation (Web Crypto API)
 * Keys are never stored in plaintext — only encrypted blobs are persisted.
 */

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function deriveKey(pin: string, salt: Uint8Array, usage: KeyUsage[]): Promise<CryptoKey> {
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pin),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return window.crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    usage
  );
}

/**
 * Encrypts a Stellar secret key with a user-provided PIN.
 * Returns base64-encoded ciphertext, IV, and salt — all safe to store.
 */
export async function encryptSecretKey(
  secretKey: string,
  pin: string
): Promise<{ encryptedKey: string; iv: string; salt: string }> {
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(pin, salt, ['encrypt']);

  const encrypted = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(secretKey)
  );

  return {
    encryptedKey: arrayBufferToBase64(encrypted),
    iv: arrayBufferToBase64(iv.buffer),
    salt: arrayBufferToBase64(salt.buffer),
  };
}

/**
 * Decrypts a Stellar secret key using the PIN that was used to encrypt it.
 * Throws if the PIN is incorrect (AES-GCM authentication tag fails).
 */
export async function decryptSecretKey(
  encryptedKey: string,
  iv: string,
  salt: string,
  pin: string
): Promise<string> {
  const saltBytes = base64ToUint8Array(salt);
  const ivBytes = base64ToUint8Array(iv);
  const cipherBytes = base64ToUint8Array(encryptedKey);
  const key = await deriveKey(pin, saltBytes, ['decrypt']);

  const decrypted = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBytes },
    key,
    cipherBytes
  );

  return new TextDecoder().decode(decrypted);
}

/**
 * Computes a SHA-256 hex digest of a string — used to detect backup tampering.
 */
export async function computeChecksum(data: string): Promise<string> {
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
