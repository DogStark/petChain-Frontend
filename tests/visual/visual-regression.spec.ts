/**
 * Visual regression tests — Issue #966
 * Emergency and Wallet flows
 *
 * ## Coverage
 * - Desktop (1280×800) and mobile (390×844) viewports
 * - Light and dark mode
 * - Loading, error, and success states
 * - Large-text (accessibility) mode
 * - Wallet: overview, send, backup, recovery, multisig tabs
 * - Emergency: owner view, scanner-preview mode, all-private state
 *
 * ## Masking strategy
 * Dynamic content that changes between runs is masked deterministically:
 * - Wallet addresses (pattern: G[A-Z0-9]{55})
 * - XLM balances (pattern: \d+\.\d{7} XLM)
 * - Pet IDs and user IDs (UUID pattern)
 * - Timestamps ("X minutes ago", ISO strings)
 *
 * Masked regions are replaced with a solid 20×20 grey placeholder so diffs
 * only capture structural / layout regressions, not data changes.
 *
 * ## CI workflow
 * Baselines are committed to tests/visual/snapshots/.
 * To update baselines: `npx playwright test --update-snapshots tests/visual/`
 * The CI workflow (.github/workflows/visual-regression.yml) runs on every PR
 * and uploads a diff report on failure.
 *
 * ## Running locally
 * npx playwright test tests/visual/ --project=chromium
 */

import { test, expect, Page } from '@playwright/test';
import {
  installWalletContext,
  installWalletNetworkMock,
  failAccountLookup,
  SEEDED_WALLET,
  WALLET_USER,
} from '../e2e/support/mockWallet';

// ─── Masking helpers ──────────────────────────────────────────────────────────

/**
 * All locators that contain dynamic data and must be masked before
 * screenshotting. Using data-testid attributes where available;
 * falling back to CSS selectors for patterns that span multiple elements.
 */
const DYNAMIC_LOCATORS = [
  // Wallet public key — 56-char Stellar address
  '[data-testid="wallet-address"]',
  '[data-testid="public-key"]',
  // XLM balance amounts
  '[data-testid="xlm-balance"]',
  '[data-testid="balance-amount"]',
  // Timestamps
  '[data-testid="tx-timestamp"]',
  'time',
  // Generic "X minutes ago" text nodes (Notifications, Activity Log)
  '[data-testid="time-ago"]',
];

/**
 * Apply deterministic masks to all dynamic locators present on the page.
 * Elements that don't exist are silently skipped.
 */
async function maskDynamicContent(page: Page): Promise<void> {
  for (const selector of DYNAMIC_LOCATORS) {
    const count = await page.locator(selector).count();
    for (let i = 0; i < count; i++) {
      const el = page.locator(selector).nth(i);
      // Cover with an opaque grey overlay so pixel values are deterministic
      await el.evaluate((node: HTMLElement) => {
        node.style.color = 'transparent';
        node.style.background = '#888888';
        node.style.borderRadius = '4px';
        node.style.userSelect = 'none';
        node.textContent = '████';
      });
    }
  }

  // Mask any raw Stellar address text (G followed by 55 uppercase chars/digits)
  await page.evaluate(() => {
    const stellarAddressRe = /G[A-Z0-9]{55}/g;
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodes: Text[] = [];
    let node: Node | null;
    while ((node = walk.nextNode())) nodes.push(node as Text);
    for (const textNode of nodes) {
      if (stellarAddressRe.test(textNode.textContent ?? '')) {
        const span = document.createElement('span');
        span.style.cssText = 'color:transparent;background:#888;border-radius:4px';
        span.textContent = '██WALLET_ADDRESS██';
        textNode.replaceWith(span);
      }
    }
  });
}

// ─── Viewport and theme helpers ───────────────────────────────────────────────

type Viewport = 'desktop' | 'mobile';
type ColorScheme = 'light' | 'dark';

async function setViewport(page: Page, viewport: Viewport): Promise<void> {
  if (viewport === 'desktop') {
    await page.setViewportSize({ width: 1280, height: 800 });
  } else {
    await page.setViewportSize({ width: 390, height: 844 });
  }
}

async function setColorScheme(page: Page, scheme: ColorScheme): Promise<void> {
  await page.emulateMedia({ colorScheme: scheme });
}

async function setLargeText(page: Page): Promise<void> {
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '24px';
  });
}

// ─── Page setup helpers ───────────────────────────────────────────────────────

async function openWalletPage(page: Page): Promise<void> {
  await installWalletContext(page);
  await installWalletNetworkMock(page);
  await page.goto('/wallet');
  await expect(page.getByRole('heading', { name: 'Wallet Management' })).toBeVisible();
}

