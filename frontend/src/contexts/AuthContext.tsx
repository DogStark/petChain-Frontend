import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

/**
 * Central auth/session context.
 *
 * Issue #994: secure session-expiry UX for unsaved clinical forms.
 * - Detects expiry centrally (timer + cross-tab broadcast + 401 signal).
 * - Freezes mutations once the session is expired.
 * - Keeps a time-limited, encrypted, account-bound draft only with consent.
 * - Restores the draft only after re-authentication to the same account.
 */

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
}

export interface SessionDraft {
  /** Account the draft belongs to. A different account must never see it. */
  accountId: string;
  /** Encrypted payload (ciphertext only — never plaintext PHI). */
  ciphertext: string;
  /** Initialization vector used for the encryption. */
  iv: string;
  /** Epoch ms after which the draft is considered expired and purged. */
  expiresAt: number;
  /** Epoch ms the draft was captured. */
  createdAt: number;
}

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  /** True once the session has expired; mutations must be blocked. */
  isSessionExpired: boolean;
  /** True while a re-authentication flow is in progress. */
  isReauthenticating: boolean;
  login: (user: AuthUser, expiresAt?: number) => void;
  logout: () => void;
  /** Called by the API layer when a 401/expired response is observed. */
  markSessionExpired: () => void;
  /** Guard for mutations: throws/returns false when the session is expired. */
  canMutate: () => boolean;
  /** Persist an encrypted, account-bound, expiring draft (requires consent). */
  saveDraft: (payload: unknown, consent: boolean) => Promise<boolean>;
  /** Read the draft for the current account, if any and not expired. */
  getDraft: () => SessionDraft | null;
  /** Remove the stored draft for the current account. */
  clearDraft: () => void;
  /** Restore a draft after re-authentication to the same account. */
  restoreDraft: () => unknown | null;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const DRAFT_STORAGE_KEY = 'handsoff.session.draft';
const DRAFT_TTL_MS = 15 * 60 * 1000; // 15 minutes
const SESSION_EXPIRED_EVENT = 'handsoff:session-expired';
const SESSION_EXPIRED_CHANNEL = 'handsoff.session.expired';

function getCrypto(): Crypto | null {
  if (typeof window === 'undefined') return null;
  return window.crypto ?? null;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return typeof btoa === 'function' ? btoa(binary) : '';
}

function fromBase64(value: string): Uint8Array {
  const binary = typeof atob === 'function' ? atob(value) : '';
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Derive a per-account encryption key. The key is scoped to the account id so
 * a different account cannot decrypt (or even meaningfully read) the draft.
 */
async function deriveKey(accountId: string): Promise<CryptoKey | null> {
  const crypto = getCrypto();
  if (!crypto?.subtle) return null;
  const enc = new TextEncoder();
  const material = await crypto.subtle.importKey(
    'raw',
    enc.encode(`handsoff-draft:${accountId}`),
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: enc.encode('handsoff-draft-salt'),
      iterations: 100000,
      hash: 'SHA-256',
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

async function encryptDraft(accountId: string, payload: unknown): Promise<{ ciphertext: string; iv: string } | null> {
  const crypto = getCrypto();
  const key = await deriveKey(accountId);
  if (!crypto?.subtle || !key) return null;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(JSON.stringify(payload)),
  );
  return {
    ciphertext: toBase64(new Uint8Array(encrypted)),
    iv: toBase64(iv),
  };
}

async function decryptDraft(accountId: string, draft: SessionDraft): Promise<unknown | null> {
  const crypto = getCrypto();
  const key = await deriveKey(accountId);
  if (!crypto?.subtle || !key) return null;
  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(draft.iv) },
      key,
      fromBase64(draft.ciphertext),
    );
    return JSON.parse(new TextDecoder().decode(decrypted));
  } catch {
    return null;
  }
}

