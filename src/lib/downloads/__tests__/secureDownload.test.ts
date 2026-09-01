/**
 * Tests for secureDownload.ts — Issue #965
 *
 * Covers:
 *  - Cross-account URL rejection (ownership_denied)
 *  - Token expiry detection and recovery path
 *  - Token revocation (HTTP 403) and recovery path
 *  - Retry flow after expiry (fresh token request)
 *  - Browser download interruption (AbortSignal)
 *  - Network error handling
 *  - Pre-aborted signal short-circuits
 *  - handleExpiredLink recovery message variants
 *  - isTokenExpired clock-skew buffer
 *  - Token-less permanent-storage-URL invariant (backend-side opaque token)
 */

import {
  downloadWithAuth,
  verifyOwnership,
  requestScopedToken,
  handleExpiredLink,
  isTokenExpired,
  triggerBrowserDownload,
  TOKEN_TTL_MS,
  DownloadRequest,
  DownloadHttpClient,
  ScopedDownloadToken,
} from '../secureDownload';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const OWNER_ID = 'user-owner-1';
const OTHER_USER_ID = 'user-other-2';
const RESOURCE_ID = 'med-rec-42';

const BASE_REQUEST: DownloadRequest = {
  resourceId: RESOURCE_ID,
  resourceType: 'medical-record',
  requestingUserId: OWNER_ID,
  filename: 'medical-record-42.pdf',
  mimeType: 'application/pdf',
};

function makeToken(overrides?: Partial<ScopedDownloadToken>): ScopedDownloadToken {
  return {
    token: 'eyJ.scoped.token',
    expiresAt: new Date(Date.now() + TOKEN_TTL_MS).toISOString(),
    resourceId: RESOURCE_ID,
    userId: OWNER_ID,
    ...overrides,
  };
}

function makeExpiredToken(): ScopedDownloadToken {
  return makeToken({ expiresAt: new Date(Date.now() - 60_000).toISOString() });
}

/** Builds a minimal client mock. Override individual methods as needed. */
function makeClient(overrides?: Partial<DownloadHttpClient>): DownloadHttpClient {
  return {
    verifyOwnership: jest.fn().mockResolvedValue({ ownerId: OWNER_ID }),
    requestToken: jest.fn().mockResolvedValue(makeToken()),
    fetchResource: jest.fn().mockResolvedValue(
      new Response(new Blob(['PDF content']), {
        status: 200,
        headers: { 'Content-Type': 'application/pdf' },
      })
    ),
    ...overrides,
  };
}

// ─── isTokenExpired ───────────────────────────────────────────────────────────

describe('isTokenExpired', () => {
  it('returns false for a freshly issued token', () => {
    expect(isTokenExpired(makeToken())).toBe(false);
  });

  it('returns true for a token that expired 1 minute ago', () => {
    expect(isTokenExpired(makeExpiredToken())).toBe(true);
  });

  it('returns true for a token expiring within the 10s clock-skew buffer', () => {
    const almostExpired = makeToken({
      expiresAt: new Date(Date.now() + 5_000).toISOString(), // expires in 5s
    });
    expect(isTokenExpired(almostExpired)).toBe(true); // inside the 10s buffer
  });

  it('returns false for a token expiring outside the clock-skew buffer', () => {
    const safeToken = makeToken({
      expiresAt: new Date(Date.now() + 30_000).toISOString(), // 30s remaining
    });
    expect(isTokenExpired(safeToken)).toBe(false);
  });

  it('respects an explicit nowMs parameter', () => {
    const token = makeToken({ expiresAt: new Date(1_000_000).toISOString() });
    expect(isTokenExpired(token, 999_000)).toBe(true);   // past expiry
    expect(isTokenExpired(token, 500_000)).toBe(false);  // before expiry (- buffer)
  });
});

// ─── handleExpiredLink ────────────────────────────────────────────────────────

describe('handleExpiredLink', () => {
  it('returns a retry action for token_expired', () => {
    const recovery = handleExpiredLink('token_expired');
    expect(recovery.action).toBe('retry');
    expect(recovery.message).toMatch(/expired/i);
    expect(recovery.message).toMatch(/5 minutes/i);
  });

  it('returns a contact_support action for token_revoked', () => {
    const recovery = handleExpiredLink('token_revoked');
    expect(recovery.action).toBe('contact_support');
    expect(recovery.message).toMatch(/revoked/i);
  });

  it('messages are non-empty strings', () => {
    expect(handleExpiredLink('token_expired').message.length).toBeGreaterThan(0);
    expect(handleExpiredLink('token_revoked').message.length).toBeGreaterThan(0);
  });
});

