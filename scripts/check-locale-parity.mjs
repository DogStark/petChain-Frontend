// Verifies that every locale catalog under src/i18n/locales has the same set
// of keys as the base locale (en). Run via `npm run check:locales`.
//
// - Missing keys (present in en, absent in a target locale) are hard errors:
//   the app would silently fall back to English for that string.
// - Extra keys are reported as warnings only. Some locales (e.g. Russian)
//   legitimately define additional CLDR plural categories (`_one`, `_few`,
//   `_many`) that English doesn't need, so an extra key is not by itself a bug.
//
// Exits non-zero (and fails CI) only when a locale is missing keys.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCALES_DIR = path.join(__dirname, '..', 'src', 'i18n', 'locales');
const BASE_LOCALE = 'en';

function flatten(obj, prefix = '', out = new Set()) {
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      flatten(value, fullKey, out);
    } else {
      out.add(fullKey);
    }
  }
  return out;
}

function loadLocale(file) {
  const raw = fs.readFileSync(path.join(LOCALES_DIR, file), 'utf8');
  return JSON.parse(raw);
}

function main() {
  const files = fs.readdirSync(LOCALES_DIR).filter((f) => f.endsWith('.json'));
  const baseFile = `${BASE_LOCALE}.json`;

  if (!files.includes(baseFile)) {
    console.error(`Base locale "${baseFile}" not found in ${LOCALES_DIR}`);
    process.exit(1);
  }

  const baseKeys = flatten(loadLocale(baseFile));
  let hasMissing = false;

  for (const file of files) {
    if (file === baseFile) continue;
    const locale = path.basename(file, '.json');
    const keys = flatten(loadLocale(file));

    const missing = [...baseKeys].filter((k) => !keys.has(k)).sort();
    const extra = [...keys].filter((k) => !baseKeys.has(k)).sort();

    if (missing.length > 0) {
      hasMissing = true;
      console.error(`\n[${locale}] missing ${missing.length} key(s) present in ${BASE_LOCALE}:`);
      for (const k of missing) console.error(`  - ${k}`);
    }

    if (extra.length > 0) {
      console.warn(`\n[${locale}] has ${extra.length} extra key(s) not in ${BASE_LOCALE} (informational only):`);
      for (const k of extra) console.warn(`  + ${k}`);
    }
  }

  if (hasMissing) {
    console.error(
      `\nLocale catalogs are out of sync with ${BASE_LOCALE}.json. Add the missing keys (or remove them from ${BASE_LOCALE}.json) to keep catalogs structurally synchronized.`
    );
    process.exit(1);
  }

  console.log(`All locale catalogs are structurally in sync with ${BASE_LOCALE}.json.`);
}

main();
