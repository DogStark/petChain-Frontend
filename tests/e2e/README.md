# Authentication E2E tests

Playwright coverage for the login → verification → 2FA → session
refresh/expiry → logout journey (`auth.spec.ts`). The auth API
(`/api/v1/auth/**`) is mocked per-test via `support/mockAuthApi.ts`, so these
tests only need the Next.js dev server, no backend.

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
