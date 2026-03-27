import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  useReducer,
} from 'react';
import {
  AppNotification,
  ToastNotification,
  NotificationPreferences,
  DEFAULT_PREFERENCES,
  NotificationCategory,
} from '@/types/notification';
import { notificationsAPI } from '@/lib/api/notificationsAPI';
import { useAuth } from '@/contexts/AuthContext';

// ─── State ────────────────────────────────────────────────────────────────────

interface NotificationState {
  notifications: AppNotification[];
  unreadCount: number;
  toasts: ToastNotification[];
  preferences: NotificationPreferences;
  isConnected: boolean;
  isCenterOpen: boolean;
  activeFilter: NotificationCategory | 'ALL';
  isLoading: boolean;
}

type Action =
  | { type: 'SET_NOTIFICATIONS'; payload: AppNotification[] }
  | { type: 'ADD_NOTIFICATION'; payload: AppNotification }
  | { type: 'MARK_READ'; id: string }
  | { type: 'MARK_ALL_READ' }
  | { type: 'SET_UNREAD'; count: number }
  | { type: 'ADD_TOAST'; payload: ToastNotification }
  | { type: 'REMOVE_TOAST'; id: string }
  | { type: 'SET_PREFS'; payload: NotificationPreferences }
  | { type: 'SET_CONNECTED'; value: boolean }
  | { type: 'TOGGLE_CENTER' }
  | { type: 'SET_FILTER'; filter: NotificationCategory | 'ALL' }
  | { type: 'SET_LOADING'; value: boolean };

