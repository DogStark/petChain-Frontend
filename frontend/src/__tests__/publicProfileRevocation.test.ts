/**
 * Tests for public profile revocation propagation (issue #961).
 *
 * These tests exercise the contract that public profile views must honor:
 *  - revalidate on window focus and at a documented polling interval
 *  - mask/remove protected fields on revocation without leaking the reason
 *  - never let browser caches or service workers resurrect a revoked profile
 *  - behave correctly across multiple tabs, offline->online transitions,
 *    expiry, and concurrent (race) updates.
 *
 * The module under test is expected to expose a small, framework-agnostic
 * surface so it can be unit tested without a real browser:
 *
 *   createPublicProfileView({ fetcher, intervalMs, now, visibility })
 *     -> { start, stop, refresh, getState, subscribe }
 *
 *   isRevoked(payload) -> boolean
 *   maskRevokedProfile(payload) -> payload with protected fields removed
 *
 * If the implementation lives elsewhere, adjust the import path only; the
 * behavioral assertions below are the contract this issue requires.
 */

import {
  createPublicProfileView,
  isRevoked,
  maskRevokedProfile,
  PUBLIC_PROFILE_REVALIDATE_INTERVAL_MS,
} from "../publicProfileView";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const PROTECTED_FIELDS = ["email", "phone", "address", "sharingLinks", "qrCodes"];

function makeProfile(overrides = {}) {
  return {
    id: "profile-1",
    displayName: "Ada Lovelace",
    bio: "Mathematician",
    email: "ada@example.com",
    phone: "+1-555-0100",
    address: "1 Analytical Engine Way",
    sharingLinks: [{ id: "link-1", url: "https://example.com/s/link-1" }],
    qrCodes: [{ id: "qr-1", url: "https://example.com/q/qr-1" }],
    revoked: false,
    revokedReason: null,
    expiresAt: null,
    ...overrides,
  };
}

function makeRevokedProfile(overrides = {}) {
  return makeProfile({
    revoked: true,
    // The server may include a reason; the client must never surface it.
    revokedReason: "owner requested takedown",
    ...overrides,
  });
}

/**
 * Minimal fake clock + visibility controller so tests can drive focus and
 * interval behavior deterministically.
 */
function makeHarness({ responses, intervalMs } = {}) {
  let now = 0;
  const timers = [];
  const listeners = new Set();
  let visibilityState = "visible";
  let fetchCount = 0;

  const queue = Array.isArray(responses) ? responses.slice() : [];

  const fetcher = jest.fn(async () => {
    fetchCount += 1;
    if (queue.length === 0) {
      throw new Error("unexpected fetch");
    }
    const next = queue.shift();
    if (next instanceof Error) {
      throw next;
    }
    return next;
  });

  const visibility = {
    getState: () => visibilityState,
    subscribe: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    setState: (state) => {
      visibilityState = state;
      listeners.forEach((fn) => fn(state));
    },
  };

  const view = createPublicProfileView({
    fetcher,
    intervalMs: intervalMs ?? PUBLIC_PROFILE_REVALIDATE_INTERVAL_MS,
    now: () => now,
    visibility,
    setInterval: (fn, ms) => {
      const handle = { fn, ms, cleared: false };
      timers.push(handle);
      return handle;
    },
    clearInterval: (handle) => {
      if (handle) handle.cleared = true;
    },
  });

  return {
    view,
    fetcher,
    visibility,
    get fetchCount() {
      return fetchCount;
    },
    advance(ms) {
      now += ms;
      timers
        .filter((t) => !t.cleared)
        .forEach((t) => {
          if (now % t.ms === 0 || ms >= t.ms) t.fn();
        });
    },
    timers,
  };
}

// ---------------------------------------------------------------------------
// Revalidation on focus and interval
// ---------------------------------------------------------------------------

