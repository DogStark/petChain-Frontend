/**
 * Secure, account-bound, time-limited draft storage for unsaved clinical forms.
 *
 * Drafts are only written with explicit user consent, are encrypted at rest
 * (AES-GCM via WebCrypto), expire after a short TTL, and are keyed by account
 * so a different account can never read or restore another account's draft.
 */

const DRAFT_PREFIX = 'clinical-draft:';
const DEFAULT_TTL_MS = 15 * 60 * 1000; // 15 minutes

interface StoredDraft {
  accountId: string;
  expiresAt: number;
  iv: string;
  ciphertext: string;
}

function draftKey(accountId: string): string {
  return `${DRAFT_PREFIX}${accountId}`;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function deriveKey(accountId: string): Promise<CryptoKey> {
  const material = new TextEncoder().encode(`clinical-draft-key:${accountId}`);
  const digest = await crypto.subtle.digest('SHA-256', material);
  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
}

/**
 * Persist a draft for the given account. Callers MUST obtain explicit user
 * consent before invoking this; nothing is stored otherwise.
 */
export async function saveDraft(
  accountId: string,
  data: unknown,
  ttlMs: number = DEFAULT_TTL_MS,
): Promise<void> {
  if (!accountId) {
    throw new Error('Cannot save a draft without an account id');
  }
  const key = await deriveKey(accountId);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(data));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);

  const record: StoredDraft = {
    accountId,
    expiresAt: Date.now() + ttlMs,
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(ciphertext)),
  };
  localStorage.setItem(draftKey(accountId), JSON.stringify(record));
}

/**
 * Restore a draft for the given account. Returns null when there is no draft,
 * the draft belongs to another account, or it has expired (expired drafts are
 * removed on read).
 */
export async function loadDraft<T = unknown>(accountId: string): Promise<T | null> {
  if (!accountId) {
    return null;
  }
  const raw = localStorage.getItem(draftKey(accountId));
  if (!raw) {
    return null;
  }

  let record: StoredDraft;
  try {
    record = JSON.parse(raw) as StoredDraft;
  } catch {
    localStorage.removeItem(draftKey(accountId));
    return null;
  }

  if (record.accountId !== accountId || Date.now() >= record.expiresAt) {
    localStorage.removeItem(draftKey(accountId));
    return null;
  }

  try {
    const key = await deriveKey(accountId);
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(record.iv) },
      key,
      fromBase64(record.ciphertext),
    );
    return JSON.parse(new TextDecoder().decode(plaintext)) as T;
  } catch {
    localStorage.removeItem(draftKey(accountId));
    return null;
  }
}

/** Remove the draft for the given account (e.g. on logout or after restore). */
export function clearDraft(accountId: string): void {
  if (!accountId) {
    return;
  }
  localStorage.removeItem(draftKey(accountId));
}

/** Whether a non-expired draft exists for the given account. */
export function hasDraft(accountId: string): boolean {
  if (!accountId) {
    return false;
  }
  const raw = localStorage.getItem(draftKey(accountId));
  if (!raw) {
    return false;
  }
  try {
    const record = JSON.parse(raw) as StoredDraft;
    if (record.accountId !== accountId || Date.now() >= record.expiresAt) {
      localStorage.removeItem(draftKey(accountId));
      return false;
    }
    return true;
  } catch {
    localStorage.removeItem(draftKey(accountId));
    return false;
  }
}
