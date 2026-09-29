import en from './en';
import es from './es';

export type Locale = 'en' | 'es';

export const DEFAULT_LOCALE: Locale = 'en';

export const SUPPORTED_LOCALES: readonly Locale[] = ['en', 'es'] as const;

export const LOCALE_STORAGE_KEY = 'locale';

export const catalogs: Record<Locale, Record<string, string>> = {
  en,
  es,
};

/**
 * Deterministically resolve a raw locale value to a supported locale.
 * Unsupported or malformed values fall back to DEFAULT_LOCALE so that
 * server and client always agree during hydration.
 */
export function resolveLocale(value: unknown): Locale {
  if (typeof value !== 'string') {
    return DEFAULT_LOCALE;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return DEFAULT_LOCALE;
  }

  // Exact match first (e.g. "en", "es").
  const exact = SUPPORTED_LOCALES.find((locale) => locale === normalized);
  if (exact) {
    return exact;
  }

  // Fall back to the base language subtag (e.g. "en-US" -> "en").
  const base = normalized.split('-')[0];
  const baseMatch = SUPPORTED_LOCALES.find((locale) => locale === base);
  if (baseMatch) {
    return baseMatch;
  }

  return DEFAULT_LOCALE;
}

/**
 * Locale precedence: persisted preference, then browser language, then default.
 * Only the locale preference is persisted; no other user state is stored.
 */
export function getInitialLocale(): Locale {
  if (typeof window === 'undefined') {
    return DEFAULT_LOCALE;
  }

  try {
    const persisted = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (persisted) {
      return resolveLocale(persisted);
    }
  } catch {
    // Ignore storage access errors (private mode, disabled storage, etc.).
  }

  if (typeof navigator !== 'undefined' && navigator.language) {
    return resolveLocale(navigator.language);
  }

  return DEFAULT_LOCALE;
}

/**
 * Persist only the locale preference so it survives refresh and sign-in/out.
 */
export function persistLocale(locale: Locale): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Ignore storage access errors; the in-memory locale still applies.
  }
}

export function getCatalog(locale: Locale): Record<string, string> {
  return catalogs[locale] ?? catalogs[DEFAULT_LOCALE];
}
