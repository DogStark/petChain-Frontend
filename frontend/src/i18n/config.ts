import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';

export const DEFAULT_LOCALE = 'en';
export const SUPPORTED_LOCALES = ['en', 'es', 'fr'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const LOCALE_STORAGE_KEY = 'app.locale';

const resources = {
  en: { translation: en },
  es: { translation: es },
  fr: { translation: fr },
} as const;

/**
 * Locale precedence (highest to lowest):
 * 1. Persisted preference (localStorage) — survives refresh and sign-in/out.
 * 2. Browser language (navigator.language) when supported.
 * 3. DEFAULT_LOCALE fallback.
 *
 * Unsupported values at any level fall through deterministically to the next
 * level, ending at DEFAULT_LOCALE.
 */
export function isSupportedLocale(value: unknown): value is Locale {
  return (
    typeof value === 'string' &&
    (SUPPORTED_LOCALES as readonly string[]).includes(value)
  );
}

/**
 * Normalize an arbitrary locale tag (e.g. "en-US", "fr-CA") to a supported
 * locale, or return null when nothing matches.
 */
export function normalizeLocale(value: unknown): Locale | null {
  if (typeof value !== 'string' || value.length === 0) {
    return null;
  }
  if (isSupportedLocale(value)) {
    return value;
  }
  const base = value.toLowerCase().split('-')[0];
  return isSupportedLocale(base) ? base : null;
}

/**
 * Resolve the active locale using the documented precedence. This is pure and
 * deterministic so it can run identically on the server and the client during
 * hydration, preventing markup mismatch.
 */
export function resolveLocale(options?: {
  persisted?: string | null;
  browser?: string | null;
}): Locale {
  const persisted = normalizeLocale(options?.persisted);
  if (persisted) {
    return persisted;
  }
  const browser = normalizeLocale(options?.browser);
  if (browser) {
    return browser;
  }
  return DEFAULT_LOCALE;
}

/**
 * Read the persisted locale preference. Only the locale is stored; no other
 * user state is persisted here. Safe to call when storage is unavailable.
 */
export function readPersistedLocale(): Locale | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    return normalizeLocale(window.localStorage.getItem(LOCALE_STORAGE_KEY));
  } catch {
    return null;
  }
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
    // Storage may be unavailable (private mode); selection still works in-memory.
  }
}

/**
 * Locale used for the initial (server + first client) render. It is always the
 * deterministic default so server and client markup match during hydration;
 * the persisted/browser preference is applied after mount.
 */
export function getInitialLocale(): Locale {
  return DEFAULT_LOCALE;
}

/**
 * Locale to apply once the client is interactive, honoring precedence.
 */
export function getClientLocale(): Locale {
  return resolveLocale({
    persisted: readPersistedLocale(),
    browser: typeof navigator !== 'undefined' ? navigator.language : null,
  });
}

/**
 * Create a fresh i18next instance with the matching catalog loaded eagerly so
 * translated text is available before interactive render.
 */
export function createI18nInstance(locale: Locale = DEFAULT_LOCALE) {
  const instance = createInstance();
  instance.use(initReactI18next).init({
    resources,
    lng: locale,
    fallbackLng: DEFAULT_LOCALE,
    supportedLngs: SUPPORTED_LOCALES as unknown as string[],
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
  return instance;
}

export const i18n = createI18nInstance(DEFAULT_LOCALE);

export default i18n;
