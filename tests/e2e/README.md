# End-to-end tests

Playwright coverage for the wallet and authentication journeys.

## Wallet E2E tests

`wallet.spec.ts` covers the Stellar wallet journeys in `src/pages/wallet.tsx`:

- **Setup** — create-wallet PIN validation (weak/mismatched) and import
  secret-key format validation.
- **Backup** — exporting an encrypted backup and recovering from an incorrect
  PIN.
- **Recovery** — parsing a malformed backup and rejecting an incomplete one.
- **Signing** — client-side guards: PIN required, invalid destination, and
  insufficient balance.
- **Failure recovery** — an unfunded account (failed Horizon lookup) must not
  crash the wallet page.

The Stellar network boundary (Horizon account lookups, fee stats, and the
testnet friendbot) is mocked deterministically via `support/mockWallet.ts`, and
auth + wallet state are seeded into `localStorage` — no real backend or live
Stellar network is required.

## Auth E2E tests

`auth.spec.ts` covers the login → verification → 2FA → session
refresh/expiry → logout journey. The auth API (`/api/v1/auth/**`) is mocked
per-test via `support/mockAuthApi.ts`, so these tests only need the Next.js dev
server, no backend.

## Setup (one-time)

```bash
npm install
npx playwright install --with-deps chromium
```

## Run

```bash
npm run test:e2e
```

`playwright.config.ts` boots `npm run dev` automatically and points the
tests at `http://localhost:3000`; set `E2E_BASE_URL` to target a different
environment instead.