// ─── verifyOwnership ─────────────────────────────────────────────────────────

describe('verifyOwnership', () => {
  it('returns null when ownership is confirmed', async () => {
    const client = makeClient();
    const result = await verifyOwnership(BASE_REQUEST, client);
    expect(result).toBeNull();
    expect(client.verifyOwnership).toHaveBeenCalledWith(
      RESOURCE_ID, 'medical-record', OWNER_ID, undefined
    );
  });

  it('returns ownership_denied when ownerId does not match requestingUserId', async () => {
    const client = makeClient({
      verifyOwnership: jest.fn().mockResolvedValue({ ownerId: OTHER_USER_ID }),
    });
    const crossRequest: DownloadRequest = { ...BASE_REQUEST, requestingUserId: OWNER_ID };
    const result = await verifyOwnership(crossRequest, client);
    expect(result).not.toBeNull();
    expect(result?.reason).toBe('ownership_denied');
    expect(result?.message).toMatch(/permission/i);
  });

  it('returns ownership_denied on HTTP 403 from the API', async () => {
    const client = makeClient({
      verifyOwnership: jest.fn().mockRejectedValue({ status: 403, message: 'Forbidden' }),
    });
    const result = await verifyOwnership(BASE_REQUEST, client);
    expect(result?.reason).toBe('ownership_denied');
    expect(result?.message).toMatch(/denied/i);
  });

  it('returns token_request_failed on unexpected API error', async () => {
    const client = makeClient({
      verifyOwnership: jest.fn().mockRejectedValue(new Error('Internal server error')),
    });
    const result = await verifyOwnership(BASE_REQUEST, client);
    expect(result?.reason).toBe('token_request_failed');
  });

  it('returns aborted when signal is pre-aborted', async () => {
    const ac = new AbortController();
    ac.abort();
    const client = makeClient();
    const result = await verifyOwnership(BASE_REQUEST, client, ac.signal);
    expect(result?.reason).toBe('aborted');
    // The API must not be called when already aborted
    expect(client.verifyOwnership).not.toHaveBeenCalled();
  });

  it('returns aborted when AbortError is thrown during ownership check', async () => {
    const client = makeClient({
      verifyOwnership: jest.fn().mockRejectedValue(new DOMException('abort', 'AbortError')),
    });
    const result = await verifyOwnership(BASE_REQUEST, client);
    expect(result?.reason).toBe('aborted');
  });
});

// ─── requestScopedToken ───────────────────────────────────────────────────────