describe("public profile revalidation", () => {
  it("revalidates when the window regains focus", async () => {
    const harness = makeHarness({ responses: [makeProfile(), makeProfile()] });
    harness.view.start();
    await harness.view.refresh();
    expect(harness.fetchCount).toBe(1);

    harness.visibility.setState("hidden");
    harness.visibility.setState("visible");

    // Focus-driven revalidation should trigger a fresh fetch.
    await Promise.resolve();
    expect(harness.fetchCount).toBeGreaterThanOrEqual(2);
    harness.view.stop();
  });

  it("revalidates at the documented polling interval", async () => {
    const harness = makeHarness({
      responses: [makeProfile(), makeProfile(), makeProfile()],
      intervalMs: 30_000,
    });
    harness.view.start();
    await harness.view.refresh();
    expect(harness.fetchCount).toBe(1);

    harness.advance(30_000);
    await Promise.resolve();
    expect(harness.fetchCount).toBeGreaterThanOrEqual(2);
    harness.view.stop();
  });

  it("documents the revalidation interval as a positive constant", () => {
    expect(typeof PUBLIC_PROFILE_REVALIDATE_INTERVAL_MS).toBe("number");
    expect(PUBLIC_PROFILE_REVALIDATE_INTERVAL_MS).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Revocation masking
// ---------------------------------------------------------------------------

describe("revocation masking", () => {
  it("detects revoked payloads", () => {
    expect(isRevoked(makeProfile())).toBe(false);
    expect(isRevoked(makeRevokedProfile())).toBe(true);
  });

  it("removes protected fields on revocation", () => {
    const masked = maskRevokedProfile(makeRevokedProfile());
    for (const field of PROTECTED_FIELDS) {
      expect(masked[field]).toBeUndefined();
    }
  });

  it("never exposes the revocation reason", () => {
    const masked = maskRevokedProfile(makeRevokedProfile());
    expect(masked.revokedReason).toBeUndefined();
    expect(JSON.stringify(masked)).not.toContain("owner requested takedown");
  });

  it("masks protected fields when a live view observes revocation", async () => {
    const harness = makeHarness({
      responses: [makeProfile(), makeRevokedProfile()],
    });
    harness.view.start();
    await harness.view.refresh();
    expect(harness.view.getState().profile.email).toBe("ada@example.com");

    await harness.view.refresh();
    const state = harness.view.getState();
    for (const field of PROTECTED_FIELDS) {
      expect(state.profile[field]).toBeUndefined();
    }
    expect(state.profile.revokedReason).toBeUndefined();
    harness.view.stop();
  });
});

// ---------------------------------------------------------------------------
// Cache / service worker resurrection
// ---------------------------------------------------------------------------

describe("cache and service worker safety", () => {
  it("requests revalidation with cache-busting semantics", async () => {
    const harness = makeHarness({ responses: [makeProfile()] });
    harness.view.start();
    await harness.view.refresh();

    const [, options] = harness.fetcher.mock.calls[0];
    expect(options).toBeDefined();
    // Must not be served from a stale HTTP cache.
    expect(options.cache).toBe("no-store");
    harness.view.stop();
  });

  it("does not resurrect a revoked profile from a stale cached response", async () => {
    const stale = makeProfile();
    const harness = makeHarness({
      responses: [makeRevokedProfile(), stale],
    });
    harness.view.start();
    await harness.view.refresh();
    expect(harness.view.getState().profile.revoked).toBe(true);

    // Even if a stale cache later returns the old profile, the view must
    // keep the revoked state and not re-expose protected fields.
    await harness.view.refresh();
    const state = harness.view.getState();
    expect(state.profile.revoked).toBe(true);
    for (const field of PROTECTED_FIELDS) {
      expect(state.profile[field]).toBeUndefined();
    }
    harness.view.stop();
  });
});

// ---------------------------------------------------------------------------
// Multi-tab propagation
// ---------------------------------------------------------------------------

describe("multi-tab propagation", () => {
  it("propagates revocation to a second tab via shared storage events", async () => {
    const events = [];
    const storage = {
      addEventListener: (type, fn) => events.push({ type, fn }),
      removeEventListener: () => {},
    };

    const harness = makeHarness({
      responses: [makeProfile(), makeRevokedProfile()],
    });
    harness.view.start({ storage });
    await harness.view.refresh();
    expect(harness.view.getState().profile.email).toBe("ada@example.com");

    // Simulate the other tab broadcasting a revocation.
    const listener = events.find((e) => e.type === "storage");
    expect(listener).toBeDefined();
    listener.fn({ key: "public-profile:revoked:profile-1", newValue: "1" });

    await Promise.resolve();
    const state = harness.view.getState();
    expect(state.profile.revoked).toBe(true);
    for (const field of PROTECTED_FIELDS) {
      expect(state.profile[field]).toBeUndefined();
    }
    harness.view.stop();
  });
});

// ---------------------------------------------------------------------------
// Offline -> online transition
// ---------------------------------------------------------------------------

describe("offline to online transition", () => {
  it("revalidates once connectivity is restored", async () => {
    const harness = makeHarness({
      responses: [new Error("offline"), makeRevokedProfile()],
    });
    harness.view.start();

    await expect(harness.view.refresh()).rejects.toThrow("offline");
    // While offline the last known profile is retained.
    expect(harness.view.getState().profile).toBeDefined();

    await harness.view.refresh();
    expect(harness.view.getState().profile.revoked).toBe(true);
    harness.view.stop();
  });
});

// ---------------------------------------------------------------------------
// Expiry
// ---------------------------------------------------------------------------

describe("expiry", () => {
  it("masks protected fields once the profile has expired", async () => {
    const expired = makeProfile({
      expiresAt: new Date(0).toISOString(),
    });
    const harness = makeHarness({ responses: [expired] });
    harness.view.start();
    await harness.view.refresh();

    const state = harness.view.getState();
    expect(state.expired).toBe(true);
    for (const field of PROTECTED_FIELDS) {
      expect(state.profile[field]).toBeUndefined();
    }
    harness.view.stop();
  });
});

// ---------------------------------------------------------------------------
// Race conditions
// ---------------------------------------------------------------------------

describe("race conditions", () => {
  it("ignores an out-of-order stale response that arrives after revocation", async () => {
    let resolveFirst;
    const first = new Promise((resolve) => {
      resolveFirst = resolve;
    });

    const fetcher = jest
      .fn()
      .mockImplementationOnce(() => first)
      .mockImplementationOnce(async () => makeRevokedProfile());

    const view = createPublicProfileView({
      fetcher,
      intervalMs: 30_000,
      now: () => 0,
      visibility: { getState: () => "visible", subscribe: () => () => {} },
      setInterval: () => 0,
      clearInterval: () => {},
    });

    view.start();
    const pending = view.refresh();
    await view.refresh();
    expect(view.getState().profile.revoked).toBe(true);

    // The stale first response resolves last and must not overwrite revocation.
    resolveFirst(makeProfile());
    await pending;

    const state = view.getState();
    expect(state.profile.revoked).toBe(true);
    for (const field of PROTECTED_FIELDS) {
      expect(state.profile[field]).toBeUndefined();
    }
    view.stop();
  });

  it("coalesces concurrent refreshes into a single in-flight request", async () => {
    const harness = makeHarness({ responses: [makeProfile()] });
    harness.view.start();

    await Promise.all([harness.view.refresh(), harness.view.refresh()]);
    expect(harness.fetchCount).toBe(1);
    harness.view.stop();
  });
});
