# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take security vulnerabilities seriously. Please follow these steps:

### 🔒 Private Disclosure

**DO NOT** create a public GitHub issue for security vulnerabilities.

Instead, please:

1. **Email**: Send details to security@petchain.com
2. **Telegram**: Contact [@llins_x](https://t.me/llins_x) privately
3. **Include**:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### 📋 What to Include

- **Component**: Frontend, Backend, or Smart Contracts
- **Severity**: Critical, High, Medium, Low
- **Attack Vector**: Network, Local, Physical
- **Proof of Concept**: Code or screenshots

### ⏱️ Response Timeline

- **Acknowledgment**: Within 24 hours
- **Initial Assessment**: Within 72 hours  
- **Status Updates**: Weekly until resolved
- **Fix Timeline**: Based on severity
  - Critical: 1-7 days
  - High: 7-30 days
  - Medium: 30-90 days
  - Low: 90+ days

### 🏆 Recognition

We appreciate security researchers and will:
- Credit you in our security advisories (if desired)
- Add you to our Hall of Fame
- Consider bug bounties for significant findings

### 🛡️ Security Best Practices

**For Contributors:**
- Never commit secrets or API keys
- Use environment variables for sensitive data
- Follow OWASP security guidelines
- Keep dependencies updated
- Use TypeScript strict mode
- Validate all inputs
- Implement proper authentication
- Use HTTPS in production
- Keep emergency QR scan analytics minimized: no raw IPs, no precise coordinates, no contact details, no user identifiers in analytics payloads
- Only store coarse, consented location fields (for example country/region) when explicitly granted, and keep analytics retention bounded to 30 days

### 🔐 Authorization model (admin access)

Admin access is enforced **server-side** at the API boundary. Client-side route guards (for example `ProtectedRoute` and `src/lib/api/requireAdmin.ts`) are a UX convenience only and must never be treated as a security control.

- Every admin endpoint MUST verify the caller's authenticated session and role on the server before returning data or performing mutations.
- Protected endpoints MUST return consistent status codes:
  - `401 Unauthorized` when the request is unauthenticated (missing/invalid/expired session).
  - `403 Forbidden` when the caller is authenticated but lacks the required role.
- Never trust client-supplied role, `isAdmin`, or similar state. Roles are derived from the server-side session/identity only.
- Object-level access (IDOR) MUST be checked per resource: a caller may only read or mutate records they own or are authorized to access, regardless of what the client UI displays.
- Regression tests MUST cover forged client-state attempts (e.g. tampered `isAdmin`/role in local storage or request payloads) and IDOR attempts against admin and user-scoped resources.

### 🔐 Authentication token storage

Authentication bearer tokens must never be persisted in `localStorage` or any other JavaScript-readable storage, because any XSS vulnerability would then expose long-lived credentials. The hardened design is:

- **Session transport**: the backend issues the session as an `HttpOnly`, `Secure`, `SameSite=Lax` cookie. The frontend never reads or writes the token; `src/contexts/AuthContext.tsx` only tracks the derived user/loading state and calls the API with `credentials: 'include'`.
- **CSRF protection**: cookie-authenticated state-changing requests (POST/PUT/PATCH/DELETE) must send a CSRF token via the `X-CSRF-Token` header. The token is issued in a non-`HttpOnly` `csrf_token` cookie (or a `/auth/csrf` endpoint) and echoed back by the client; the backend rejects requests whose header does not match the session-bound value.
- **Logout**: clears the session cookie server-side and resets the in-memory auth state; no token material is retained client-side.
- **Migration**: any legacy `localStorage` token keys are removed on load so existing sessions are re-established through the cookie flow.

When changing authentication, keep the `AuthContext` public surface (`login`, `logout`, `user`, loading/empty states) stable so consumers are unaffected, and add regression coverage for success, unauthenticated, and CSRF-failure paths.

### 🔎 Emergency QR scan analytics privacy

Emergency scan events are intentionally designed as low-risk telemetry. The frontend sends only a minimal device class for trend analysis and, when a user has explicitly consented, a coarse region or country code; it never includes raw IP addresses, exact coordinates, phone numbers, contact names, or other personal identifiers. Analytics records are limited to a short retention window to reduce long-term tracking risk.

## Content Security Policy (CSP)

The frontend ships a least-privilege Content Security Policy emitted as an HTTP response header from `next.config.ts`. The policy is intentionally strict: it avoids wildcard (`*`) sources and only allows the specific origins required by the Stellar wallet integration, PWA/service-worker features, and first-party assets. `src/pages/_document.tsx` does **not** declare a `<meta http-equiv="Content-Security-Policy">` tag, so the response header is the single source of truth and cannot be weakened by a conflicting meta policy.

### Directive rationale

| Directive | Value (summary) | Why |
| --------- | --------------- | --- |
| `default-src` | `'self'` | Deny-by-default for any resource type not listed below. |
| `script-src` | `'self'` (+ `'unsafe-inline'` only where Next.js requires it) | First-party bundles only; no third-party script CDNs. |
| `style-src` | `'self' 'unsafe-inline'` | Next.js and component libraries inject inline styles at runtime. |
| `img-src` | `'self' data: blob:` | Local assets, inline data URIs, and user-uploaded previews via `blob:`. |
| `font-src` | `'self' data:` | Self-hosted fonts and inlined font data. |
| `connect-src` | `'self'` + Stellar Horizon/Soroban RPC origins | Wallet balance, transaction submission, and contract calls. |
| `frame-src` | Stellar wallet provider origins | Wallet connect flows that render in an iframe. |
| `worker-src` | `'self' blob:` | PWA service worker registration and blob-based workers. |
| `manifest-src` | `'self'` | PWA web app manifest. |
| `frame-ancestors` | `'none'` | Prevent clickjacking of wallet and upload flows. |
| `object-src` | `'none'` | Disallow legacy plugin content. |
| `base-uri` | `'self'` | Prevent `<base>` tag hijacking. |
| `form-action` | `'self'` | Restrict where forms can submit. |

### Required origins

- **Stellar Horizon / Soroban RPC**: the public network endpoints used by the app (e.g. `https://horizon.stellar.org`, `https://soroban-testnet.stellar.org`). Add any additional network you support to `connect-src`.
- **Wallet providers**: only the specific wallet SDK origins that render connect UI in an iframe belong in `frame-src`. Do not add broad `https://*` entries.

### Extending the policy

When adding a new integration:

1. Identify the exact origin(s) the feature needs — never use `*` or scheme-only wildcards.
2. Add the origin to the narrowest matching directive (`connect-src` for XHR/fetch/WebSocket, `frame-src` for iframes, `img-src` for images, etc.).
3. Update the table above and add a regression test asserting the header contains the new origin and still omits wildcards.
4. Verify the PWA service worker still registers and the Stellar wallet connect flow still works in a browser before merging.

## CSRF defenses for cookie-authenticated state changes

Because authentication cookies are `Secure`/`SameSite`-scoped, every state-changing request (`POST`, `PUT`, `PATCH`, `DELETE`) that relies on cookie auth must also be protected against cross-site request forgery. The frontend enforces this in `src/lib/api` and the route handlers under `src/pages/api`.

### Origin / Referer validation

- For cookie-authenticated mutations, the request `Origin` header must match the app's own origin (derived from the configured site URL / request host).
- When `Origin` is absent (some same-origin form posts and older clients), the `Referer` origin is used as a fallback.
- If neither header is present or the resolved origin does not match, the request is rejected with `403 Forbidden` before any mutation runs.
- Safe methods (`GET`, `HEAD`, `OPTIONS`) are not subject to this check.

### CSRF tokens

- A per-session CSRF token is issued to the client and must be echoed back on cookie-authenticated mutations (via the `X-CSRF-Token` header or a form field).
- Tokens are compared in constant time; missing or mismatched tokens are rejected with `403 Forbidden`.
- This applies to profile, wallet, GDPR, notification, and admin mutations.

### Testing expectations

- Regression tests characterize the vulnerability first: a cross-site form post and a cross-site `fetch` (with a foreign `Origin`) must be rejected.
- Same-origin requests with a valid token must continue to succeed, and missing/invalid tokens must fail with the documented error responses.
- Authorization checks, TypeScript strictness, and existing error shapes are preserved; CSRF rejection happens before business logic and never leaks sensitive data in the response.

### Contributor notes

When adding a new cookie-authenticated mutation:

1. Route it through the shared CSRF guard in `src/lib/api` rather than hand-rolling checks.
2. Ensure the client sends the CSRF token on the request.
3. Add a regression test covering both the cross-site rejection and the same-origin success path.

**For Users:**
- Keep your software updated
- Use strong passwords
- Enable two-factor authentication
- Don't share private keys
- Verify QR codes before scanning

Thank you for helping keep PetChain secure! 🔐