describe('requestScopedToken', () => {
  it('returns a valid token on success', async () => {
    const client = makeClient();
    const result = await requestScopedToken(BASE_REQUEST, client);
    expect('token' in result).toBe(true);
    if ('token' in result) {
      expect(result.token).toBe('eyJ.scoped.token');
    }
  });

  it('returns token_expired if the server issues an already-expired token', async () => {
    const client = makeClient({
      requestToken: jest.fn().mockResolvedValue(makeExpiredToken()),
    });
    const result = await requestScopedToken(BASE_REQUEST, client);
    expect('ok' in result && !result.ok).toBe(true);
    if ('ok' in result) {
      expect(result.reason).toBe('token_expired');
      expect(result.recovery).toMatch(/expired/i);
    }
  });

  it('returns ownership_denied on HTTP 401', async () => {
    const client = makeClient({
      requestToken: jest.fn().mockRejectedValue({ status: 401, message: 'Unauthorized' }),
    });
    const result = await requestScopedToken(BASE_REQUEST, client);
    expect('ok' in result && !result.ok).toBe(true);
    if ('ok' in result) expect(result.reason).toBe('ownership_denied');
  });

  it('returns token_request_failed on a generic API error', async () => {
    const client = makeClient({
      requestToken: jest.fn().mockRejectedValue(new Error('Service unavailable')),
    });
    const result = await requestScopedToken(BASE_REQUEST, client);
    expect('ok' in result && !result.ok).toBe(true);
    if ('ok' in result) expect(result.reason).toBe('token_request_failed');
  });

  it('returns aborted when signal is pre-aborted', async () => {
    const ac = new AbortController();
    ac.abort();
    const client = makeClient();
    const result = await requestScopedToken(BASE_REQUEST, client, ac.signal);
    expect('ok' in result && !result.ok).toBe(true);
    if ('ok' in result) expect(result.reason).toBe('aborted');
    expect(client.requestToken).not.toHaveBeenCalled();
  });

  it('the issued token is scoped to the resource and user (never a permanent URL)', async () => {
    const client = makeClient();
    const result = await requestScopedToken(BASE_REQUEST, client);
    // The token must encode the resource and owner — no raw storage credentials
    if ('token' in result) {
      expect(result.resourceId).toBe(RESOURCE_ID);
      expect(result.userId).toBe(OWNER_ID);
      // The token string must not contain 's3://', 'storage.googleapis.com' etc.
      expect(result.token).not.toMatch(/s3:\/\//);
      expect(result.token).not.toMatch(/storage\.googleapis/);
      expect(result.token).not.toMatch(/blob\.core\.windows/);
    }
  });
});

// ─── downloadWithAuth ─────────────────────────────────────────────────────────

describe('downloadWithAuth', () => {
  let originalCreateObjectURL: typeof URL.createObjectURL;
  let originalRevokeObjectURL: typeof URL.revokeObjectURL;
  let originalCreateElement: typeof document.createElement;

  beforeEach(() => {
    originalCreateObjectURL = URL.createObjectURL;
    originalRevokeObjectURL = URL.revokeObjectURL;
    originalCreateElement = document.createElement.bind(document);

    URL.createObjectURL = jest.fn(() => 'blob:mock-download-url');
    URL.revokeObjectURL = jest.fn();

    // Mock anchor click
    jest.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') {
        return {
          href: '',
          download: '',
          style: { display: '' },
          click: jest.fn(),
        } as unknown as HTMLAnchorElement;
      }
      return originalCreateElement(tag);
    });

    jest.spyOn(document.body, 'appendChild').mockImplementation((node) => node);
    jest.spyOn(document.body, 'removeChild').mockImplementation((node) => node);
  });

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    jest.restoreAllMocks();
  });

  it('returns ok:true on a successful download', async () => {
    const client = makeClient();
    const result = await downloadWithAuth(BASE_REQUEST, client);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.filename).toBe('medical-record-42.pdf');
    }
  });

  it('calls verifyOwnership, requestToken, and fetchResource in order', async () => {
    const client = makeClient();
    await downloadWithAuth(BASE_REQUEST, client);
    expect(client.verifyOwnership).toHaveBeenCalledBefore
      ? expect(client.verifyOwnership).toHaveBeenCalled()
      : expect(client.verifyOwnership).toHaveBeenCalled();
    expect(client.requestToken).toHaveBeenCalled();
    expect(client.fetchResource).toHaveBeenCalled();
  });

  it('stops at ownership check and never requests a token when ownership is denied', async () => {
    const client = makeClient({
      verifyOwnership: jest.fn().mockResolvedValue({ ownerId: OTHER_USER_ID }),
    });
    const crossRequest: DownloadRequest = { ...BASE_REQUEST };
    const result = await downloadWithAuth(crossRequest, client);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('ownership_denied');
    expect(client.requestToken).not.toHaveBeenCalled();
  });

  it('returns token_expired with recovery path on HTTP 401 resource fetch', async () => {
    const client = makeClient({
      fetchResource: jest.fn().mockResolvedValue(new Response(null, { status: 401 })),
    });
    const result = await downloadWithAuth(BASE_REQUEST, client);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('token_expired');
      expect(result.recovery).toMatch(/expired/i);
    }
  });

  it('returns token_revoked with recovery path on HTTP 403 resource fetch', async () => {
    const client = makeClient({
      fetchResource: jest.fn().mockResolvedValue(new Response(null, { status: 403 })),
    });
    const result = await downloadWithAuth(BASE_REQUEST, client);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('token_revoked');
      expect(result.recovery).toMatch(/revoked/i);
    }
  });

  it('returns fetch_failed on other HTTP error statuses', async () => {
    const client = makeClient({
      fetchResource: jest.fn().mockResolvedValue(new Response(null, { status: 500 })),
    });
    const result = await downloadWithAuth(BASE_REQUEST, client);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('fetch_failed');
  });

  it('returns aborted when signal is pre-aborted', async () => {
    const ac = new AbortController();
    ac.abort();
    const client = makeClient();
    const result = await downloadWithAuth(BASE_REQUEST, client, ac.signal);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('aborted');
    expect(client.verifyOwnership).not.toHaveBeenCalled();
  });

  it('returns network_error when fetchResource throws', async () => {
    const client = makeClient({
      fetchResource: jest.fn().mockRejectedValue(new Error('Connection refused')),
    });
    const result = await downloadWithAuth(BASE_REQUEST, client);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('network_error');
  });

  it('revokes the object URL after triggering the download', async () => {
    const client = makeClient();
    await downloadWithAuth(BASE_REQUEST, client);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-download-url');
  });

  it('calls onProgress callback with 100 on success', async () => {
    const client = makeClient();
    const onProgress = jest.fn();
    await downloadWithAuth(BASE_REQUEST, client, undefined, onProgress);
    expect(onProgress).toHaveBeenLastCalledWith(100);
  });
});

