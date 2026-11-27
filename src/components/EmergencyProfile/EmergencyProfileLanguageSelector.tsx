import React, { useMemo } from 'react';
import { AlertTriangle, Globe, Check } from 'lucide-react';
import { supportedLanguages, type LanguageCode } from '@/i18n';
import { resolveProfileLanguage, type LanguageResolution } from '@/utils/profileLanguage';
import en from '@/i18n/locales/en.json';
import es from '@/i18n/locales/es.json';
import fr from '@/i18n/locales/fr.json';
import de from '@/i18n/locales/de.json';
import zh from '@/i18n/locales/zh.json';
import ar from '@/i18n/locales/ar.json';
import hi from '@/i18n/locales/hi.json';
import pt from '@/i18n/locales/pt.json';
import ru from '@/i18n/locales/ru.json';
import ja from '@/i18n/locales/ja.json';

/** English is the translation baseline; everything is measured against it. */
const REFERENCE_DICT: Record<string, unknown> = en;

const LOCALE_DICTS: Record<LanguageCode, Record<string, unknown>> = {
  en,
  es,
  fr,
  de,
  zh,
  ar,
  hi,
  pt,
  ru,
  ja,
};

export interface EmergencyProfileLanguageSelectorProps {
  /** The language currently chosen for this pet's public profile. */
  current: LanguageCode;
  /** Called with the new selection. The parent owns persistence (backend / storage). */
  onChange: (code: LanguageCode) => void | Promise<void>;
  /** Optional id so the section can be referenced by aria-labelledby. */
  id?: string;
  /** Emergency profile fields to render translated (optional). */
  fields?: readonly EmergencyProfileField[];
  /** Translations for the profile fields, keyed by locale (optional). */
  translations?: EmergencyProfileTranslations;
}

/** A single translatable field of the emergency profile. */
export interface EmergencyProfileField {
  /** Stable key, e.g. `allergies`. */
  key: string;
  /** English (baseline) text for the field. */
  value: string;
}

/** Translation lookup for one locale: field key -> translated text. */
export type EmergencyProfileTranslation = Record<string, string>;

/** Translations keyed by locale; missing locales/keys fall back to English. */
export type EmergencyProfileTranslations = Partial<
  Record<LanguageCode, EmergencyProfileTranslation>
>;

/** A profile field after language resolution. */
export interface TranslatedProfileField extends EmergencyProfileField {
  /** Text to render (translated, or the English baseline). */
  text: string;
  /** True when no translation was available and English was used. */
  usedFallback: boolean;
}

export interface TranslatedEmergencyProfile {
  /** Locale actually used to render the profile. */
  language: LanguageCode;
  /** True when the requested locale could not be honoured. */
  usedFallback: boolean;
  /** Text direction for the rendered locale. */
  dir: 'ltr' | 'rtl';
  fields: TranslatedProfileField[];
}

/**
 * Translate emergency profile fields into `requested`, falling back to the
 * English baseline per field (and entirely when the locale is unsupported or
 * too incomplete). Pure and framework-free so it is trivially testable.
 */
export function translateEmergencyProfile(
  fields: readonly EmergencyProfileField[],
  requested: LanguageCode,
  translations: EmergencyProfileTranslations = {},
  reference: Record<string, unknown> = REFERENCE_DICT,
): TranslatedEmergencyProfile {
  const resolution: LanguageResolution = resolveProfileLanguage(
    requested,
    reference,
    (translations[requested] ?? {}) as Record<string, unknown>,
  );
  const dict = translations[resolution.resolved] ?? {};
  const dir = supportedLanguages.find((l) => l.code === resolution.resolved)?.dir ?? 'ltr';

  return {
    language: resolution.resolved,
    usedFallback: resolution.usedFallback,
    dir,
    fields: fields.map((field) => {
      const translated = dict[field.key];
      const hasTranslation = typeof translated === 'string' && translated.trim() !== '';
      return {
        ...field,
        text: hasTranslation ? translated : field.value,
        usedFallback: !hasTranslation,
      };
    }),
  };
}

/**
 * Lets a pet owner pick the language shown on a public emergency profile.
 *
 * It is accessibility-first (a real labelled <select> plus a live status
 * region) and never displays a half-translated profile: if the chosen locale
 * is missing too many strings, it transparently falls back to English and
 * explains why — keeping the consent/authorization decision on the backend.
 */
export function EmergencyProfileLanguageSelector({
  current,
  onChange,
  id = 'emergency-profile-language',
  fields,
  translations,
}: EmergencyProfileLanguageSelectorProps) {
  const selectId = `${id}-select`;
  const statusId = `${id}-status`;

  const resolution = useMemo(
    () => resolveProfileLanguage(current, REFERENCE_DICT, LOCALE_DICTS[current]),
    [current],
  );

  const translatedProfile = useMemo(
    () =>
      fields && fields.length > 0
        ? translateEmergencyProfile(fields, current, translations)
        : null,
    [fields, current, translations],
  );

  const coveragePct = Math.round(resolution.coverage * 100);

  return (
    <section
      id={id}
      aria-label="Emergency profile language"
      className="bg-white border border-red-100 rounded-2xl p-4 shadow-sm"
    >
      <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide flex items-center gap-2">
        <Globe size={16} className="text-red-600" aria-hidden="true" />
        Profile language
      </h2>
      <p className="text-xs text-gray-500 mt-1">
        Choose the language shown on this pet&apos;s public emergency profile.
      </p>

      <label htmlFor={selectId} className="sr-only">
        Profile language
      </label>
      <select
        id={selectId}
        value={current}
        aria-describedby={statusId}
        className="mt-3 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
        onChange={(e) => {
          const next = e.target.value as LanguageCode;
          void onChange(next);
        }}
      >
        {supportedLanguages.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.flag} {lang.nativeName} ({lang.name})
          </option>
        ))}
      </select>

      <p id={statusId} role="status" className="mt-2 text-xs font-semibold flex items-start gap-2">
        {resolution.usedFallback ? (
          <>
            <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
            <span className="text-amber-800">
              {`“${resolution.nativeName}” is only ${coveragePct}% translated, so the profile will be shown in English (${resolution.label}) until more translations are available.`}
            </span>
          </>
        ) : (
          <>
            <Check size={14} className="text-green-600 shrink-0 mt-0.5" aria-hidden="true" />
            <span className="text-green-700">
              {`The public profile will be shown in ${resolution.nativeName} (${coveragePct}% translated).`}
            </span>
          </>
        )}
      </p>

      {translatedProfile && (
        <dl
          lang={translatedProfile.language}
          dir={translatedProfile.dir}
          className="mt-3 space-y-1 rounded-xl bg-gray-50 p-3 text-sm text-gray-800"
        >
          {translatedProfile.fields.map((field) => (
            <div key={field.key} className="flex items-start justify-between gap-3">
              <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                {field.key}
              </dt>
              <dd className={field.usedFallback ? 'text-gray-500 italic' : undefined}>
                {field.text}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

export default EmergencyProfileLanguageSelector;
