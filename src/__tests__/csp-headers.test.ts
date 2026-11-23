import { describe, it, expect } from 'vitest';
import nextConfig from '../../next.config';

/**
 * Regression coverage for issue #840: Content Security Policy compatible
 * with Stellar wallet integration and PWA service worker features.
 *
 * These tests characterize the emitted CSP response header so that
 * least-privilege guarantees (no unsafe wildcards) and required origins
 * (Stellar Horizon/Soroban, wallet providers, PWA workers) stay intact.
 */

async function resolveHeaders(): Promise<Array<{ key: string; value: string }>> {
  const headers = nextConfig.headers;
  if (typeof headers !== 'function') {
    throw new Error('next.config headers() must be defined');
  }
  const result = await headers();
  const root = result.find((entry) => entry.source === '/:path*');
  if (!root) {
    throw new Error('expected a /:path* header rule');
  }
  return root.headers;
}

async function getCsp(): Promise<string> {
  const headers = await resolveHeaders();
  const csp = headers.find((h) => h.key.toLowerCase() === 'content-security-policy');
  if (!csp) {
    throw new Error('Content-Security-Policy header is missing');
  }
  return csp.value;
}

function directive(policy: string, name: string): string[] {
  const match = policy
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.toLowerCase().startsWith(`${name.toLowerCase()} `));
  if (!match) return [];
  return match.split(/\s+/).slice(1);
}

describe('Content-Security-Policy header', () => {
  it('is emitted as an HTTP response header', async () => {
    const policy = await getCsp();
    expect(policy.length).toBeGreaterThan(0);
  });

  it('defaults to a restrictive default-src', async () => {
    const policy = await getCsp();
    expect(directive(policy, 'default-src')).toEqual(["'self'"]);
  });

  it('does not use unsafe wildcards', async () => {
    const policy = await getCsp();
    expect(policy).not.toMatch(/\*/);
    expect(policy).not.toMatch(/unsafe-eval/);
  });

  it('allows Stellar Horizon and Soroban RPC origins in connect-src', async () => {
    const policy = await getCsp();
    const connect = directive(policy, 'connect-src');
    expect(connect).toContain('https://horizon.stellar.org');
    expect(connect).toContain('https://soroban-testnet.stellar.org');
  });

  it('allows wallet provider frames in frame-src', async () => {
    const policy = await getCsp();
    const frame = directive(policy, 'frame-src');
    expect(frame).toContain('https://horizon.stellar.org');
  });

  it('permits PWA service workers via worker-src', async () => {
    const policy = await getCsp();
    const worker = directive(policy, 'worker-src');
    expect(worker).toContain("'self'");
    expect(worker).toContain('blob:');
  });

  it('permits the web app manifest', async () => {
    const policy = await getCsp();
    const manifest = directive(policy, 'manifest-src');
    expect(manifest).toContain("'self'");
  });

  it('locks down framing and object embedding', async () => {
    const policy = await getCsp();
    expect(directive(policy, 'frame-ancestors')).toEqual(["'none'"]);
    expect(directive(policy, 'object-src')).toEqual(["'none'"]);
  });
});