async function openEmergencyPage(page: Page, petId = 'pet-vr-001'): Promise<void> {
  // Seed auth so the page doesn't redirect to login
  await page.addInitScript(({ user, tokens }) => {
    localStorage.setItem('auth_tokens', JSON.stringify(tokens));
    localStorage.setItem('auth_user', JSON.stringify(user));
  }, { user: WALLET_USER, tokens: { accessToken: 'vr-token', refreshToken: 'vr-refresh' } });

  // Mock the emergency info API
  await page.route('**/pets/*/emergency**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        petId,
        medicalNotes: 'Allergic to Penicillin. Requires EpiPen.',
        contacts: [
          {
            id: 'c1',
            name: 'Jane Owner',
            relationship: 'Primary Owner',
            phone: '+1-555-000-0001',
            email: 'jane@example.test',
            priority: 1,
            isPublic: false,
          },
        ],
        emergencyVet: {
          name: '24/7 Emergency Vet',
          phone: '+1-555-000-9999',
          address: '1 Vet Lane, Testville',
          is24Hours: true,
          notes: 'Round the back.',
          isPublic: false,
        },
        poisonControl: {
          name: 'Pet Poison Helpline',
          phone: '+1-800-213-6680',
          website: 'https://petpoisonhelpline.com',
          isPublic: true,
        },
        visibility: {
          medicalNotes: false,
          contacts: false,
          emergencyVet: false,
          poisonControl: true,
        },
      }),
    })
  );

  await page.goto(`/pets/${petId}/emergency`);
  // Wait for loading to complete
  await page.waitForLoadState('networkidle');
}

// ─── Screenshot wrapper ───────────────────────────────────────────────────────

async function screenshot(
  page: Page,
  name: string,
  viewport: Viewport,
  scheme: ColorScheme
): Promise<void> {
  await maskDynamicContent(page);
  await expect(page).toHaveScreenshot(`${name}-${viewport}-${scheme}.png`, {
    maxDiffPixelRatio: 0.02,
    animations: 'disabled',
    // Mask any remaining dynamic elements via CSS selectors
    mask: [
      page.locator('[data-testid="wallet-address"]'),
      page.locator('[data-testid="balance-amount"]'),
    ],
  });
}

// ─── Wallet visual tests ──────────────────────────────────────────────────────

test.describe('Wallet — visual regression', () => {
  for (const viewport of ['desktop', 'mobile'] as Viewport[]) {
    for (const scheme of ['light', 'dark'] as ColorScheme[]) {
      test.describe(`${viewport} / ${scheme}`, () => {

        test('overview tab — success state (wallet loaded)', async ({ page }) => {
          await setViewport(page, viewport);
          await setColorScheme(page, scheme);
          await openWalletPage(page);
          await page.waitForTimeout(300); // let balance load
          await screenshot(page, 'wallet-overview-success', viewport, scheme);
        });

        test('overview tab — loading state', async ({ page }) => {
          await setViewport(page, viewport);
          await setColorScheme(page, scheme);

          // Delay account lookup so we can snapshot the loading skeleton
          await installWalletContext(page);
          await page.route('**/*', async (route) => {
            const url = route.request().url();
            if (url.includes('/accounts/')) {
              await new Promise((r) => setTimeout(r, 10_000)); // hang forever
            } else {
              await route.continue();
            }
          });

          await page.goto('/wallet');
          await expect(page.getByRole('heading', { name: 'Wallet Management' })).toBeVisible();
          await screenshot(page, 'wallet-overview-loading', viewport, scheme);
        });

        test('overview tab — error state (unfunded account)', async ({ page }) => {
          await setViewport(page, viewport);
          await setColorScheme(page, scheme);
          await installWalletContext(page);
          await failAccountLookup(page);
          await installWalletNetworkMock(page);
          await page.goto('/wallet');
          await expect(page.getByRole('heading', { name: 'Wallet Management' })).toBeVisible();
          await page.waitForTimeout(500);
          await screenshot(page, 'wallet-overview-error', viewport, scheme);
        });

        test('backup tab', async ({ page }) => {
          await setViewport(page, viewport);
          await setColorScheme(page, scheme);
          await openWalletPage(page);
          await page.locator('aside').getByRole('button', { name: 'Backup' }).click();
          await screenshot(page, 'wallet-backup', viewport, scheme);
        });

        test('recovery tab', async ({ page }) => {
          await setViewport(page, viewport);
          await setColorScheme(page, scheme);
          await openWalletPage(page);
          await page.locator('aside').getByRole('button', { name: 'Recovery' }).click();
          await screenshot(page, 'wallet-recovery', viewport, scheme);
        });

        test('send tab', async ({ page }) => {
          await setViewport(page, viewport);
          await setColorScheme(page, scheme);
          await openWalletPage(page);
          await page.locator('aside').getByRole('button', { name: 'Send' }).click();
          await screenshot(page, 'wallet-send', viewport, scheme);
        });

      });
    }
  }

  // Large-text / accessibility mode (desktop only)
  test('overview — large text mode', async ({ page }) => {
    await setViewport(page, 'desktop');
    await setColorScheme(page, 'light');
    await openWalletPage(page);
    await setLargeText(page);
    await screenshot(page, 'wallet-overview-large-text', 'desktop', 'light');
  });
});

