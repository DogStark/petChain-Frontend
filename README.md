# PetChain Frontend

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)](https://github.com/DogStark/petChain-Frontend)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16.x-black)](https://nextjs.org/)
[![License](https://img.shields.io/badge/license-MIT-green)](./LICENSE)

## Overview

PetChain is a decentralized platform on Stellar that securely manages pet medical records. Today, health data is often scattered, lost, or stuck in outdated systems, making it hard to track vaccinations, manage treatments, or respond quickly in emergencies.

By making records tamper-proof and universally accessible, PetChain keeps vets and pet owners aligned no matter where the pet is or who is treating them. Pets get a scannable tag for quick access to key medical details, which can also act as a tracker if the pet goes missing.

This repository hosts the **frontend** (Next.js) application. A separate `backend/` folder contains the NestJS API; the two are independently configured Node applications that are deliberately kept isolated (see [Workspace layout](#workspace-layout)).

## Features

1. **Scannable Pet Tags** - Each pet gets a unique QR code and tag linked to its medical history, instantly scannable by vets or emergency responders (`/scan/[id]`).
2. **Pet & Medical Records** - Manage profiles, dental records, surgeries, appointments, and lab results with reference ranges.
3. **Wallet & Stellar Integration** - Create, back up, recover, sign, and send from a wallet on the Stellar network (`/wallet`), with multi-signature setup and transaction records (`/transactions`).
4. **Clinics & Map** - Browse clinic locations with geolocation and an interactive map (`/clinics`, `/clinics/[id]`).
5. **Analytics & Admin** - Route-level dashboards for engagement, pets, API usage, geographic distribution, financials, and compliance (`/analytics`), plus admin security, SMS, and reporting (`/admin/*`).
6. **Notifications & Smart Alerts** - Push and in-app notifications for vaccinations, check-ups, and security alerts (`/notifications`).
7. **Offline Mode & PWA** - Installable app with IndexedDB-backed offline caching and background sync (`/offline`).
8. **Privacy & Compliance** - GDPR-aligned data handling, zero-knowledge proofs (ZKPs) for sensitive on-chain data, session and two-factor security, and a documented data-classification policy.
9. **Localization** - Ten language locales (`en`, `ar`, `de`, `es`, `fr`, `hi`, `ja`, `pt`, `ru`, `zh`).

## Tech Stack

- **Framework:** Next.js (React + TypeScript)
- **Styling:** Tailwind CSS
- **State / Data:** React Context, Next.js API routes, REST client
- **Blockchain:** `@stellar/stellar-sdk` (Stellar network)
- **Charts:** Recharts (analytics, trends)
- **Testing:** Jest + Testing Library (unit), Playwright (e2e), k6 + Lighthouse (performance)
- **Backend:** NestJS (in `backend/`), PostgreSQL, TypeORM

## Route Map

The current application exposes the following pages:

| Route | Purpose |
|-------|---------|
| `/` | Landing / home |
| `/login`, `/register`, `/forgot-password`, `/reset-password` | Authentication |
| `/two-factor`, `/verify-account`, `/verify-email` | 2FA and verification |
| `/pets/[id]` | Pet profile and medical records |
| `/appointments`, `/surgeries`, `/dental`, `/lab-results` | Care records |
| `/clinics`, `/clinics/[id]` | Clinics directory and location map |
| `/wallet`, `/transactions` | Stellar wallet and transaction history |
| `/analytics` | Analytics dashboards |
| `/notifications`, `/activity-log`, `/sessions`, `/preferences` | Notifications and account activity |
| `/admin/security`, `/admin/reports`, `/admin/sms` | Admin tooling |
| `/scan/[id]` | QR tag scanning |
| `/offline` | Offline reference view |
| `/qrcode`, `/performance`, `/search`, `/profile`, `/account-settings` | Utilities and profile |

Server-side API routes under `src/pages/api/` handle analytics metrics, blockchain sync, security metrics/alerts, ZKP generation/verification, web-vitals reports, webhooks, and observability.

## Architecture & Data Flow

- **Client rendering:** Pages combine server-rendered data with client-side interactions. Optional, heavy features are loaded lazily (route-level bundle budgets in `performance-budgets.json`).
- **Authentication:** `AuthContext` drives session, login, registration, 2FA, and role-based access; admin-only pages enforce authorization server-side.
- **Wallet:** `useWallet` + `walletService`/`StellarService` talk to the Stellar network via a stored keypair; signing and multisig flows are isolated.
- **Offline:** Service worker + IndexedDB (`src/lib/offline/indexedDB.ts`) cache records, and `syncManager.ts` replays pending writes when connectivity returns.
- **Analytics:** Web vitals and product analytics are reported to the API (`/api/web-vitals/report`), and dashboards read aggregated API metrics.
- **Privacy:** Sensitive data is handled according to `docs/data-classification.md`; ZKP endpoints (`/api/zkp/*`) keep on-chain verification private.

See [Architecture](#architecture--data-flow) in [PROJECT_STATUS.md](./PROJECT_STATUS.md) for the current build status and known limitations.

## Getting Started

### Quick Start

```bash
# Clone the repository
git clone https://github.com/DogStark/petChain-Frontend.git
cd petChain-Frontend

# Use the correct Node.js version
nvm use

# Install dependencies (uses package-lock.json for reproducible installs)
npm ci

# Copy environment variables
cp .env.example .env.local

# Ensure the backend API is running on port 3001 (see backend/README.md)

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Prerequisites & Environment Matrix

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_APP_NAME` / `NEXT_PUBLIC_APP_URL` | yes | Application identity |
| `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_API_VERSION` | yes | Backend API base URL and version |
| `NEXT_PUBLIC_STELLAR_NETWORK` | yes | `testnet` or `mainnet` |
| `NEXT_PUBLIC_STELLAR_HORIZON_URL` | yes | Stellar Horizon endpoint |
| `NEXT_PUBLIC_GA_ID` | no | Google Analytics (product analytics) |
| `NEXT_PUBLIC_SENTRY_DSN` | no | Error monitoring |

The backend API (in `backend/`) requires PostgreSQL, Redis, and Docker. See `backend/README.md` for its own environment and setup.

### Verify the Setup

```bash
npm run type-check   # TypeScript type checking
npm run test:unit    # Jest unit tests (single discovery convention)
npm run lint         # ESLint
npm run build        # Production build
```

## Workspace Layout

The repository intentionally isolates two independently configured Node applications:

- **Frontend (`root`)** - Next.js application. Its `package.json`, `tsconfig*.json`, `jest.config.js`, and scripts operate only on `src/`, `tests/`, `performance/`, and `scripts/` files. The root does **not** compile `backend/`.
- **Backend (`backend/`)** - NestJS API with its own `package.json`, `tsconfig`, dependencies, and scripts. Install and run it from within `backend/`.

Keep frontend tooling changes and backend tooling changes isolated: never add backend dependencies to the root `package.json`, and never import backend code from the frontend source.

## Contributing

Please read [SETUP.md](./SETUP.md), [CODE_STYLE.md](./CODE_STYLE.md), and [PROJECT_STATUS.md](./PROJECT_STATUS.md) before contributing. For a repeatable supply-chain posture, see the dependency-license policy in [docs/license-policy.md](./docs/license-policy.md) and the API data-handling rules in [docs/data-classification.md](./docs/data-classification.md).

**Important:** Make sure you are working on the correct technology:
- **Frontend:** Next.js issues (root folder)
- **Backend:** NestJS issues (`backend/` folder)

## Documentation

- [Setup Guide](./SETUP.md) - Complete development setup instructions
- [Code Style Guide](./CODE_STYLE.md) - Coding standards and best practices
- [Project Status](./PROJECT_STATUS.md) - Current build status and progress
- [Data Classification](./docs/data-classification.md) - Field-level classification and privacy rules
- [Security Workflow](./docs/security.md) - Security testing, audit, and incident response
- [License Policy](./docs/license-policy.md) - Dependency and supply-chain checks
- [Workspace Boundaries](./docs/workspace-boundaries.md) - Frontend/backend isolation rules
- [Push Notifications](./docs/push-notifications.md) - Notification architecture
- [Reusable Workflows](./docs/reusable-workflows.md) - CI workflow reference
- [Testing Guide](./TESTING_GUIDE.md) - How to run and write tests

## Related Repositories

- Backend - [DogStark/petchain_api](https://github.com/DogStark/petchain_api)
- Smart Contracts - [DogStark/PetMedTracka-Contracts](https://github.com/DogStark/PetMedTracka-Contracts)
- Mobile App - [DogStark/PetMedTracka-MobileApp](https://github.com/DogStark/PetMedTracka-MobileApp)

## Contact & Support

- Project lead: [@llins_x](https://t.me/llins_x)
- Report issues via the linked repositories or the GitHub Issues tab.

## License

PetChain is licensed under the MIT License.
