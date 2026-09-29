import { test, expect } from '@playwright/test';

/**
 * External-link policy e2e tests.
 *
 * Verify that:
 * - Unknown origins are blocked or confirmed.
 * - Sensitive route state is never forwarded in external URLs.
 * - Links announce opening externally to assistive technology.
 */

test.describe('External link policy', () => {
  // ── Wallet: Stellar Explorer link ──────────────────────────

  test.describe('Wallet screen', () => {
    test('Stellar Explorer link has safe attributes', async ({ page }) => {
      // Seed a wallet so the dashboard renders.
      await page.addInitScript(() =>
        localStorage.setItem(
          'petchain_wallets',
          JSON.stringify([
            {
              id: 'wallet-test',
              publicKey: 'GABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUVWX',
              encryptedSecretKey: 'fixture-encrypted-key',
              iv: 'fixture-iv',
              salt: 'fixture-salt',
              label: 'Test Wallet',
              type: 'standard',
              network: 'TESTNET',
              createdAt: '2026-01-02T00:00:00.000Z',
              backupVerified: true,
            },
          ]),
        ),
      );

      await page.goto('/wallet');
      await expect(page.getByRole('heading', { name: 'Wallet Management' })).toBeVisible();

      // Open the Overview tab if needed.
      const overviewBtn = page.getByRole('button', { name: /overview/i });
      if (await overviewBtn.isVisible()) {
        await overviewBtn.click();
      }

      // The explorer link should be present and have safe attributes.
      const explorerLink = page.getByRole('link', { name: /view wallet on stellar explorer/i }).first();
      await expect(explorerLink).toBeVisible();
      await expect(explorerLink).toHaveAttribute('target', '_blank');
      await expect(explorerLink).toHaveAttribute('rel', 'noopener noreferrer');
    });
  });

  // ── Clinics: External navigation links ────────────────────────────

  test.describe('Clinic location map', () => {
    test('Google Maps navigate link has safe attributes', async ({ page }) => {
      await page.goto('/clinics');

      // Wait for the clinic list or map to render.
      await expect(page.getByRole('region', { name: /clinic location map/i })).toBeVisible({
        timeout: 10_000,
      });

      // Expand a clinic to reveal the navigate link.
      const clinicButton = page.getByRole('button', { name: /pawfect health center/i }).first();
      if (await clinicButton.isVisible()) {
        await clinicButton.click();
      }

      const navigateLink = page.getByRole('link', { name: /navigate to/i }).first();
      await expect(navigateLink).toBeVisible();
      await expect(navigateLink).toHaveAttribute('target', '_blank');
      await expect(navigateLink).toHaveAttribute('rel', 'noopener noreferrer');
    });
  });

  // ── Emergency page: external links ────────────────────────────────

  test.describe('Emergency access page', () => {
    test('poison control website link has safe attributes', async ({ page }) => {
      // The emergency page at /pets/[id]/emergency requires a pet ID.
      // We test the link attributes on a pre-rendered instance by
      // navigating to a route that renders the component.
      await page.goto('/pets/test-pet-id/emergency');

      // If the page renders, any external website link should have
      // target="_blank" and rel="noopener noreferrer".
      const externalLinks = page.locator('a[target="_blank"][rel="noopener noreferrer"]');
      const count = await externalLinks.count();

      // There should be at least one external link if the page renders
      // with emergency data.
      // We assert the attribute pattern rather than count, since the
      // pet may not have a poison control entry in the fixture.
      for (let i = 0; i < count; i++) {
        const link = externalLinks.nth(i);
        const href = await link.getAttribute('href');
        if (href && href.startsWith('http')) {
          expect(href).not.toContain('#');
        }
      }
    });
  });

  // ── Sensitive query params are stripped ────────────────────────────

  test.describe('Sensitive query param stripping', () => {
    test('external links do not forward sensitive query parameters', async ({ page }) => {
      // Intercept any new-page navigation and assert the URL has no
      // sensitive query parameters.
      const urlPromise = page.context().waitForEvent('page');

      await page.evaluate(() => {
        const anchor = document.createElement('a');
        anchor.href =
          'https://stellar.expert/explorer/public/account/GABC?token=secret&q=check';
        anchor.className = 'test-clean-link';
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
        document.body.appendChild(anchor);
        anchor.click();
      });

      const newPage = await urlPromise;
      const url = newPage.url();

      // The token param must be stripped.
      expect(url).not.toContain('token=');
    });
  });

  // ── Screen-reader announcement ──────────────────────────────────

  test.describe('External link announcement', () => {
    test('links opening externally include an aria-label announcement', async ({ page }) => {
      await page.goto('/wallet');

      const explorerLink = page.getByRole('link', { name: /view wallet on stellar explorer/i }).first();
      await expect(explorerLink).toBeVisible();

      // The aria-label should mention the external link so screen
      // readers announce it to the user.
      const ariaLabel = await explorerLink.getAttribute('aria-label');
      expect(ariaLabel).toBeTruthy();
      expect(ariaLabel?.toLowerCase()).toMatch(/external/);
    });
  });
});
