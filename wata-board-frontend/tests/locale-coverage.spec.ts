import { test, expect } from '@playwright/test';

const NEW_LOCALES = ['fr-CA', 'pt-BR', 'sw'] as const;

test.describe('New locale coverage', () => {
  for (const locale of NEW_LOCALES) {
    test(`/${locale} renders without missing-key warnings`, async ({ page }) => {
      const missingKeys: string[] = [];

      page.on('console', (msg) => {
        const text = msg.text();
        if (text.includes('i18next') && text.includes('missing')) {
          missingKeys.push(text);
        }
      });

      // Set the locale before navigation (this project uses localStorage, not URL path)
      await page.addInitScript((lng) => {
        localStorage.setItem('wata-board-language', lng);
      }, locale);

      await page.goto('/');
      await page.waitForSelector('h1', { timeout: 15000 });

      // Verify the locale is active
      const activeLang = await page.evaluate(() =>
        localStorage.getItem('wata-board-language'),
      );
      expect(activeLang).toBe(locale);

      // Assert no missing translation keys
      expect(missingKeys).toEqual([]);
    });
  }
});