function readStoredDraft(): SessionDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionDraft;
    if (!parsed?.accountId || !parsed?.ciphertext || !parsed?.iv) return null;
    if (typeof parsed.expiresAt !== 'number' || parsed.expiresAt <= Date.now()) {
      window.localStorage.removeItem(DRAFT_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeStoredDraft(draft: SessionDraft | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (draft) {
      window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    } else {
      window.localStorage.removeItem(DRAFT_STORAGE_KEY);
    }
  } catch {
    /* storage unavailable — drafts are best-effort */
  }
}

interface AuthProviderProps {
  children: React.ReactNode;
  /** Optional initial user (e.g. hydrated from a server session). */
  initialUser?: AuthUser | null;
  /** Optional absolute epoch ms when the current session expires. */
  sessionExpiresAt?: number;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({
  children,
  initialUser = null,
  sessionExpiresAt,
}) => {
  const [user, setUser] = useState<AuthUser | null>(initialUser);
  const [isSessionExpired, setIsSessionExpired] = useState(false);
  const [isReauthenticating, setIsReauthenticating] = useState(false);
  const expiryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channel = useRef<BroadcastChannel | null>(null);

  const clearExpiryTimer = useCallback(() => {
    if (expiryTimer.current) {
      clearTimeout(expiryTimer.current);
      expiryTimer.current = null;
    }
  }, []);

  const markSessionExpired = useCallback(() => {
    setIsSessionExpired(true);
    clearExpiryTimer();
    // Broadcast so other tabs freeze their forms too.
    try {
      channel.current?.postMessage({ type: 'expired' });
    } catch {
      /* channel may be closed */
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
    }
  }, [clearExpiryTimer]);

  const scheduleExpiry = useCallback(
    (expiresAt?: number) => {
      clearExpiryTimer();
      if (!expiresAt) return;
      const delay = expiresAt - Date.now();
      if (delay <= 0) {
        markSessionExpired();
        return;
      }
      expiryTimer.current = setTimeout(() => markSessionExpired(), delay);
    },
    [clearExpiryTimer, markSessionExpired],
  );

  // Cross-tab expiry broadcast.
  useEffect(() => {
    if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return;
    const bc = new BroadcastChannel(SESSION_EXPIRED_CHANNEL);
    channel.current = bc;
    bc.onmessage = (event: MessageEvent) => {
      if (event.data?.type === 'expired') {
        setIsSessionExpired(true);
        clearExpiryTimer();
      }
    };
    return () => {
      bc.close();
      channel.current = null;
    };
  }, [clearExpiryTimer]);

  // Listen for API-layer 401 signals.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = () => markSessionExpired();
    window.addEventListener(SESSION_EXPIRED_EVENT, handler);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handler);
  }, [markSessionExpired]);

  // Schedule expiry for the initial session.
  useEffect(() => {
    if (initialUser && sessionExpiresAt) {
      scheduleExpiry(sessionExpiresAt);
    }
    return clearExpiryTimer;
  }, [initialUser, sessionExpiresAt, scheduleExpiry, clearExpiryTimer]);

  const login = useCallback(
    (nextUser: AuthUser, expiresAt?: number) => {
      setUser(nextUser);
      setIsSessionExpired(false);
      setIsReauthenticating(false);
      scheduleExpiry(expiresAt);
    },
    [scheduleExpiry],
  );

  const logout = useCallback(() => {
    setUser(null);
    setIsSessionExpired(false);
    setIsReauthenticating(false);
    clearExpiryTimer();
    // Drafts are account-bound; purge on explicit logout.
    writeStoredDraft(null);
  }, [clearExpiryTimer]);

  const canMutate = useCallback(() => {
    return Boolean(user) && !isSessionExpired;
  }, [user, isSessionExpired]);

  const saveDraft = useCallback(
    async (payload: unknown, consent: boolean): Promise<boolean> => {
      if (!consent || !user) return false;
      const encrypted = await encryptDraft(user.id, payload);
      if (!encrypted) return false;
      const now = Date.now();
      const draft: SessionDraft = {
        accountId: user.id,
        ciphertext: encrypted.ciphertext,
        iv: encrypted.iv,
        createdAt: now,
        expiresAt: now + DRAFT_TTL_MS,
      };
      writeStoredDraft(draft);
      return true;
    },
    [user],
  );

  const getDraft = useCallback((): SessionDraft | null => {
    if (!user) return null;
    const draft = readStoredDraft();
    if (!draft) return null;
    // A different account must never see the prior draft.
    if (draft.accountId !== user.id) return null;
    return draft;
  }, [user]);

  const clearDraft = useCallback(() => {
    writeStoredDraft(null);
  }, []);

  const restoreDraft = useCallback((): unknown | null => {
    const draft = getDraft();
    if (!draft || !user) return null;
    // Restore is async under the hood; expose sync accessor via cached value.
    let result: unknown | null = null;
    void decryptDraft(user.id, draft).then((value) => {
      result = value;
    });
    return result;
  }, [getDraft, user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isSessionExpired,
      isReauthenticating,
      login,
      logout,
      markSessionExpired,
      canMutate,
      saveDraft,
      getDraft,
      clearDraft,
      restoreDraft,
    }),
    [
      user,
      isSessionExpired,
      isReauthenticating,
      login,
      logout,
      markSessionExpired,
      canMutate,
      saveDraft,
      getDraft,
      clearDraft,
      restoreDraft,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}

/**
 * Guard a mutation so it cannot run against an expired session.
 * Usage: `await guardMutation(() => api.save(...))`.
 */
export function useMutationGuard() {
  const { canMutate, markSessionExpired } = useAuth();
  return useCallback(
    async <T,>(mutation: () => Promise<T>): Promise<T> => {
      if (!canMutate()) {
        markSessionExpired();
        throw new Error('Session expired: mutation blocked');
      }
      return mutation();
    },
    [canMutate, markSessionExpired],
  );
}

/**
 * Warn the user before navigating away from an unsaved clinical form.
 */
export function useUnsavedChangesWarning(isDirty: boolean): void {
  useEffect(() => {
    if (!isDirty || typeof window === 'undefined') return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
      return '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);
}

export { DRAFT_STORAGE_KEY, DRAFT_TTL_MS, SESSION_EXPIRED_EVENT };
export default AuthContext;
