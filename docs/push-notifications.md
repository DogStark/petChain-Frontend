# Push Notification Lifecycle

This document describes the coherent push-notification lifecycle implemented in `src/hooks/usePushNotifications.ts` and the companion `public/firebase-messaging-sw.js` service worker.

## Overview

Push notifications in PetChain go through four lifecycle phases managed by a single hook:

1. **Permission** — the browser is asked once; denied state is never re-prompted.
2. **Registration** — an FCM token (not the raw Web Push subscription endpoint) is registered with the backend.
3. **Token rotation** — Firebase rotates FCM tokens periodically for security; the stale token is removed before the fresh one is registered. Token rotation is handled through **two complementary channels** (see below).
4. **Logout / cleanup** — the FCM token is deleted from Firebase and removed from the backend when the user signs out.

## Architecture

```
User action
    │
    ▼
usePushNotifications(userId, vapidKey)
    │
    ├── requestPermission()
    │       │
    │       ├── Notification.requestPermission() [browser API]
    │       ├── getFirebaseMessaging()            [src/lib/firebase.ts]
    │       ├── getToken(messaging, { vapidKey }) [FCM SDK]
    │       ├── notificationsAPI.removeDeviceToken(userId, staleToken)  ← removes old token first
    │       ├── notificationsAPI.registerDeviceToken(userId, { token }) ← registers FCM token
    │       ├── onTokenRefresh(messaging, callback) ← wires rotation listener (channel A)
    │       └── stores messaging in messagingRef   ← enables SW relay channel B
    │
    ├── unsubscribe()   ← call on logout
    │       │
    │       ├── onTokenRefresh unsubscribe teardown
    │       ├── clears messagingRef                ← disables SW relay
    │       ├── deleteToken(messaging)             [FCM SDK]
    │       └── notificationsAPI.removeDeviceToken(userId, currentToken)
    │
    └── (unmount cleanup)
            ├── onTokenRefresh unsubscribe teardown
            ├── clears messagingRef
            └── removes window 'message' listener (SW relay)
```

### Token rotation — dual channel

FCM tokens are rotated by Firebase for security. The hook handles this through two independent channels so no rotation is missed:

| Channel | Trigger | Handler |
|---------|---------|---------|
| **A — Firebase SDK** | `onTokenRefresh` callback | Wired inside `requestPermission`; calls `fetchAndRegisterToken` |
| **B — SW postMessage relay** | `window message { type: 'FCM_TOKEN_REFRESH' }` posted by the service worker | Persistent `window.addEventListener` set up on mount; calls `fetchAndRegisterToken` via `messagingRef` |

Both channels call the same `fetchAndRegisterToken` helper, which is idempotent (no-op if the token is unchanged).

### Service worker (`public/firebase-messaging-sw.js`)

The service worker handles two concerns independently from the React app:

| Event | Behaviour |
|-------|-----------|
| `onBackgroundMessage` | Displays a system notification when the app is in the background or closed. Ignores malformed payloads. |
| `notificationclick` | Focuses an existing app window (or opens a new one) and navigates to `notification.data.actionUrl`. |
| `message` (`firebase-messaging-sw-token-change`) | Relays the rotation event to every controlled window as `{ type: 'FCM_TOKEN_REFRESH' }`. The hook picks this up via the window message listener (channel B above). |

## Configuration

All Firebase config values are injected at deploy time. Set these in `.env.local` (development) or as deployment environment variables (production):

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
```

The VAPID public key (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`) is the Web Push application server key from your Firebase project settings → Cloud Messaging → Web Push certificates.

None of these values are secrets (they are client-visible by design), but they should be scoped to your specific Firebase project.

## Hook API

```typescript
import { usePushNotifications } from '@/hooks/usePushNotifications';

const {
  permission,       // { granted, denied, default } — current browser permission
  fcmToken,         // string | null — active FCM token, null when not registered
  loading,          // boolean — true while any async operation is in-flight
  error,            // string | null — last error message
  requestPermission, // () => Promise<void> — prompts for permission + registers token
  unsubscribe,       // () => Promise<void> — deregisters this device (call on logout)
} = usePushNotifications(userId, vapidKey);
```

### Behaviour guarantees

