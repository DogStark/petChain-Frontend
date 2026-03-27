import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { NotificationPreferences } from '../components/Settings/NotificationPreferences';
import { PrivacySettings } from '../components/Settings/PrivacySettings';
import { userAPI, UpdateUserPreferencesDto, UserProfile } from '../lib/api/userAPI';
import styles from '../styles/pages/PreferencesPage.module.css';

export const dynamic = 'force-dynamic';

type NotificationPreferenceState = {
  emailNotifications: boolean;
  smsNotifications: boolean;
  smsEmergencyAlerts: boolean;
  smsReminderAlerts: boolean;
  pushNotifications: boolean;
  marketingEmails: boolean;
  activityEmails: boolean;
};

type PrivacyPreferenceState = {
  showEmail: boolean;
  showPhone: boolean;
  showActivity: boolean;
};

export default function PreferencesPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'notifications' | 'privacy'>('notifications');
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferenceState | null>(
    null
  );
  const [smsUsage, setSmsUsage] = useState<{
    sent: number;
    delivered: number;
    costCents: number;
    limitCents: number | null;
  } | null>(null);
  const [privacyPrefs, setPrivacyPrefs] = useState<PrivacyPreferenceState | null>(null);
  const [preferences, setPreferences] = useState<UpdateUserPreferencesDto | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const [prefs, usage, userProfile] = await Promise.all([
          userAPI.getPreferences(),
          userAPI.getSMSUsage().catch(() => null),
          userAPI.getCurrentProfile(),
        ]);
        setPreferences(prefs);
        setProfile(userProfile);
        setNotificationPrefs({
          emailNotifications: prefs.emailNotifications,
          smsNotifications: prefs.smsNotifications,
          smsEmergencyAlerts: prefs.smsEmergencyAlerts,
          smsReminderAlerts: prefs.smsReminderAlerts,
          pushNotifications: prefs.pushNotifications,
          marketingEmails: prefs.marketingEmails,
          activityEmails: prefs.activityEmails,
        });
        if (usage)
          setSmsUsage({
            sent: usage.sent,
            delivered: usage.delivered,
            costCents: usage.costCents,
            limitCents: usage.limitCents,
          });
        setPrivacyPrefs({
          showEmail: prefs.privacySettings?.showEmail ?? false,
          showPhone: prefs.privacySettings?.showPhone ?? false,
          showActivity: prefs.privacySettings?.showActivity ?? false,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to load preferences';
        setError(message);
        if (
          typeof err === 'object' &&
          err !== null &&
          'response' in err &&
          typeof (err as { response?: { status?: number } }).response?.status === 'number' &&
          (err as { response?: { status?: number } }).response?.status === 401
        ) {
          router.push('/login');
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadPreferences();
  }, [router]);

  const handleNotificationPreferencesSubmit = async (data: NotificationPreferenceState) => {
    try {
      setIsLoading(true);
      const updated = await userAPI.updateNotificationPreferences(data);
      setNotificationPrefs(updated);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update preferences');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrivacySettingsSubmit = async (data: {
    privacy: PrivacyPreferenceState;
    profile: {
      profilePublic: boolean;
      dataShareConsent: boolean;
      preferredLanguage: string;
      timezone: string;
    };
  }) => {
    try {
      setIsLoading(true);
      // Update both privacy and profile settings
      if (data.privacy) {
        await userAPI.updatePrivacySettings(data.privacy);
      }
      if (data.profile) {
        const updatedPreferences = await userAPI.updatePreferences({
          profilePublic: data.profile.profilePublic,
          dataShareConsent: data.profile.dataShareConsent,
          preferredLanguage: data.profile.preferredLanguage,
          timezone: data.profile.timezone,
        });
        setPreferences(updatedPreferences);
      }
      setPrivacyPrefs(data.privacy);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update settings');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && !notificationPrefs) {
    return <div className={styles.loading}>Loading preferences...</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Preferences & Settings</h1>
        <p>Manage your notifications, privacy, and data preferences</p>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'notifications' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('notifications')}
        >
          Notifications
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'privacy' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('privacy')}
        >
          Privacy
        </button>
      </div>

      <div className={styles.content}>
        {activeTab === 'notifications' && notificationPrefs && profile && (
          <NotificationPreferences
            userId={profile.id}
            preferences={notificationPrefs}
            smsUsage={smsUsage ?? undefined}
            onSubmit={handleNotificationPreferencesSubmit}
            isLoading={isLoading}
          />
        )}

        {activeTab === 'privacy' && privacyPrefs && preferences && (
          <PrivacySettings
            settings={privacyPrefs}
            preferences={{
              profilePublic: preferences.profilePublic,
              dataShareConsent: preferences.dataShareConsent,
              preferredLanguage: preferences.preferredLanguage,
              timezone: preferences.timezone,
            }}
            onSubmit={handlePrivacySettingsSubmit}
            isLoading={isLoading}
          />
        )}
      </div>
    </div>
  );
}
