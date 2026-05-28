import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';

// ─── Locale imports ───────────────────────────────────────────────────────────
import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import de from './locales/de.json';
import zh from './locales/zh.json';
import ar from './locales/ar.json';
import hi from './locales/hi.json';
import pt from './locales/pt.json';
import ru from './locales/ru.json';
import ja from './locales/ja.json';

// ─── Types ────────────────────────────────────────────────────────────────────
type TranslationValue = string | Record<string, unknown>;
type TranslationDict = Record<string, TranslationValue>;

export type LanguageCode = 'en' | 'es' | 'fr' | 'de' | 'zh' | 'ar' | 'hi' | 'pt' | 'ru' | 'ja';

export interface LanguageConfig {
  code: LanguageCode;
  name: string;
  nativeName: string;
  dir: 'ltr' | 'rtl';
  flag: string;
}

// ─── Supported languages ──────────────────────────────────────────────────────
export const supportedLanguages: readonly LanguageConfig[] = [
  { code: 'en', name: 'English',    nativeName: 'English',    dir: 'ltr', flag: '🇺🇸' },
  { code: 'es', name: 'Spanish',    nativeName: 'Español',    dir: 'ltr', flag: '🇪🇸' },
  { code: 'fr', name: 'French',     nativeName: 'Français',   dir: 'ltr', flag: '🇫🇷' },
  { code: 'de', name: 'German',     nativeName: 'Deutsch',    dir: 'ltr', flag: '🇩🇪' },
  { code: 'zh', name: 'Chinese',    nativeName: '中文',        dir: 'ltr', flag: '🇨🇳' },
  { code: 'ar', name: 'Arabic',     nativeName: 'العربية',    dir: 'rtl', flag: '🇸🇦' },
  { code: 'hi', name: 'Hindi',      nativeName: 'हिन्दी',      dir: 'ltr', flag: '🇮🇳' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português',  dir: 'ltr', flag: '🇧🇷' },
  { code: 'ru', name: 'Russian',    nativeName: 'Русский',    dir: 'ltr', flag: '🇷🇺' },
  { code: 'ja', name: 'Japanese',   nativeName: '日本語',      dir: 'ltr', flag: '🇯🇵' },
] as const;

const STORAGE_KEY = 'petchain-language';
const FALLBACK: LanguageCode = 'en';

// ─── Translation resources ────────────────────────────────────────────────────
const resources: Record<LanguageCode, TranslationDict> = { en, es, fr, de, zh, ar, hi, pt, ru, ja };

// ─── Interpolation helper ─────────────────────────────────────────────────────
function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return Object.entries(params).reduce<string>(
    (str, [k, v]) => str.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v)),
    template,
  );
}

// ─── Deep-get a dot-path key from a nested object ────────────────────────────
function deepGet(obj: TranslationDict, path: string): string | undefined {
  const parts = path.split('.');
  let cur: unknown = obj;
  for (const part of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return typeof cur === 'string' ? cur : undefined;
}

// ─── Detect initial language ──────────────────────────────────────────────────
function detectLanguage(): LanguageCode {
  if (typeof window === 'undefined') return FALLBACK;

  const stored = localStorage.getItem(STORAGE_KEY) as LanguageCode | null;
  if (stored && resources[stored]) return stored;

  const browser = navigator.language.split('-')[0] as LanguageCode;
  if (resources[browser]) return browser;

  return FALLBACK;
}

// ─── Context ──────────────────────────────────────────────────────────────────
interface I18nContextValue {
  language: LanguageCode;
  setLanguage: (code: LanguageCode) => Promise<boolean>;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────
export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLang] = useState<LanguageCode>(FALLBACK);

  // Hydrate from storage / browser on mount (client-only)
  useEffect(() => {
    const detected = detectLanguage();
    setLang(detected);
    applyDocumentAttributes(detected);
  }, []);

  const setLanguage = useCallback(async (code: LanguageCode): Promise<boolean> => {
    if (!resources[code]) return false;
    setLang(code);
    applyDocumentAttributes(code);
    localStorage.setItem(STORAGE_KEY, code);
    return true;
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      const value =
        deepGet(resources[language] as TranslationDict, key) ??
        deepGet(resources[FALLBACK] as TranslationDict, key) ??
        key;
      return interpolate(value, params);
    },
    [language],
  );

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
}

// ─── Typed hook ───────────────────────────────────────────────────────────────
export function useTranslation() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useTranslation must be used inside <I18nProvider>');
  return ctx;
}

// ─── Module-level state (mirrors i18next's singleton API) ─────────────────────
// Kept so helper functions below work without a React context.
let _currentLanguage: LanguageCode = FALLBACK;

function applyDocumentAttributes(code: LanguageCode) {
  _currentLanguage = code;
  if (typeof document === 'undefined') return;
  const lang = supportedLanguages.find((l) => l.code === code);
  document.documentElement.lang = code;
  document.documentElement.dir = lang?.dir ?? 'ltr';
}

// ─── Public utility helpers (same API as original index.ts) ──────────────────
export function getCurrentLanguage(): LanguageConfig {
  return supportedLanguages.find((l) => l.code === _currentLanguage) ?? supportedLanguages[0];
}

export async function changeLanguage(code: string): Promise<boolean> {
  const lang = supportedLanguages.find((l) => l.code === code);
  if (!lang) return false;
  _currentLanguage = code as LanguageCode;
  applyDocumentAttributes(code as LanguageCode);
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch {
    // SSR / private browsing
  }
  return true;
}

export function getTextDirection(code: string): 'ltr' | 'rtl' {
  return supportedLanguages.find((l) => l.code === code)?.dir ?? 'ltr';
}

export function isRTL(code?: string): boolean {
  return getTextDirection(code ?? _currentLanguage) === 'rtl';
}

export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  const locale = _currentLanguage === 'zh' ? 'zh-CN' : _currentLanguage;
  return new Intl.NumberFormat(locale, options).format(value);
}

export function formatCurrency(amount: number, currency = 'XLM'): string {
  const locale = _currentLanguage === 'zh' ? 'zh-CN' : _currentLanguage;
  // XLM is not an ISO 4217 code — format as decimal and append symbol
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 7,
    maximumFractionDigits: 7,
  }).format(amount);
  return `${formatted} ${currency}`;
}

export function formatDate(date: Date, options?: Intl.DateTimeFormatOptions): string {
  const locale = _currentLanguage === 'zh' ? 'zh-CN' : _currentLanguage;
  return new Intl.DateTimeFormat(locale, options).format(date);
}

export function getPluralForm(count: number): Intl.LDMLPluralRule {
  return new Intl.PluralRules(_currentLanguage).select(count);
}
