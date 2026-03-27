export interface PasswordStrength {
  score: number; // 0-4
  label: 'Very Weak' | 'Weak' | 'Fair' | 'Strong' | 'Very Strong';
  color: string;
}

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

const HISTORY_KEY = 'pw_history';
const HISTORY_LIMIT = 5;
const EXPIRY_DAYS = 90;
const EXPIRY_KEY = 'pw_set_at';

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
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  // Clamp to 0-4
  score = Math.min(4, Math.max(0, score - (password.length < 8 ? 1 : 0)));

  const levels: PasswordStrength[] = [
    { score: 0, label: 'Very Weak', color: '#ef4444' },
    { score: 1, label: 'Weak', color: '#f97316' },
    { score: 2, label: 'Fair', color: '#eab308' },
    { score: 3, label: 'Strong', color: '#22c55e' },
    { score: 4, label: 'Very Strong', color: '#16a34a' },
  ];

  return levels[score] ?? levels[0];
}

// Simple hash for history comparison (not cryptographic — just for client-side UX)
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash.toString(36);
}

export function isPasswordReused(password: string): boolean {
  if (typeof window === 'undefined') return false;
  const history: string[] = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  return history.includes(simpleHash(password));
}

export function savePasswordToHistory(password: string): void {
  if (typeof window === 'undefined') return;
  const history: string[] = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  const hash = simpleHash(password);
  const updated = [hash, ...history.filter((h) => h !== hash)].slice(0, HISTORY_LIMIT);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  localStorage.setItem(EXPIRY_KEY, Date.now().toString());
}

export function isPasswordExpired(): boolean {
  if (typeof window === 'undefined') return false;
  const setAt = localStorage.getItem(EXPIRY_KEY);
  if (!setAt) return false;
  const elapsed = Date.now() - parseInt(setAt, 10);
  return elapsed > EXPIRY_DAYS * 24 * 60 * 60 * 1000;
}

export function clearPasswordHistory(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(HISTORY_KEY);
  localStorage.removeItem(EXPIRY_KEY);
}
