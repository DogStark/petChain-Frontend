# PetChain frontend wallet helpers

This package currently hosts focused wallet UX helpers that the main UI can import
without coupling to NestJS backend modules.

## Transaction lifecycle

`src/wallet/txLifecycle.ts` models Stellar pending / replace / cancel flows:

- Distinct states: pending, submitted, confirmed, failed, replaced, cancelled, unknown
- Polling stops on terminal states and is safe to resume after reload
- Replacement is recorded against the prior hash (not treated as a new user action)

Run tests:

```bash
node --test frontend/src/wallet/txLifecycle.test.mjs
```
