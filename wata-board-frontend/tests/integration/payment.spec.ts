import { test, expect } from '@playwright/test';

test.describe('Payment Flow Integration', () => {
  test('should complete the payment flow with mock wallet', async ({ page }) => {
    // Valid-looking public key
    const mockPublicKey = 'GDOPTS553GBKXNF3X4YCQ7NPZUQ644QAN4SV7JEZHAVOVROAUQTSKEHO';
    
    // Inject mock Freighter AND mock SDK logic BEFORE goto
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
        signTransaction: (xdr: string) => Promise.resolve({ signedTxXdr: 'SIGNED_XDR_MOCK' }),
      };

      // Mock the heavy SDK calls that fail in playwright due to environmental string issues
      // @ts-ignore
      window.__MOCK_STELLAR_ACCOUNT__ = (id) => ({
          id: id,
          accountId: () => id, // Essential for TransactionBuilder
          sequence: "100",
          sequenceNumber: () => "100",
          incrementSequenceNumber: () => {}, // Essential for TransactionBuilder
          balances: [{ asset_type: 'native', balance: '1000.00' }]
      });
      
      // @ts-ignore
      window.__MOCK_STELLAR_TRANSACTION__ = (account, amount) => ({
          toXDR: () => 'AAAA_MOCK_XDR_FOR_TESTS',
          operations: [{}],
          fee: '100'
      });
      
      console.log('Freighter & SDK Mocks Injected with Account interface');
    }, mockPublicKey);

    // Intercept Horizon calls for consistent behavior
    await page.route('**/horizon/**', async route => {
      const url = route.request().url();
      if (url.includes('accounts')) {
        await route.fulfill({ 
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ 
            id: mockPublicKey,
            accountId: mockPublicKey,
            sequence: "100",
            balances: [{ asset_type: 'native', balance: '1000.00' }]
          }) 
        });
      } else if (url.includes('ledgers')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            _embedded: {
              records: [
                { base_fee_in_stroops: 100, base_reserve_in_stroops: 5000000 }
              ]
            }
          })
        });
      } else if (route.request().method() === 'POST' && url.includes('transactions')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ hash: "MOCK_TRANSACTION_HASH_FOR_E2E_TESTING" })
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/', { waitUntil: 'networkidle' });
    page.on('console', msg => console.log('BROWSER LOG: ' + msg.text()));

    await page.getByLabel(/meter number/i).fill('METER-456');
    await page.getByLabel(/amount/i).fill('50');
    
    // Wait for the balance to be LOADED.
    const balanceLocator = page.locator('.text-lg.font-semibold');
    await expect(balanceLocator).toBeVisible({ timeout: 15000 });
    await expect(balanceLocator).toContainText(/1,000.00/, { timeout: 15000 });
    
    // Now click pay (the app will await fee estimation if needed)
    await page.getByTestId('pay-button').click();
    
    // Check for success message
    await expect(page.getByTestId('payment-status')).toContainText(/successful/i, { timeout: 15000 });
  });

  test('should show error if no freighter wallet', async ({ page }) => {
    await page.addInitScript(() => {
	  // @ts-ignore
      window.freighter = false;
      // @ts-ignore
      window.freighterApi = {
        isConnected: () => Promise.resolve({ isConnected: false }),
      };
    });

    await page.goto('/', { waitUntil: 'networkidle' });
    await page.getByLabel(/meter number/i).fill('METER-123');
    await page.getByLabel(/amount/i).fill('100');
    await page.getByTestId('pay-button').click();
    await expect(page.getByTestId('payment-status')).toContainText(/install Freighter Wallet/i, { timeout: 15000 });
  });
});
