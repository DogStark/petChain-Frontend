import {
  NotificationCategory,
  NotificationPreferences,
  CATEGORY_LABELS,
} from '@/types/notification';

export type ChannelKey = 'inApp' | 'sound' | 'vibration' | 'browserPush';

export interface ChannelPreview {
  key: ChannelKey;
  label: string;
  /** Whether this channel is currently selected. In-app is always available. */
  enabled: boolean;
  /** A representative sample of how a notification appears on this channel. */
  sample: string;
}

export interface CategoryPreview {
  key: NotificationCategory;
  label: string;
}

export interface NotificationPreview {
  /** Every channel, with `enabled` reflecting the current selection. */
  channels: ChannelPreview[];
  /** Event categories that will trigger delivery. */
  categories: CategoryPreview[];
  /** True when Do Not Disturb quiet hours are configured (privacy mode). */
  quietHoursEnabled: boolean;
  /** Human-readable explanation of when messages will be delivered. */
  deliverySummary: string;
  /** True when no event category is enabled — nothing will be delivered. */
  isEmpty: boolean;
  enabledChannelCount: number;
  enabledCategoryCount: number;
}

// In-app is inherent to the notification center, so it is always available.
// The other three are user-selectable channels surfaced in the preferences UI.
const CHANNELS: Omit<ChannelPreview, 'enabled'>[] = [
  {
    key: 'inApp',
    label: 'In-app',
    sample:
      'Appears in your notification center: "Reminder: Rex’s vaccination is due tomorrow".',
  },
  {
    key: 'sound',
    label: 'Sound',
    sample: 'Each new notification is accompanied by a chime on your device.',
  },
  {
    key: 'vibration',
    label: 'Vibration',
    sample: 'Your phone vibrates for each new notification.',
  },
  {
    key: 'browserPush',
    label: 'Browser push',
    sample:
      'A push appears on your lock screen even when the app is closed: "Lost-pet alert near you".',
  },
];

/**
 * Builds a delivery preview from the current notification preferences, so an
 * owner can see exactly what they will receive *before* saving.
 *
 * Pure and side-effect free. It only reflects local preference selections —
 * actual fan-out, authorization, and consent enforcement remain server-side
 * (the backend keeps ownership of who is notified and when).
 */
export function buildNotificationPreview(
  prefs: NotificationPreferences
): NotificationPreview {
  const channels: ChannelPreview[] = CHANNELS.map((c) => ({
    ...c,
    enabled:
      c.key === 'inApp'
        ? true
        : Boolean(prefs[c.key as 'sound' | 'vibration' | 'browserPush']),
  }));

  const categories: CategoryPreview[] = (
    Object.keys(prefs.categories) as NotificationCategory[]
  )
    .filter((cat) => prefs.categories[cat])
    .map((cat) => ({ key: cat, label: CATEGORY_LABELS[cat] }));

  const enabledChannelCount = channels.filter((c) => c.enabled).length;
  const enabledCategoryCount = categories.length;
  const quietHoursEnabled = Boolean(prefs.doNotDisturb);

  const isEmpty = enabledCategoryCount === 0;

  let deliverySummary: string;
  if (isEmpty) {
    deliverySummary =
      'No event types are enabled, so you will not receive any notifications.';
  } else if (quietHoursEnabled) {
    const start = prefs.dndStart || '22:00';
    const end = prefs.dndEnd || '08:00';
    const tz = prefs.timezone || 'UTC';
    deliverySummary =
      `You will receive ${enabledCategoryCount} event type${enabledCategoryCount === 1 ? '' : 's'} ` +
      `on ${enabledChannelCount} channel${enabledChannelCount === 1 ? '' : 's'}. ` +
      `During quiet hours (${start}–${end}, ${tz}), only urgent alerts are delivered; ` +
      `everything else is held until quiet hours end.`;
  } else {
    deliverySummary =
      `You will receive ${enabledCategoryCount} event type${enabledCategoryCount === 1 ? '' : 's'} ` +
      `on ${enabledChannelCount} channel${enabledChannelCount === 1 ? '' : 's'} as they happen.`;
  }

  return {
    channels,
    categories,
    quietHoursEnabled,
    deliverySummary,
    isEmpty,
    enabledChannelCount,
    enabledCategoryCount,
  };
}