function reducer(state: NotificationState, action: Action): NotificationState {
  switch (action.type) {
    case 'SET_NOTIFICATIONS':
      return { ...state, notifications: action.payload };
    case 'ADD_NOTIFICATION':
      return {
        ...state,
        notifications: [action.payload, ...state.notifications],
        unreadCount: state.unreadCount + 1,
      };
    case 'MARK_READ':
      return {
        ...state,
        notifications: state.notifications.map((n) =>
          n.id === action.id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
      };
    case 'MARK_ALL_READ':
      return {
        ...state,
        notifications: state.notifications.map((n) => ({
          ...n,
          isRead: true,
          readAt: new Date().toISOString(),
        })),
        unreadCount: 0,
      };
    case 'SET_UNREAD':
      return { ...state, unreadCount: action.count };
    case 'ADD_TOAST':
      return { ...state, toasts: [...state.toasts, action.payload] };
    case 'REMOVE_TOAST':
      return { ...state, toasts: state.toasts.filter((t) => t.id !== action.id) };
    case 'SET_PREFS':
      return { ...state, preferences: action.payload };
    case 'SET_CONNECTED':
      return { ...state, isConnected: action.value };
    case 'TOGGLE_CENTER':
      return { ...state, isCenterOpen: !state.isCenterOpen };
    case 'SET_FILTER':
      return { ...state, activeFilter: action.filter };
    case 'SET_LOADING':
      return { ...state, isLoading: action.value };
    default:
      return state;
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface NotificationContextType extends NotificationState {
  toast: (n: Omit<ToastNotification, 'id'>) => void;
  dismissToast: (id: string) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  toggleCenter: () => void;
  setFilter: (f: NotificationCategory | 'ALL') => void;
  updatePreferences: (p: Partial<NotificationPreferences>) => void;
  requestBrowserPermission: () => Promise<void>;
  filteredNotifications: AppNotification[];
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotifications = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PREFS_KEY = 'petchain-notif-prefs';
const PERSIST_KEY = 'petchain-notifications';
const MAX_PERSISTED = 100;

function loadPrefs(): NotificationPreferences {
  if (typeof window === 'undefined') return DEFAULT_PREFERENCES;
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) } : DEFAULT_PREFERENCES;
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

function savePrefs(p: NotificationPreferences) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    /* noop */
  }
}

function loadPersisted(): AppNotification[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PERSIST_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persistNotifications(ns: AppNotification[]) {
  try {
    localStorage.setItem(PERSIST_KEY, JSON.stringify(ns.slice(0, MAX_PERSISTED)));
  } catch {
    /* noop */
  }
}

function isDND(prefs: NotificationPreferences): boolean {
  if (!prefs.doNotDisturb) return false;
  const now = new Date();
  const [sh, sm] = prefs.dndStart.split(':').map(Number);
  const [eh, em] = prefs.dndEnd.split(':').map(Number);
  const cur = now.getHours() * 60 + now.getMinutes();
  const start = sh * 60 + sm;
  const end = eh * 60 + em;
  return start <= end ? cur >= start && cur < end : cur >= start || cur < end;
}

let toastCounter = 0;

// ─── Provider ─────────────────────────────────────────────────────────────────

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelay = useRef(1000);

  const [state, dispatch] = useReducer(reducer, {
    notifications: [],
    unreadCount: 0,
    toasts: [],
    preferences: loadPrefs(),
    isConnected: false,
    isCenterOpen: false,
    activeFilter: 'ALL',
    isLoading: false,
  });

  // ── Load persisted + fetch from API ────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated || !user) return;

    // Seed from localStorage immediately (offline-first)
    const cached = loadPersisted();
    if (cached.length) dispatch({ type: 'SET_NOTIFICATIONS', payload: cached });

    // Then fetch fresh from API
    dispatch({ type: 'SET_LOADING', value: true });
    notificationsAPI
      .getNotifications(user.id)
      .then((res) => {
        const ns = res.data as AppNotification[];
        dispatch({ type: 'SET_NOTIFICATIONS', payload: ns });
        dispatch({ type: 'SET_UNREAD', count: res.unreadCount });
        persistNotifications(ns);
      })
      .catch(() => {
        /* use cached */
      })
      .finally(() => dispatch({ type: 'SET_LOADING', value: false }));
  }, [isAuthenticated, user]);

  // ── WebSocket ───────────────────────────────────────────────────────────────
  const connectWS = useCallback(() => {
    if (!isAuthenticated || !user) return;
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL;
    if (!wsUrl) return; // gracefully skip if not configured

    const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
    if (!token) return;

    try {
      const ws = new WebSocket(`${wsUrl}?token=${token}`);
      wsRef.current = ws;

      ws.onopen = () => {
        dispatch({ type: 'SET_CONNECTED', value: true });
        reconnectDelay.current = 1000;
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'notification') {
            const notif: AppNotification = msg.payload;
            handleIncoming(notif);
          }
        } catch {
          /* ignore malformed */
        }
      };

      ws.onclose = () => {
        dispatch({ type: 'SET_CONNECTED', value: false });
        // Exponential back-off reconnect
        reconnectTimer.current = setTimeout(() => {
          reconnectDelay.current = Math.min(reconnectDelay.current * 2, 30000);
          connectWS();
        }, reconnectDelay.current);
      };

      ws.onerror = () => ws.close();
    } catch {
      /* WS not available */
    }
  }, [isAuthenticated, user]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    connectWS();
    return () => {
      wsRef.current?.close();
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };
  }, [connectWS]);

  // ── Incoming notification handler ───────────────────────────────────────────
  const handleIncoming = useCallback((notif: AppNotification) => {
    const prefs = loadPrefs();

    // Category filter
    if (!prefs.categories[notif.category as NotificationCategory]) return;

    dispatch({ type: 'ADD_NOTIFICATION', payload: notif });

    // Persist
    const current = loadPersisted();
    persistNotifications([notif, ...current]);

    // DND check — skip sound/vibration/toast if in DND (unless urgent)
    const inDND = isDND(prefs) && notif.priority !== 'urgent';

    if (!inDND) {
      // Toast
      dispatch({
        type: 'ADD_TOAST',
        payload: {
          id: `toast-${++toastCounter}`,
          title: notif.title,
          message: notif.message,
          type:
            notif.priority === 'urgent' ? 'error' : notif.category === 'ALERT' ? 'warning' : 'info',
          duration: notif.priority === 'urgent' ? 0 : 5000,
          actionLabel: notif.actionUrl ? 'View' : undefined,
          onAction: notif.actionUrl
            ? () => {
                window.location.href = notif.actionUrl!;
              }
            : undefined,
        },
      });

      // Sound
      if (prefs.sound) playNotificationSound(notif.priority);

      // Vibration
      if (prefs.vibration && 'vibrate' in navigator) {
        navigator.vibrate(notif.priority === 'urgent' ? [100, 50, 100] : [50]);
      }

      // Browser push (if already granted)
      if (
        prefs.browserPush &&
        typeof window !== 'undefined' &&
        Notification.permission === 'granted'
      ) {
        new Notification(notif.title, {
          body: notif.message,
          icon: '/icons/icon-192x192.svg',
          tag: notif.id,
        });
      }
    }
  }, []);

  // ── Public API ──────────────────────────────────────────────────────────────
  const toast = useCallback((n: Omit<ToastNotification, 'id'>) => {
    const id = `toast-${++toastCounter}`;
    dispatch({ type: 'ADD_TOAST', payload: { ...n, id } });
  }, []);

  const dismissToast = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_TOAST', id });
  }, []);

  const markRead = useCallback(
    async (id: string) => {
      dispatch({ type: 'MARK_READ', id });
      if (user) {
        try {
          await notificationsAPI.markAsRead(user.id, id);
        } catch {
          /* optimistic */
        }
      }
    },
    [user]
  );

  const markAllRead = useCallback(async () => {
    dispatch({ type: 'MARK_ALL_READ' });
    if (user) {
      try {
        await notificationsAPI.markAllAsRead(user.id);
      } catch {
        /* optimistic */
      }
    }
  }, [user]);

  const toggleCenter = useCallback(() => dispatch({ type: 'TOGGLE_CENTER' }), []);

  const setFilter = useCallback((f: NotificationCategory | 'ALL') => {
    dispatch({ type: 'SET_FILTER', filter: f });
  }, []);

  const updatePreferences = useCallback(
    (p: Partial<NotificationPreferences>) => {
      const next = { ...state.preferences, ...p };
      dispatch({ type: 'SET_PREFS', payload: next });
      savePrefs(next);
    },
    [state.preferences]
  );

  const requestBrowserPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    const result = await Notification.requestPermission();
    if (result === 'granted') {
      updatePreferences({ browserPush: true });
    }
  }, [updatePreferences]);

  const filteredNotifications =
    state.activeFilter === 'ALL'
      ? state.notifications
      : state.notifications.filter((n) => n.category === state.activeFilter);

  return (
    <NotificationContext.Provider
      value={{
        ...state,
        toast,
        dismissToast,
        markRead,
        markAllRead,
        toggleCenter,
        setFilter,
        updatePreferences,
        requestBrowserPermission,
        filteredNotifications,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

// ─── Sound ────────────────────────────────────────────────────────────────────
function playNotificationSound(priority: string) {
  if (typeof window === 'undefined') return;
  try {
    const ctx = new (
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    )();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = priority === 'urgent' ? 880 : 440;
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch {
    /* audio not available */
  }
}