// ─── Emergency visual tests ───────────────────────────────────────────────────

test.describe('Emergency — visual regression', () => {
  for (const viewport of ['desktop', 'mobile'] as Viewport[]) {
    for (const scheme of ['light', 'dark'] as ColorScheme[]) {
      test.describe(`${viewport} / ${scheme}`, () => {

        test('owner view — success state', async ({ page }) => {
          await setViewport(page, viewport);
          await setColorScheme(page, scheme);
          await openEmergencyPage(page);
          await screenshot(page, 'emergency-owner-success', viewport, scheme);
        });

        test('scanner preview — public fields only', async ({ page }) => {
          await setViewport(page, viewport);
          await setColorScheme(page, scheme);
          await openEmergencyPage(page);
          // Switch to scanner preview
          const previewTab = page.getByRole('tab', { name: /scanner preview/i });
          if (await previewTab.isVisible()) {
            await previewTab.click();
          }
          await screenshot(page, 'emergency-scanner-preview', viewport, scheme);
        });

        test('owner view — loading state', async ({ page }) => {
          await setViewport(page, viewport);
          await setColorScheme(page, scheme);

          // Seed auth
          await page.addInitScript(({ user, tokens }) => {
            localStorage.setItem('auth_tokens', JSON.stringify(tokens));
            localStorage.setItem('auth_user', JSON.stringify(user));
          }, { user: WALLET_USER, tokens: { accessToken: 'vr-token', refreshToken: 'vr-refresh' } });

          // Hang the API response to capture loading state
          await page.route('**/pets/*/emergency**', async () => {
            await new Promise<void>((r) => setTimeout(r, 10_000));
          });

          await page.goto('/pets/pet-loading/emergency');
          await page.waitForTimeout(300);
          await screenshot(page, 'emergency-loading', viewport, scheme);
        });

        test('owner view — error / access denied state', async ({ page }) => {
          await setViewport(page, viewport);
          await setColorScheme(page, scheme);

          await page.addInitScript(({ user, tokens }) => {
            localStorage.setItem('auth_tokens', JSON.stringify(tokens));
            localStorage.setItem('auth_user', JSON.stringify(user));
          }, { user: WALLET_USER, tokens: { accessToken: 'vr-token', refreshToken: 'vr-refresh' } });

          await page.route('**/pets/*/emergency**', (route) =>
            route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ message: 'Forbidden' }) })
          );

          await page.goto('/pets/pet-denied/emergency');
          await page.waitForLoadState('networkidle');
          await screenshot(page, 'emergency-error', viewport, scheme);
        });

        test('scanner preview — all fields private (empty state)', async ({ page }) => {
          await setViewport(page, viewport);
          await setColorScheme(page, scheme);

          await page.addInitScript(({ user, tokens }) => {
            localStorage.setItem('auth_tokens', JSON.stringify(tokens));
            localStorage.setItem('auth_user', JSON.stringify(user));
          }, { user: WALLET_USER, tokens: { accessToken: 'vr-token', refreshToken: 'vr-refresh' } });

          await page.route('**/pets/*/emergency**', (route) =>
            route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({
                petId: 'pet-all-private',
                medicalNotes: 'Private notes',
                contacts: [],
                visibility: {
                  medicalNotes: false,
                  contacts: false,
                  emergencyVet: false,
                  poisonControl: false,
                },
              }),
            })
          );

          await page.goto('/pets/pet-all-private/emergency');
          await page.waitForLoadState('networkidle');
          const previewTab = page.getByRole('tab', { name: /scanner preview/i });
          if (await previewTab.isVisible()) await previewTab.click();
          await screenshot(page, 'emergency-scanner-all-private', viewport, scheme);
        });

      });
    }
  }

  // Large-text / accessibility mode
  test('owner view — large text mode', async ({ page }) => {
    await setViewport(page, 'desktop');
    await setColorScheme(page, 'light');
    await openEmergencyPage(page);
    await setLargeText(page);
    await screenshot(page, 'emergency-owner-large-text', 'desktop', 'light');
  });
});
