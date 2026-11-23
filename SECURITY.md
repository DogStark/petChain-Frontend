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

**For Users:**
- Keep your software updated
- Use strong passwords
- Enable two-factor authentication
- Don't share private keys
- Verify QR codes before scanning

Thank you for helping keep PetChain secure! 🔐