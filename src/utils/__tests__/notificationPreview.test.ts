import {
  buildNotificationPreview,
  ChannelKey,
  NotificationPreview,
} from '../notificationPreview';
import {
  DEFAULT_PREFERENCES,
  NotificationCategory,
  NotificationPreferences,
} from '@/types/notification';

function withPrefs(overrides: Partial<NotificationPreferences>): NotificationPreferences {
  return { ...DEFAULT_PREFERENCES, ...overrides };
}

function withCategories(
  enabled: NotificationCategory[]
): NotificationPreferences {
  const categories = Object.fromEntries(
    (Object.keys(DEFAULT_PREFERENCES.categories) as NotificationCategory[]).map(
      (cat) => [cat, enabled.includes(cat)]
    )
  ) as Record<NotificationCategory, boolean>;
  return withPrefs({ categories });
}

describe('buildNotificationPreview', () => {
  it('reports the in-app channel as always enabled and reflects the sound/vibration/browserPush toggles', () => {
    const p = buildNotificationPreview(DEFAULT_PREFERENCES);
    const enabled = p.channels.filter((c) => c.enabled).map((c) => c.key);
    expect(enabled).toEqual<ChannelKey[]>(['inApp', 'sound', 'vibration']);
    expect(p.enabledChannelCount).toBe(3);
    // browserPush is off by default:
    expect(p.channels.find((c) => c.key === 'browserPush')?.enabled).toBe(false);
  });

  it('lists every enabled event category as a delivery trigger (primary flow)', () => {
    const p = buildNotificationPreview(DEFAULT_PREFERENCES);
    expect(p.enabledCategoryCount).toBe(9);
    expect(p.categories.map((c) => c.key)).toEqual(Object.keys(DEFAULT_PREFERENCES.categories));
    expect(p.isEmpty).toBe(false);
  });

  it('produces a representative sample message per enabled channel', () => {
    const p = buildNotificationPreview(DEFAULT_PREFERENCES);
    const byKey = Object.fromEntries(p.channels.map((c) => [c.key, c]));
    expect(byKey.inApp.sample).toMatch(/notification center/i);
    expect(byKey.sound.sample).toMatch(/chime/i);
    expect(byKey.vibration.sample).toMatch(/vibrates/i);
    // browserPush is disabled, so its sample still describes the channel but it is off:
    expect(byKey.browserPush.enabled).toBe(false);
    expect(byKey.browserPush.sample).toMatch(/lock screen/i);
  });

  it('treats "no event categories enabled" as the empty / denied state', () => {
    const p = buildNotificationPreview(withCategories([]));
    expect(p.isEmpty).toBe(true);
    expect(p.categories).toEqual([]);
    expect(p.enabledCategoryCount).toBe(0);
    expect(p.deliverySummary).toMatch(/no event types/i);
  });

  it('reflects Do Not Disturb quiet hours in the delivery summary (privacy mode)', () => {
    const p = buildNotificationPreview(
      withPrefs({
        doNotDisturb: true,
        dndStart: '22:00',
        dndEnd: '08:00',
        timezone: 'America/New_York',
      })
    );
    expect(p.quietHoursEnabled).toBe(true);
    expect(p.deliverySummary).toMatch(/quiet hours/i);
    expect(p.deliverySummary).toMatch(/22:00/);
    expect(p.deliverySummary).toMatch(/America\/New_York/);
    expect(p.deliverySummary).toMatch(/urgent alerts/i);
  });

  it('summarizes delivery as events happen when quiet hours are off', () => {
    const p = buildNotificationPreview(withPrefs({ doNotDisturb: false }));
    expect(p.quietHoursEnabled).toBe(false);
    expect(p.deliverySummary).toMatch(/as they happen/i);
  });

  it('drops channels when their toggles are switched off', () => {
    const p = buildNotificationPreview(
      withPrefs({ sound: false, vibration: false, browserPush: false })
    );
    // in-app remains, the three selectable channels are now off:
    expect(p.enabledChannelCount).toBe(1);
    expect(p.channels.filter((c) => c.enabled).map((c) => c.key)).toEqual<ChannelKey[]>(['inApp']);
  });

  it('reports exactly the selected event categories (boundary: single category)', () => {
    const p = buildNotificationPreview(withCategories(['APPOINTMENT']));
    expect(p.categories).toEqual([{ key: 'APPOINTMENT', label: 'Appointments' }]);
    expect(p.enabledCategoryCount).toBe(1);
    expect(p.isEmpty).toBe(false);
  });

  it('returns a complete, well-formed preview object for the default preferences', () => {
    const p: NotificationPreview = buildNotificationPreview(DEFAULT_PREFERENCES);
    expect(typeof p.deliverySummary).toBe('string');
    expect(p.channels.length).toBe(4);
    expect(p.categories.length).toBe(9);
    expect(p.isEmpty).toBe(false);
  });
});