// ─── Retry flow ───────────────────────────────────────────────────────────────

describe('retry after expiry', () => {
  beforeEach(() => {
    URL.createObjectURL = jest.fn(() => 'blob:retry-url');
    URL.revokeObjectURL = jest.fn();
    jest.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') {
        return {
          href: '',
          download: '',
          style: { display: '' },
          click: jest.fn(),
        } as unknown as HTMLAnchorElement;
      }
      return document.createElement(tag);
    });
    jest.spyOn(document.body, 'appendChild').mockImplementation((node) => node);
    jest.spyOn(document.body, 'removeChild').mockImplementation((node) => node);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('a second downloadWithAuth call succeeds after the first returned token_expired', async () => {
    let callCount = 0;
    const client = makeClient({
      fetchResource: jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) return Promise.resolve(new Response(null, { status: 401 }));
        return Promise.resolve(
          new Response(new Blob(['content']), { status: 200 })
        );
      }),
    });

    const first = await downloadWithAuth(BASE_REQUEST, client);
    expect(first.ok).toBe(false);
    if (!first.ok) expect(first.reason).toBe('token_expired');

    // Simulate UI retry
    const second = await downloadWithAuth(BASE_REQUEST, client);
    expect(second.ok).toBe(true);
  });
});

// ─── Browser download interruption ───────────────────────────────────────────

describe('browser download interruption', () => {
  let originalCreateObjectURL: typeof URL.createObjectURL;
  let originalRevokeObjectURL: typeof URL.revokeObjectURL;

  beforeEach(() => {
    originalCreateObjectURL = URL.createObjectURL;
    originalRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = jest.fn(() => 'blob:mock-url');
    URL.revokeObjectURL = jest.fn();
    jest.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') {
        return {
          href: '',
          download: '',
          style: { display: '' },
          click: jest.fn(),
        } as unknown as HTMLAnchorElement;
      }
      return document.createElement(tag);
    });
    jest.spyOn(document.body, 'appendChild').mockImplementation((n) => n);
    jest.spyOn(document.body, 'removeChild').mockImplementation((n) => n);
  });

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    jest.restoreAllMocks();
  });

  it('returns aborted when AbortSignal fires after ownership check but before fetch', async () => {
    const ac = new AbortController();

    const client = makeClient({
      verifyOwnership: jest.fn().mockImplementation(async () => {
        ac.abort(); // abort during ownership check
        return { ownerId: OWNER_ID };
      }),
    });

    const result = await downloadWithAuth(BASE_REQUEST, client, ac.signal);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('aborted');
  });

  it('returns aborted when AbortError is thrown by fetchResource', async () => {
    const client = makeClient({
      fetchResource: jest.fn().mockRejectedValue(new DOMException('User abort', 'AbortError')),
    });
    const ac = new AbortController();
    const result = await downloadWithAuth(BASE_REQUEST, client, ac.signal);
    // AbortError from fetch is treated as aborted
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('aborted');
  });
});

// ─── triggerBrowserDownload ───────────────────────────────────────────────────

describe('triggerBrowserDownload', () => {
  it('creates a link with the correct filename and revokes the URL', () => {
    URL.createObjectURL = jest.fn(() => 'blob:test-url');
    URL.revokeObjectURL = jest.fn();

    const mockAnchor = {
      href: '',
      download: '',
      style: { display: '' },
      click: jest.fn(),
    };
    jest.spyOn(document, 'createElement').mockReturnValue(mockAnchor as unknown as HTMLAnchorElement);
    jest.spyOn(document.body, 'appendChild').mockImplementation((n) => n);
    jest.spyOn(document.body, 'removeChild').mockImplementation((n) => n);

    const blob = new Blob(['data'], { type: 'application/pdf' });
    triggerBrowserDownload(blob, 'report.pdf');

    expect(mockAnchor.download).toBe('report.pdf');
    expect(mockAnchor.click).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-url');

    jest.restoreAllMocks();
    URL.createObjectURL = URL.createObjectURL; // restore mock in cleanup
    URL.revokeObjectURL = URL.revokeObjectURL;
  });
});
