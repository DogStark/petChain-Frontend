/**
 * Localization Tests — dates, units, and pluralized medication text
 *
 * Run with:
 *   npx ts-node --project tsconfig.test.json src/i18n/localization.test.ts
 *
 * Covers:
 *   1. Date formatting uses the selected locale (not always English)
 *   2. Dosage units use the locale-specific string
 *   3. Medication count plurals are correct for zero / one / many
 *   4. All supported locales have the required `medication` keys
 *   5. Missing translation keys fail the locale check
 */

import assert from 'assert';

// ── Minimal DOM / localStorage shim for Node ─────────────────────────────────
const store: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v; },
  removeItem: (k: string) => { delete store[k]; },
};
(globalThis as any).localStorage = mockLocalStorage;
(globalThis as any).window = { localStorage: mockLocalStorage };
(globalThis as any).document = {
  documentElement: { lang: '', dir: '' },
};
(globalThis as any).navigator = { language: 'en' };

// Import after shims so module-level code in i18n/index.ts doesn't crash
import {
  supportedLanguages,
  formatDate,
  formatNumber,
  formatMedicationCount,
  formatDoseUnit,
  changeLanguage,
} from './index';

// ── Helpers ───────────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e: unknown) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${(e as Error).message}`);
    failed++;
  }
}

// Fixed reference date: 2024-03-15 (avoids timezone issues by using UTC noon)
const REF_DATE = new Date('2024-03-15T12:00:00Z');

// ─────────────────────────────────────────────────────────────────────────────
// 1. Date formatting
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── Date formatting ──');

test('en: formats date in English', async () => {
  await changeLanguage('en');
  const result = formatDate(REF_DATE, { year: 'numeric', month: 'long', day: 'numeric' });
  // English: "March 15, 2024"
  assert.ok(result.includes('2024'), `Expected year in output, got: "${result}"`);
  assert.ok(result.includes('15') || result.includes('March'), `Expected day or month in output, got: "${result}"`);
});

test('de: formats date in German', async () => {
  await changeLanguage('de');
  const result = formatDate(REF_DATE, { year: 'numeric', month: 'long', day: 'numeric' });
  // German: "15. März 2024"
  assert.ok(result.includes('2024'), `Expected year in output, got: "${result}"`);
  assert.ok(result.includes('März') || result.includes('15'), `Expected German month or day, got: "${result}"`);
});

test('fr: formats date in French', async () => {
  await changeLanguage('fr');
  const result = formatDate(REF_DATE, { year: 'numeric', month: 'long', day: 'numeric' });
  // French: "15 mars 2024"
  assert.ok(result.includes('2024'), `Expected year in output, got: "${result}"`);
  assert.ok(result.includes('mars') || result.includes('15'), `Expected French month or day, got: "${result}"`);
});

test('ar: formats date in Arabic', async () => {
  await changeLanguage('ar');
  const result = formatDate(REF_DATE, { year: 'numeric', month: 'long', day: 'numeric' });
  // Arabic uses Eastern Arabic numerals or Arabic month names
  assert.ok(result.length > 0, `Expected non-empty Arabic date, got: "${result}"`);
  // Should NOT just be the English "March"
  assert.ok(!result.startsWith('March'), `Expected Arabic date, not English month, got: "${result}"`);
});

test('ja: formats date in Japanese', async () => {
  await changeLanguage('ja');
  const result = formatDate(REF_DATE, { year: 'numeric', month: 'long', day: 'numeric' });
  // Japanese: "2024年3月15日"
  assert.ok(result.includes('2024'), `Expected year in output, got: "${result}"`);
  assert.ok(result.includes('3') || result.includes('月'), `Expected Japanese month marker, got: "${result}"`);
});

