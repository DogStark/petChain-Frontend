/**
 * NotificationService
 *
 * Singleton that manages:
 *  - In-app notification queue (success / error / warning / info)
 *  - Browser push permission + subscription via service worker
 *  - Notification persistence (localStorage) with read/unread state
 *  - Notification preferences management
 *  - Typed event emitter so React context can subscribe without coupling
 */

import type {
  AppNotification,
  ToastNotification,
  NotificationPreferences,
  NotificationCategory,
} from '@/types/notification';
import { DEFAULT_PREFERENCES } from '@/types/notification';
import { notificationsAPI } from '@/lib/api/notificationsAPI';

// ─── Constants ────────────────────────────────────────────────────────────────

const HISTORY_KEY = 'petchain-notification-history';
const PREFS_KEY = 'petchain-notif-prefs';
const MAX_HISTORY = 100;
const QUEUE_INTERVAL_MS = 5_000;

// ─── Types ────────────────────────────────────────────────────────────────────

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface InAppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  category?: NotificationCategory;
  actionUrl?: string;
  duration?: number; // ms — 0 = sticky
  priority?: AppNotification['priority'];
  metadata?: Record<string, unknown>;
  createdAt: string;
  isRead: boolean;
}

export interface NotificationPermissionStatus {
  granted: boolean;
  denied: boolean;
  default: boolean;
}

type ServiceEventMap = {
  notification: InAppNotification;
  permissionChange: NotificationPermissionStatus;
  preferencesChange: NotificationPreferences;
};

