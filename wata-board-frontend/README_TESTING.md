```bash
# Run all tests (all browsers)
npm run test

# Run tests in specific browser
npx playwright test --project=firefox
npx playwright test --project=webkit
npx playwright test --project="Mobile Safari"

# Run tests in UI mode
npx playwright test --ui

# Debug a specific test
npx playwright test tests/integration/payment.spec.ts --debug
```

## Cross-Browser Testing

Playwright is configured to run tests across:
- **Chromium** (Desktop Chrome, Google Chrome, Microsoft Edge)
- **Firefox** (Desktop Firefox)
- **Webkit** (Desktop Safari)
- **Mobile Viewports** (Pixel 5, iPhone 12)

If a browser is missing in your environment, install it with:
```bash
npx playwright install
```

## Test Suites

- `tests/integration/payment.spec.ts`: Tests the core payment flow, including Freighter wallet connection, fee estimation, and transaction submission. Uses extensive mocking to simulate the Stellar network and wallet-bridge.
- `tests/integration/scheduling.spec.ts`: Tests the recurring payment scheduling feature.
- `tests/crash.spec.ts`: Smoke test to ensure the app renders without crashing.

## Infrastructure

To handle environmental differences and lack of a real wallet in CI, we use several techniques:
1. **Wallet Injection**: Mock objects are injected into `window.freighter` and `window.freighterApi` via `page.addInitScript`.
2. **Network Interception**: Playwright's `page.route` intercepts calls to Stellar Horizon (**/horizon/**) to provide consistent account and ledger data.
3. **Transaction Mocking**: To bypass internal SDK validation issues in Playwright, the app supports `window.__MOCK_STELLAR_TRANSACTION__` which allows tests to provide a stubbed transaction object.

## Troubleshooting

- **"Cannot read properties of undefined (reading 'type')"**: This often occurs when the Stellar SDK `TransactionBuilder` or `Operation` receives malformed data. Check the mocks in use and ensure all required properties (id, sequenceNumber, etc.) are present.
- **Timeouts**: The app performs async operations like fee estimation. Tests are configured with 15s timeouts to accommodate these.
