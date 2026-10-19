# API Data Classification & Privacy Map

This document is the field-level reference for how the frontend treats data across the medical, contact, wallet, analytics, and public QR domains. It is the source of truth for data handling decisions and must stay in sync with `src/lib/api`, `src/lib/wallet`, `src/lib/offline`, `src/lib/gdpr.ts`, and the privacy-sensitive components.

## Classification Levels

- **P0 - Restricted:** information that, if disclosed, poses a high risk (medical records, wallet private material, credentials). Owner-gated, transport/TLS only, never logged.
- **P1 - Sensitive:** personal information with limited disclosure (name, contact details, linking pet↔owner). Transport/TLS, guarded logging, shared only with explicit consent.
- **P2 - Internal:** aggregated or operational data (analytics, metrics). Internal use, safe to log in aggregate.
- **P3 - Public:** deliberately exposed data (QR tag public profile). Public by design.

## Domain Map

### Medical records

| Field | Level | Allowed storage | Allowed transport | Logging | Retention | Exposure |
|-------|-------|-----------------|-------------------|---------|-----------|----------|
| Vaccination history | P0 | Backend DB; offline IndexedDB cache (`src/lib/offline/indexedDB.ts`) | HTTPS to API | Never | Per record, until owner requests deletion | Owner + authorized vets only |
| Lab results / reference ranges | P0 | Backend DB; offline cache | HTTPS | Never | Same as above | Owner + authorized roles |
| Surgeries, appointments, dental | P0 | Backend DB | HTTPS | Never | Same as above | Owner + authorized roles |
| ZKP verification material | P0 | Held in memory / ephemeral; consumed by `/api/zkp/*` | HTTPS | Never | Ephemeral | Never stored long-term on-chain in clear text |

### Contact & account data

| Field | Level | Allowed storage | Allowed transport | Logging | Retention | Exposure |
|-------|-------|-----------------|-------------------|---------|-----------|----------|
| Name, email, phone | P1 | Backend DB; session token in `localStorage` | HTTPS; `withCredentials` where used | On-by-consent only | Until account deletion | Never public; shared only with consent |
| Passwords / 2FA secret | P0 | Never stored client-side in clear text; handled via API and `twoFactorUtils` | HTTPS | Never | Per policy | Never exposed |
| Auth session token | P0 | `localStorage` (client) | HTTPS header | Never | Until session expiry/revocation | Never exposed |

### Wallet data

| Field | Level | Allowed storage | Allowed transport | Logging | Retention | Exposure |
|-------|-------|-----------------|-------------------|---------|-----------|----------|
| Public address / balances | P1 | Stellar ledger; wallet API (`src/lib/wallet/walletService.ts`) | HTTPS; Stellar Horizon | Aggregate only | Per Stellar record | Public address is public by design; balances gated |
| Private key / seed phrase | P0 | Client-side only for signing; **never** sent to API, never logged | Local signing only | Never | User-controlled | Never transmitted; local signing |
| Signed transactions | P1 | Local + Stellar ledger | HTTPS / ledger | Never (body) | Per ledger | Signed topics gated to owner |

### Analytics data

| Field | Level | Allowed storage | Allowed transport | Logging | Retention | Exposure |
|-------|-------|-----------------|-------------------|---------|-----------|----------|
| Web vitals / product analytics | P2 | Backend (`/api/web-vitals/report`, `/api/analytics/*`); optional GA (`NEXT_PUBLIC_GA_ID`) | HTTPS | Aggregate only | Per retention policy | Never personal; aggregated |
| Geo / engagement aggregates | P2 | Backend analytics tables | HTTPS | Aggregate only | Per policy | Dashboard/admin only |

### Public QR data

| Field | Level | Allowed storage | Allowed transport | Logging | Retention | Exposure |
|-------|-------|-----------------|-------------------|---------|-----------|----------|
| Public tag profile (owner-selected message, public vaccination status, tag id) | P3 | Backend/public endpoint (`/scan/[id]`, `/api/zkp/*`) | HTTPS | Minimal, by policy | Until tag disabled | **Public by design**; no medical detail beyond what owner opts into |

## Allowed Storage & Transport Rules

- All API traffic uses HTTPS; authenticated requests carry a bearer token or `withCredentials`.
- Offline caching uses IndexedDB only for P0/P1 records needed for offline display; it is local and never sent anywhere else.
- P0 (medical, wallet private, credentials) is **never** written to logs, analytics, or third parties.
- Client-side `localStorage` is reserved for short-lived session/auth state and user preferences, never for wallet seeds or medical content.

## Retention

- Account deletion (`gdprService`, deletion request flow in `src/lib/gdpr.ts`) retires P0/P1 records on completion.
- Consent-gated data (marketing, analytics, data sharing) is processed only while the corresponding consent is granted; revoking consent stops use.
- Ephemeral ZKP material is discarded after verification.

## Public Exposure

- Only P3 QR public data and Stellar public addresses are ever exposed without authentication.
- Everything else requires an authenticated session plus explicit authorization (owner roles, admin role) validated server-side.

## Third-Party Processors

| Processor | Purpose | Data level | Notes |
|-----------|---------|-----------|-------|
| Stellar Horizon (`NEXT_PUBLIC_STELLAR_HORIZON_URL`) | Wallet/ledger reads, broadcast | P1 (public address, ledger) | No P0 sent |
| Google Analytics (`NEXT_PUBLIC_GA_ID`) | Product/web-vitals analytics | P2 (aggregate) | Disabled unless configured; no P0/P1 |
| Sentry (`NEXT_PUBLIC_SENTRY_DSN`) | Error monitoring | P2 | Scrub P0/P1 before capture |
| Backend API (`NEXT_PUBLIC_API_URL`) | All domain operations | P0-P3 | Trusted boundary; server persists data |

## Responsibilities

- Reviewers must ensure new API clients, logging, and analytics follow this map (see `docs/security.md`).
- Any change that alters classification, retention, storage, or processors must update this document in the same pull request.
