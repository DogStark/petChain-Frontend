export interface PasswordStrength {
  score: number; // 0-4
  label: 'Very Weak' | 'Weak' | 'Fair' | 'Strong' | 'Very Strong';
  color: string;
}

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

const HISTORY_KEY_PREFIX = 'pw_history';
const HISTORY_LIMIT = 5;
const DEFAULT_SCOPE = 'anonymous';

export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = [];

  if (password.length < 8) errors.push('At least 8 characters required');
  if (!/[A-Z]/.test(password)) errors.push('At least one uppercase letter required');
  if (!/[a-z]/.test(password)) errors.push('At least one lowercase letter required');
  if (!/[0-9]/.test(password)) errors.push('At least one number required');
  if (!/[^A-Za-z0-9]/.test(password)) errors.push('At least one special character required');

  return { valid: errors.length === 0, errors };
}

export function getPasswordStrength(password: string): PasswordStrength {
  // Any password that fails the minimum-length requirement is always Very Weak,
  // regardless of character diversity. This prevents a short-but-diverse password
  // (e.g. "Ab1!") from scoring as "Fair" when validatePassword would reject it.
  if (password.length < 8) {
    return { score: 0, label: 'Very Weak', color: '#ef4444' };
  }

  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  // Clamp to 0-4
  score = Math.min(4, Math.max(0, score));

  const levels: PasswordStrength[] = [
    { score: 0, label: 'Very Weak', color: '#ef4444' },
    { score: 1, label: 'Weak', color: '#f97316' },
    { score: 2, label: 'Fair', color: '#eab308' },
    { score: 3, label: 'Strong', color: '#22c55e' },
    { score: 4, label: 'Very Strong', color: '#16a34a' },
  ];

  return levels[score] ?? levels[0];
}

// NOTE: This is a client-side UX hint only, not a security control. It lives in
// localStorage, is trivially bypassed by clearing site data or switching browsers/
// devices, and must never be the sole gate on password reuse — the backend must
// independently reject reuse of a user's actual password history.
async function digest(str: string): Promise<string> {
  const bytes = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function historyKey(scope?: string): string {
  return `${HISTORY_KEY_PREFIX}:${scope || DEFAULT_SCOPE}`;
}

export async function isPasswordReused(password: string, scope?: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const history: string[] = JSON.parse(localStorage.getItem(historyKey(scope)) || '[]');
  return history.includes(await digest(password));
}

export async function savePasswordToHistory(password: string, scope?: string): Promise<void> {
  if (typeof window === 'undefined') return;
  const key = historyKey(scope);
  const history: string[] = JSON.parse(localStorage.getItem(key) || '[]');
  const hash = await digest(password);
  const updated = [hash, ...history.filter((h) => h !== hash)].slice(0, HISTORY_LIMIT);
  localStorage.setItem(key, JSON.stringify(updated));
}

export function clearPasswordHistory(scope?: string): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(historyKey(scope));
}
