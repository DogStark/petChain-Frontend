import {
  supportedLanguages,
  type LanguageCode,
  type LanguageConfig,
} from '@/i18n';

const SUPPORTED = new Set<LanguageCode>(supportedLanguages.map((l) => l.code));
const CONFIG = new Map<LanguageCode, LanguageConfig>(
  supportedLanguages.map((l) => [l.code, l]),
);

/** The locale used when a requested language is missing or incomplete. */
export const FALLBACK_LANGUAGE: LanguageCode = 'en';

/**
 * Flatten a (possibly nested) translation dictionary into a sorted-unique list
 * of dot-path keys, e.g. `{ a: { b: 'x' } }` -> `['a.b']`. Leaf arrays are
 * indexed as `a[0]` so array-shape drift is also caught.
 */
export function flattenKeys(value: unknown, prefix = ''): string[] {
  const out: string[] = [];
  if (value === null || typeof value !== 'object') {
    if (prefix) out.push(prefix);
    return out;
  }
  if (Array.isArray(value)) {
    value.forEach((item, i) => {
      const path = prefix ? `${prefix}[${i}]` : `${i}`;
      if (item !== null && typeof item === 'object') {
        out.push(...flattenKeys(item, path));
      } else {
        out.push(path);
      }
    });
    return out;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj);
  if (keys.length === 0 && prefix) {
    out.push(prefix);
    return out;
  }
  for (const key of keys) {
    const child = obj[key];
    const path = prefix ? `${prefix}.${key}` : key;
    if (child !== null && typeof child === 'object') {
      out.push(...flattenKeys(child, path));
    } else {
      out.push(path);
    }
  }
  return out;
}

/**
 * Fraction (0..1) of the reference locale's keys that are also present in
 * `target`. A value of 1 means the target is at least as complete as the
 * reference for the measured key set.
 */
export function coverageRatio(
  target: Record<string, unknown>,
  reference: Record<string, unknown>,
): number {
  const refKeys = flattenKeys(reference);
  if (refKeys.length === 0) return 1;
  const targetKeySet = new Set(flattenKeys(target));
  let present = 0;
  for (const k of refKeys) {
    if (targetKeySet.has(k)) present += 1;
  }
  return present / refKeys.length;
}

export interface LanguageResolution {
  /** The code the owner asked for. */
  requested: LanguageCode;
  /** The code we will actually render (may fall back to FALLBACK_LANGUAGE). */
  resolved: LanguageCode;
  /** True when we could not honour `requested` and fell back. */
  usedFallback: boolean;
  /** Measured completeness of `requested` vs the reference locale (0..1). */
  coverage: number;
  /** True when completeness is below `partialThreshold`. */
  isPartial: boolean;
  /** Approximate number of reference keys missing from `requested`. */
  missingKeys: number;
  /** Display label for `resolved`. */
  label: string;
  /** Native-language name for `resolved`. */
  nativeName: string;
  /** Text direction for `resolved`. */
  dir: 'ltr' | 'rtl';
}

/**
 * Resolve the language that should be shown on a public emergency profile.
 *
 * Rules:
 *  - If `requested` is not a supported locale, fall back entirely.
 *  - If `requested` is supported but its translation coverage is below
 *    `partialThreshold`, fall back so the profile is never shown in a
 *    half-translated state. Owners are told exactly why.
 *  - Otherwise honour the owner's choice.
 *
 * `reference` is normally the English dictionary (the translation baseline);
 * `target` is the dictionary for `requested`. Both are plain objects so this
 * helper stays framework-free and trivially testable.
 */
export function resolveProfileLanguage(
  requested: LanguageCode,
  reference: Record<string, unknown>,
  target: Record<string, unknown>,
  partialThreshold = 0.9,
): LanguageResolution {
  const fallbackConfig = CONFIG.get(FALLBACK_LANGUAGE)!;

  if (!SUPPORTED.has(requested)) {
    const refKeyCount = flattenKeys(reference).length;
    return {
      requested,
      resolved: FALLBACK_LANGUAGE,
      usedFallback: true,
      coverage: 0,
      isPartial: true,
      missingKeys: refKeyCount,
      label: fallbackConfig.name,
      nativeName: fallbackConfig.nativeName,
      dir: fallbackConfig.dir,
    };
  }

  const coverage = coverageRatio(target, reference);
  const isPartial = coverage < partialThreshold;
  const resolved: LanguageCode = isPartial ? FALLBACK_LANGUAGE : requested;
  const cfg = CONFIG.get(resolved)!;
  const refKeyCount = flattenKeys(reference).length;

  return {
    requested,
    resolved,
    usedFallback: resolved !== requested,
    coverage,
    isPartial,
    missingKeys: Math.max(0, Math.round((1 - coverage) * refKeyCount)),
    label: cfg.name,
    nativeName: cfg.nativeName,
    dir: cfg.dir,
  };
}