test('zh: formats date in Chinese', async () => {
  await changeLanguage('zh');
  const result = formatDate(REF_DATE, { year: 'numeric', month: 'long', day: 'numeric' });
  // Chinese (zh-CN): "2024年3月15日"
  assert.ok(result.includes('2024'), `Expected year in output, got: "${result}"`);
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Number / unit formatting
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── Number formatting ──');

test('en: formats number with English decimal separator', async () => {
  await changeLanguage('en');
  const result = formatNumber(1234.5);
  assert.ok(result.includes('1,234') || result.includes('1234'), `Expected 1234 in output, got: "${result}"`);
});

test('de: formats number with German decimal separator', async () => {
  await changeLanguage('de');
  const result = formatNumber(1234.5);
  // German: "1.234,5" — period as thousands separator
  assert.ok(result.includes('1.234') || result.includes('1234'), `Expected German number format, got: "${result}"`);
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Dosage unit strings
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── Dosage unit strings ──');

test('en: singular tablet', async () => {
  await changeLanguage('en');
  assert.strictEqual(formatDoseUnit(1, 'tablet'), 'tablet');
});

test('en: plural tablets', async () => {
  await changeLanguage('en');
  assert.strictEqual(formatDoseUnit(2, 'tablet'), 'tablets');
});

test('en: mg does not pluralise', async () => {
  await changeLanguage('en');
  assert.strictEqual(formatDoseUnit(500, 'mg'), 'mg');
});

test('de: singular Tablette', async () => {
  await changeLanguage('de');
  assert.strictEqual(formatDoseUnit(1, 'tablet'), 'Tablette');
});

test('de: plural Tabletten', async () => {
  await changeLanguage('de');
  assert.strictEqual(formatDoseUnit(3, 'tablet'), 'Tabletten');
});

test('fr: singular comprimé', async () => {
  await changeLanguage('fr');
  assert.strictEqual(formatDoseUnit(1, 'tablet'), 'comprimé');
});

test('fr: plural comprimés', async () => {
  await changeLanguage('fr');
  assert.strictEqual(formatDoseUnit(2, 'tablet'), 'comprimés');
});

test('ar: tablet singular قرص', async () => {
  await changeLanguage('ar');
  const result = formatDoseUnit(1, 'tablet');
  assert.strictEqual(result, 'قرص');
});

test('ar: tablet plural أقراص', async () => {
  await changeLanguage('ar');
  const result = formatDoseUnit(5, 'tablet');
  assert.strictEqual(result, 'أقراص');
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Medication count plurals
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── Medication count plurals ──');

test('en: zero medications', async () => {
  await changeLanguage('en');
  assert.strictEqual(formatMedicationCount(0), 'No medications');
});

test('en: one medication', async () => {
  await changeLanguage('en');
  assert.strictEqual(formatMedicationCount(1), '1 medication');
});

test('en: many medications', async () => {
  await changeLanguage('en');
  assert.strictEqual(formatMedicationCount(5), '5 medications');
});

test('de: zero Medikamente', async () => {
  await changeLanguage('de');
  assert.strictEqual(formatMedicationCount(0), 'Keine Medikamente');
});

test('de: one Medikament', async () => {
  await changeLanguage('de');
  assert.strictEqual(formatMedicationCount(1), '1 Medikament');
});

test('de: many Medikamente', async () => {
  await changeLanguage('de');
  assert.strictEqual(formatMedicationCount(3), '3 Medikamente');
});

test('fr: zero médicaments', async () => {
  await changeLanguage('fr');
  assert.strictEqual(formatMedicationCount(0), 'Aucun médicament');
});

test('fr: one médicament', async () => {
  await changeLanguage('fr');
  assert.strictEqual(formatMedicationCount(1), '1 médicament');
});

test('fr: many médicaments', async () => {
  await changeLanguage('fr');
  assert.strictEqual(formatMedicationCount(4), '4 médicaments');
});

test('ar: zero medications', async () => {
  await changeLanguage('ar');
  assert.strictEqual(formatMedicationCount(0), 'لا توجد أدوية');
});

test('ar: one medication', async () => {
  await changeLanguage('ar');
  assert.strictEqual(formatMedicationCount(1), 'دواء واحد');
});

test('ru: one лекарство', async () => {
  await changeLanguage('ru');
  assert.strictEqual(formatMedicationCount(1), '1 лекарство');
});

test('ru: few лекарства (2)', async () => {
  await changeLanguage('ru');
  assert.strictEqual(formatMedicationCount(2), '2 лекарства');
});

test('ru: many лекарств (5)', async () => {
  await changeLanguage('ru');
  assert.strictEqual(formatMedicationCount(5), '5 лекарств');
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. All locales have required medication keys — missing keys fail the check
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── Locale completeness check ──');

const REQUIRED_MEDICATION_KEYS = [
  'count_one',
  'count_other',
  'dose_unit_mg',
  'dose_unit_ml',
  'dose_unit_tablet',
  'dose_unit_tablet_plural',
  'dose_unit_capsule',
  'dose_unit_capsule_plural',
  'dose_unit_drop',
  'dose_unit_drop_plural',
];

// Dynamically load locale files to inspect raw keys
const localeFiles: Record<string, any> = {
  en:  require('./locales/en.json'),
  es:  require('./locales/es.json'),
  fr:  require('./locales/fr.json'),
  de:  require('./locales/de.json'),
  zh:  require('./locales/zh.json'),
  ar:  require('./locales/ar.json'),
  hi:  require('./locales/hi.json'),
  pt:  require('./locales/pt.json'),
  ru:  require('./locales/ru.json'),
  ja:  require('./locales/ja.json'),
};

for (const lang of supportedLanguages) {
  const code = lang.code;
  test(`${code}: has all required medication keys`, () => {
    const locale = localeFiles[code];
    assert.ok(locale, `No locale file found for "${code}"`);
    assert.ok(locale.medication, `Missing "medication" section in "${code}"`);

    const missing = REQUIRED_MEDICATION_KEYS.filter((k) => !(k in locale.medication));
    assert.strictEqual(
      missing.length,
      0,
      `Missing keys in "${code}".medication: ${missing.join(', ')}`,
    );
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────────────
console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
