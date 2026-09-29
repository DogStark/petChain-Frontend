import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

/**
 * Locale precedence (highest to lowest):
 *   1. Persisted preference (localStorage) — survives refresh and sign-in/out.
 *   2. Browser language (navigator.language / navigator.languages).
 *   3. DEFAULT_LOCALE fallback.
 *
 * Only the locale preference is persisted; no other user state is stored.
 */
export const DEFAULT_LOCALE = 'en';
export const SUPPORTED_LOCALES = ['en', 'es', 'fr', 'de', 'ja'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

const STORAGE_KEY = 'app.locale';

const isSupportedLocale = (value: unknown): value is Locale =>
  typeof value === 'string' &&
  (SUPPORTED_LOCALES as readonly string[]).includes(value);

/**
 * Deterministically resolve a locale from a raw candidate, falling back to the
 * default when the value is unsupported. Handles region subtags (e.g. "en-US").
 */
export const resolveLocale = (candidate: string | null | undefined): Locale => {
  if (!candidate) return DEFAULT_LOCALE;
  const normalized = candidate.toLowerCase();
  if (isSupportedLocale(normalized)) return normalized;
  const base = normalized.split('-')[0];
  return isSupportedLocale(base) ? base : DEFAULT_LOCALE;
};

/**
 * Read the persisted preference. Safe to call during SSR (returns null) so the
 * server and the first client render agree on the fallback locale.
 */
export const readPersistedLocale = (): Locale | null => {
  if (typeof window === 'undefined') return null;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isSupportedLocale(stored) ? stored : null;
  } catch {
    return null;
  }
};

/**
 * Resolve the initial locale using the documented precedence. During SSR and
 * the first client render this returns DEFAULT_LOCALE so markup matches; the
 * persisted/browser preference is applied in an effect after hydration.
 */
export const getInitialLocale = (): Locale => {
  const persisted = readPersistedLocale();
  if (persisted) return persisted;
  if (typeof navigator !== 'undefined') {
    const languages = navigator.languages ?? [navigator.language];
    for (const language of languages) {
      const resolved = resolveLocale(language);
      if (resolved !== DEFAULT_LOCALE || resolveLocale(language) === DEFAULT_LOCALE) {
        if (isSupportedLocale(resolveLocale(language))) return resolveLocale(language);
      }
    }
  }
  return DEFAULT_LOCALE;
};

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  isHydrated: boolean;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

interface LocaleProviderProps {
  children: ReactNode;
  /** Optional server-resolved locale to keep SSR and first client render aligned. */
  initialLocale?: Locale;
}

export function LocaleProvider({ children, initialLocale }: LocaleProviderProps) {
  // Always start from a deterministic value so server and client markup match.
  const [locale, setLocaleState] = useState<Locale>(initialLocale ?? DEFAULT_LOCALE);
  const [isHydrated, setIsHydrated] = useState(false);

  // After hydration, apply the persisted/browser preference exactly once.
  useEffect(() => {
    const next = getInitialLocale();
    setLocaleState((current) => (current === next ? current : next));
    setIsHydrated(true);
  }, []);

  const setLocale = useCallback((next: Locale) => {
    const resolved = resolveLocale(next);
    setLocaleState(resolved);
    try {
      window.localStorage.setItem(STORAGE_KEY, resolved);
    } catch {
      // Persistence is best-effort; ignore storage failures (private mode, etc.).
    }
  }, []);

  const value = useMemo<LocaleContextValue>(
    () => ({ locale, setLocale, isHydrated }),
    [locale, setLocale, isHydrated],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error('useLocale must be used within a LocaleProvider');
  }
  return context;
}