type ServiceListener<K extends keyof ServiceEventMap> = (
  payload: ServiceEventMap[K],
) => void;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function safeLocalGet<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function safeLocalSet(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full / private mode */
  }
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class NotificationService {
  private static _instance: NotificationService | null = null;

  private queue: InAppNotification[] = [];
  private isProcessing = false;
  private intervalId: ReturnType<typeof setInterval> | null = null;

  private listeners: {
    [K in keyof ServiceEventMap]?: Set<ServiceListener<K>>;
  } = {};

  private constructor() {
    if (typeof window === 'undefined') return; // SSR guard
    this._startQueueProcessor();
    this._listenVisibilityChange();
    this._listenServiceWorkerMessages();
  }

  static getInstance(): NotificationService {
    if (!NotificationService._instance) {
      NotificationService._instance = new NotificationService();
    }
    return NotificationService._instance;
  }

  // ── Event emitter ───────────────────────────────────────────────────────────

  on<K extends keyof ServiceEventMap>(event: K, listener: ServiceListener<K>): () => void {
    if (!this.listeners[event]) {
      (this.listeners[event] as Set<ServiceListener<K>>) = new Set();
    }
    (this.listeners[event] as Set<ServiceListener<K>>).add(listener);
    return () => this.off(event, listener);
  }

  off<K extends keyof ServiceEventMap>(event: K, listener: ServiceListener<K>): void {
    (this.listeners[event] as Set<ServiceListener<K>> | undefined)?.delete(listener);
  }

  private emit<K extends keyof ServiceEventMap>(event: K, payload: ServiceEventMap[K]): void {
    (this.listeners[event] as Set<ServiceListener<K>> | undefined)?.forEach((fn) => fn(payload));
  }

  // ── Queue management ────────────────────────────────────────────────────────

  enqueue(
    type: NotificationType,
    title: string,
    message: string,
    options: Partial<
      Pick<InAppNotification, 'category' | 'actionUrl' | 'duration' | 'priority' | 'metadata'>
    > = {},
  ): string {
    const notif: InAppNotification = {
      id: uid(),
      type,
      title,
      message,
      createdAt: new Date().toISOString(),
      isRead: false,
      ...options,
    };
    this.queue.push(notif);
    if (!this.isProcessing) this._processQueue();
    return notif.id;
  }

  success(title: string, message = '', options: Partial<Pick<InAppNotification, 'category' | 'actionUrl' | 'duration' | 'priority' | 'metadata'>> = {}): string {
    return this.enqueue('success', title, message, options);
  }

  error(title: string, message = '', options: Partial<Pick<InAppNotification, 'category' | 'actionUrl' | 'duration' | 'priority' | 'metadata'>> = {}): string {
    return this.enqueue('error', title, message, { duration: 0, ...options });
  }

  warning(title: string, message = '', options: Partial<Pick<InAppNotification, 'category' | 'actionUrl' | 'duration' | 'priority' | 'metadata'>> = {}): string {
    return this.enqueue('warning', title, message, options);
  }

  info(title: string, message = '', options: Partial<Pick<InAppNotification, 'category' | 'actionUrl' | 'duration' | 'priority' | 'metadata'>> = {}): string {
    return this.enqueue('info', title, message, options);
  }

  private async _processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;
    try {
      while (this.queue.length > 0) {
        const notif = this.queue.shift()!;
        await this._processOne(notif);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private async _processOne(notif: InAppNotification): Promise<void> {
    this._persistToHistory(notif);
    this.emit('notification', notif);

    const prefs = this.getPreferences();
    if (prefs.browserPush && this.getPermissionStatus().granted) {
      this._sendBrowserNotification(notif);
    }
  }

  private _startQueueProcessor(): void {
    this.intervalId = setInterval(() => {
      if (!document.hidden) this._processQueue();
    }, QUEUE_INTERVAL_MS);
  }

  private _listenVisibilityChange(): void {
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) this._processQueue();
    });
  }

  destroy(): void {
    if (this.intervalId) clearInterval(this.intervalId);
    this.listeners = {};
    NotificationService._instance = null;
  }

  // ── Browser Notification API ────────────────────────────────────────────────

  async requestPermission(): Promise<NotificationPermissionStatus> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return { granted: false, denied: false, default: true };
    }
    if (Notification.permission === 'granted') {
      return { granted: true, denied: false, default: false };
    }
    if (Notification.permission === 'denied') {
      return { granted: false, denied: true, default: false };
    }
    try {
      const result = await Notification.requestPermission();
      const status: NotificationPermissionStatus = {
        granted: result === 'granted',
        denied: result === 'denied',
        default: result === 'default',
      };
      this.emit('permissionChange', status);
      return status;
    } catch {
      return { granted: false, denied: false, default: true };
    }
  }

  getPermissionStatus(): NotificationPermissionStatus {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return { granted: false, denied: false, default: true };
    }
    return {
      granted: Notification.permission === 'granted',
      denied: Notification.permission === 'denied',
      default: Notification.permission === 'default',
    };
  }

  private _sendBrowserNotification(notif: InAppNotification): void {
    try {
      const n = new Notification(notif.title, {
        body: notif.message,
        icon: '/icons/icon-192x192.svg',
        tag: notif.id,
        requireInteraction: notif.type === 'error',
        silent: false,
      });
      n.onclick = () => {
        window.focus();
        if (notif.actionUrl) window.location.href = notif.actionUrl;
        this.markRead(notif.id);
        n.close();
      };
      if (notif.type !== 'error') {
        setTimeout(() => n.close(), notif.duration ?? 5_000);
      }
    } catch {
      /* browser may block */
    }
  }

  // ── Push subscription (service worker) ─────────────────────────────────────

  async subscribePush(userId: string, vapidPublicKey: string): Promise<PushSubscription | null> {
    if (
      typeof window === 'undefined' ||
      !('serviceWorker' in navigator) ||
      !('PushManager' in window)
    ) {
      return null;
    }
    try {
      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      if (existing) {
        await this._registerTokenWithApi(userId, existing);
        return existing;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this._urlBase64ToUint8Array(vapidPublicKey),
      });
      await this._registerTokenWithApi(userId, sub);
      return sub;
    } catch {
      return null;
    }
  }

  async unsubscribePush(userId: string): Promise<boolean> {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return false;
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!sub) return true;
      const token = sub.endpoint;
      await sub.unsubscribe();
      await notificationsAPI.removeDeviceToken(userId, token);
      return true;
    } catch {
      return false;
    }
  }

  private async _registerTokenWithApi(userId: string, sub: PushSubscription): Promise<void> {
    try {
      await notificationsAPI.registerDeviceToken(userId, {
        token: sub.endpoint,
        platform: 'web',
      });
    } catch {
      /* non-fatal */
    }
  }

  private _listenServiceWorkerMessages(): void {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.addEventListener('message', (event: MessageEvent) => {
      const msg = event.data as { type?: string; payload?: Partial<InAppNotification> } | null;
      if (!msg || msg.type !== 'PUSH_NOTIFICATION' || !msg.payload) return;
      const p = msg.payload;
      this.enqueue(p.type ?? 'info', p.title ?? 'Notification', p.message ?? '', {
        category: p.category,
        actionUrl: p.actionUrl,
        priority: p.priority,
        metadata: p.metadata,
      });
    });
  }

  private _urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
  }

  // ── Persistence ─────────────────────────────────────────────────────────────

  private _persistToHistory(notif: InAppNotification): void {
    const history = this.getHistory();
    history.unshift(notif);
    safeLocalSet(HISTORY_KEY, history.slice(0, MAX_HISTORY));
  }

  getHistory(): InAppNotification[] {
    return safeLocalGet<InAppNotification[]>(HISTORY_KEY, []);
  }

  clearHistory(): void {
    if (typeof window !== 'undefined') localStorage.removeItem(HISTORY_KEY);
  }

  // ── Read / unread state ─────────────────────────────────────────────────────

  markRead(id: string): void {
    const history = this.getHistory().map((n) =>
      n.id === id ? { ...n, isRead: true } : n,
    );
    safeLocalSet(HISTORY_KEY, history);
  }

  markAllRead(): void {
    const history = this.getHistory().map((n) => ({ ...n, isRead: true }));
    safeLocalSet(HISTORY_KEY, history);
  }

  getUnreadCount(): number {
    return this.getHistory().filter((n) => !n.isRead).length;
  }

  // ── Preferences ─────────────────────────────────────────────────────────────

  getPreferences(): NotificationPreferences {
    return safeLocalGet<NotificationPreferences>(PREFS_KEY, DEFAULT_PREFERENCES);
  }

  updatePreferences(patch: Partial<NotificationPreferences>): NotificationPreferences {
    const next: NotificationPreferences = { ...this.getPreferences(), ...patch };
    safeLocalSet(PREFS_KEY, next);
    this.emit('preferencesChange', next);
    return next;
  }

  // ── Context integration helpers ─────────────────────────────────────────────

  /**
   * Convert an InAppNotification to the ToastNotification shape
   * expected by the existing Toast / NotificationContext.
   */
  toToast(notif: InAppNotification): Omit<ToastNotification, 'id'> {
    return {
      title: notif.title,
      message: notif.message,
      type: notif.type,
      duration: notif.duration,
      actionLabel: notif.actionUrl ? 'View' : undefined,
      onAction: notif.actionUrl
        ? () => { window.location.href = notif.actionUrl!; }
        : undefined,
    };
  }

  /** Send a test notification to verify the full pipeline. */
  async test(): Promise<boolean> {
    const status = await this.requestPermission();
    if (!status.granted) return false;
    this.enqueue('success', 'PetChain Notifications', 'Notifications are working!', {
      duration: 3_000,
    });
    return true;
  }
}

// ─── Singleton export ─────────────────────────────────────────────────────────

export const notificationService = NotificationService.getInstance();
