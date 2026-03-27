import { test, expect } from '@playwright/test';

test.describe('Scheduling Payment Flow', () => {
  test('should create a new payment schedule', async ({ page }) => {
    const mockPublicKey = 'GDOPTS553GBKXNF3X4YCQ7NPZUQ644QAN4SV7JEZHAVOVROAUQTSKEHO';
    
    // Inject mock wallet
    await page.addInitScript((pubKey) => {
      // @ts-ignore
      window.freighter = {
          isConnected: () => Promise.resolve(true),
          requestAccess: () => Promise.resolve(pubKey),
          getPublicKey: () => Promise.resolve(pubKey),
          getNetwork: () => Promise.resolve('TESTNET'),
          signTransaction: (xdr: string) => Promise.resolve({ signedTxXdr: xdr }),
      };
      // @ts-ignore
      window.freighterApi = {
        isConnected: () => Promise.resolve({ isConnected: true }),
        requestAccess: () => Promise.resolve({ publicKey: pubKey }),
        getAddress: () => Promise.resolve({ address: pubKey }),
        signTransaction: (xdr: string) => Promise.resolve({ signedTxXdr: xdr }),
      };
    }, mockPublicKey);

    await page.goto('/schedules', { waitUntil: 'networkidle' });

    // Click "+" button to create new schedule
    await page.getByLabel(/create new payment schedule/i).click();

    // Fill form
    await page.getByLabel(/meter number/i).fill('METER-SCHEDULED-789');
    await page.getByLabel(/amount/i).fill('25');
    
    // Select frequency
    await page.locator('select').selectOption('WEEKLY');
    
    // Click create
    await page.getByRole('button', { name: /create schedule/i }).click();

    // Should return to list and show the new schedule (it uses localStorage/service mock)
    await expect(page.getByText(/METER-SCHEDULED-789/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/weekly/i)).toBeVisible();
  });

  test('should show validation errors for invalid input', async ({ page }) => {
    await page.goto('/schedules', { waitUntil: 'networkidle' });
    await page.getByLabel(/create new payment schedule/i).click();
    
    // Try to submit empty
    await page.getByRole('button', { name: /create schedule/i }).click();
    
    // Should show error for meter ID (defined in SchedulingService)
    await expect(page.getByText(/meter ID is required/i)).toBeVisible();
  });
});