| Scenario | Behaviour |
|----------|-----------|
| `userId` is `null` (unauthenticated) | `requestPermission` is a no-op; no permission is requested |
| Permission is `denied` | `requestPermission` skips the browser prompt (browsers block it anyway) |
| Permission is already `granted` | `requestPermission` skips the browser prompt and proceeds directly to token registration |
| Same token returned by Firebase (cache hit) | `registerDeviceToken` is not called again (idempotent) |
| Token rotated by Firebase (channel A — SDK) | Old token removed, new token registered atomically |
| Token rotated by Firebase (channel B — SW relay) | Old token removed, new token registered atomically |
| API call fails during token rotation | Error is swallowed; rotation continues best-effort |
| `unsubscribe` called with `userId` null | FCM token is deleted locally and from Firebase; backend API is skipped |
| `unsubscribe` called with API down | FCM token is still deleted locally; local state is cleared regardless |
| `deleteToken` fails during `unsubscribe` | Backend `removeDeviceToken` is still called (errors are independent) |

## Multi-device

Each device registers its own FCM token. Multiple tokens can be registered for the same `userId` — the backend's `device_tokens` table stores one row per `(userId, token)` pair.

When a token is rotated, only the **current device's** stale token is removed. Other devices' tokens are unaffected.

When a user logs out, call `unsubscribe()` to remove the current device's token. Tokens for other devices remain active.

## Security assumptions

- FCM tokens are device-scoped, transient, and non-secret. They are transmitted over TLS and stored only in the backend's `device_tokens` table.
- The service worker `firebase-messaging-sw.js` contains only placeholder Firebase config values. Real values are **never** committed to source control. Review any PR that modifies this file to ensure no credentials were accidentally introduced.
- The hook does not request permission on mount — it waits for an explicit user action. This prevents surprise permission prompts on page load.
- Permission state is read fresh from `Notification.permission` on every `requestPermission` call rather than from stale React state, so the hook always reflects the true browser state even after the user changes permissions in browser settings.
- The `window.addEventListener('message', ...)` handler validates `event.data.type === 'FCM_TOKEN_REFRESH'` before acting and is a no-op when no `messagingRef` is set (before `requestPermission` or after `unsubscribe`/unmount).

## Testing

Tests live in `src/hooks/usePushNotifications.test.ts` and cover:

- Permission states: `denied`, `default`, `granted`
- FCM token is registered with the backend (not the raw `PushSubscription.endpoint`)
- `requestPermission` when already `granted` skips the browser prompt but still registers the token
- `onTokenRefresh` is wired after initial registration (channel A)
- SW postMessage relay (`FCM_TOKEN_REFRESH`) triggers token rotation (channel B)
- `window.addEventListener` is removed on unmount — orphaned hook cannot rotate tokens
- Token rotation removes the stale token before registering the new one
- Logout cleanup (`deleteToken` + `removeDeviceToken`)
- `deleteToken` failure does not prevent `removeDeviceToken` (independent best-effort)
- Local token state cleared even when the API call fails
- `unsubscribe` with `userId` null: clears state and calls Firebase `deleteToken`, skips backend API
- No-op when `userId` is null
- Idempotent registration when token unchanged
- `loading` transitions correctly during async operations
- Error string exposed when `getToken` throws

Run the tests:

```bash
npx jest src/hooks/usePushNotifications.test.ts
```

## Contributor notes

- Do not add push subscription logic directly to `AuthContext.logout()`. Instead, have components that use `usePushNotifications` call `unsubscribe()` before or during logout.
- The `firebase-messaging-sw.js` is served from `public/`. The Firebase SDK requires it at `/firebase-messaging-sw.js` (the root path). Do not move or rename it.
- When changing the service worker, increment the cache version in `public/sw.js` if you also manage a precache manifest there, to ensure clients pick up the new worker.
- Never store real API keys in `firebase-messaging-sw.js`. The placeholder strings are replaced by the deployment pipeline.
- The `messagingRef` stored in the hook is the mechanism that keeps the SW relay (channel B) live. It is set when `requestPermission` succeeds and cleared by both `unsubscribe` and unmount cleanup. Do not bypass this ref when adding new rotation paths.
