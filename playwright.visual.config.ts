/**
 * Playwright configuration for visual regression tests — Issue #966
 *
 * Run locally:
 *   npx playwright test --config playwright.visual.config.ts
 *
 * Update baselines:
 *   npx playwright test --config playwright.visual.config.ts --update-snapshots
 *
 * This config is separate from the main playwright.config.ts (which covers
 * auth and wallet e2e journeys) to keep visual snapshots isolated from
 * functional tests, and to allow independent baseline update cycles.
 */

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/visual',
  /** Snapshot directory — committed to version control alongside the tests. */
  snapshotDir: './tests/visual/snapshots',
  /**
   * Fail the run if any .spec.ts file calls `test.only()` — this prevents
   * accidentally committing a focused test that skips baseline verification.
   */
  forbidOnly: !!process.env.CI,
  /**
   * No retries for visual tests — a flaky screenshot diff should be
   * investigated, not retried automatically.
   */
  retries: 0,
  /**
   * Three workers so each shard runs tests in parallel.
   * Set to 1 locally if you notice rendering non-determinism.
   */
  workers: process.env.CI ? 1 : 2,
  reporter: [
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['list'],
  ],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    /**
     * Disable CSS animations globally so screenshots are deterministic.
     * Individual tests can override this if they need to test animation states.
     */
    launchOptions: {
      args: ['--force-prefers-reduced-motion'],
    },
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        /**
         * Fix the viewport here as the default; individual tests call
         * page.setViewportSize() for mobile vs. desktop variants.
         */
        viewport: { width: 1280, height: 800 },
      },
    },
  ],
  /**
   * Threshold applied to all toHaveScreenshot() calls unless overridden.
   * 0.01 = 1% of pixels may differ — tight enough to catch layout regressions
   * while tolerating sub-pixel anti-aliasing differences across platforms.
   */
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.01,
      animations: 'disabled',
    },
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
