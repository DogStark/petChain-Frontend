import ar from './locales/ar.json';
import de from './locales/de.json';
import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import hi from './locales/hi.json';
import ja from './locales/ja.json';
import pt from './locales/pt.json';
import ru from './locales/ru.json';
import zh from './locales/zh.json';

const locales = { en, es, fr, de, zh, ar, hi, pt, ru, ja };

function flattenKeys(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) return [prefix];

  return Object.entries(value).flatMap(([key, child]) =>
    flattenKeys(child, prefix ? `${prefix}.${key}` : key),
  );
}

describe('API error localization keys', () => {
  it('has identical API error keys in every supported language', () => {
    const expected = flattenKeys(en.errors.api).sort();

    for (const [language, locale] of Object.entries(locales)) {
      expect(flattenKeys(locale.errors.api).sort()).toEqual(expected);
      expect(language).toBeTruthy();
    }

    expect(expected).toContain('unknownWithCorrelation');
    expect(expected).toContain('validation.petNameRequired');
    expect(expected).toContain('validation.invalidId');
  });
});
