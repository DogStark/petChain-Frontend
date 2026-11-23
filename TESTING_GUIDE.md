# Testing Guide

This document describes how to run the test suites and the conventions we follow when adding new coverage.

## Running tests

```bash
npm test            # run the full suite once
npm run test:watch  # watch mode for local development
```

## Route-level authorization matrix

Every protected page must be covered by the route authorization matrix in
`src/components/ProtectedRoute.test.tsx`. The matrix exercises each protected
route against the four supported viewer states:

| State | Description |
| --- | --- |
| `guest` | No authenticated session |
| `user` | Authenticated, no elevated role |
| `staff` | Authenticated staff member |
| `admin` | Authenticated administrator |

Protected routes currently covered:

- `/admin` (admin only)
- `/wallet` (user, staff, admin)
- `/records` (user, staff, admin)
- `/settings` (user, staff, admin)
- `/analytics` (staff, admin)

For each route/state combination the matrix asserts:

1. **UI behavior** — guests are redirected to the login page, unauthorized
   authenticated users see the access-denied state, and authorized users see
   the rendered page.
2. **API denial behavior** — unauthorized roles receive a denial response from
   the protected API endpoints backing the route, so client-side gating is
   never the only line of defense.

When adding a new protected page, add its route to the matrix and cover the
success, empty/loading, failure, and boundary cases for each applicable role.

## Fixtures

Never use real pet, medical, contact, wallet, or credential data in fixtures.
Use synthetic values only.
