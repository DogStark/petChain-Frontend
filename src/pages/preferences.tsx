import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { NotificationPreferences } from '../components/Settings/NotificationPreferences';
import { PrivacySettings } from '../components/Settings/PrivacySettings';
import { userAPI, UpdateUserPreferencesDto, UserProfile } from '../lib/api/userAPI';
import styles from '../styles/pages/PreferencesPage.module.css';

export default function PreferencesPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'notifications' | 'privacy'>(
    'notifications',
  );
  const [notificationPrefs, setNotificationPrefs] = useState(null);
  const [smsUsage, setSmsUsage] = useState<{
    sent: number;
    delivered: number;
    costCents: number;
    limitCents: number | null;
  } | null>(null);
  const [privacyPrefs, setPrivacyPrefs] = useState(null);
  const [preferences, setPreferences] = useState(null);
  const [notificationPrefs, setNotificationPrefs] = useState<any>(null);
  const [privacyPrefs, setPrivacyPrefs] = useState<any>(null);
  const [preferences, setPreferences] = useState<UpdateUserPreferencesDto | null>(
    null,
  );
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const [prefs, usage] = await Promise.all([
          userAPI.getPreferences(),
          userAPI.getSMSUsage().catch(() => null),
        const [prefs, userProfile] = await Promise.all([
          userAPI.getPreferences(),
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
        setPrivacyPrefs(prefs.privacySettings || {});
      } catch (err: any) {
        setError(err.message || 'Failed to load preferences');
        if (err.response?.status === 401) {
          router.push('/login');
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadPreferences();
  }, [router]);

  const handleNotificationPreferencesSubmit = async (data: any) => {
    try {
      setIsLoading(true);
      const updated = await userAPI.updateNotificationPreferences(data);
      setNotificationPrefs(updated);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to update preferences');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrivacySettingsSubmit = async (data: any) => {
    try {
      setIsLoading(true);
      // Update both privacy and profile settings
      if (data.privacy) {
        await userAPI.updatePrivacySettings(data.privacy);
      }
      if (data.profile) {
        const profileUpdate: any = {};
        if (data.profile.profilePublic !== undefined) {
          profileUpdate.profilePublic = data.profile.profilePublic;
        }
        if (data.profile.dataShareConsent !== undefined) {
          profileUpdate.dataShareConsent = data.profile.dataShareConsent;
        }
        if (Object.keys(profileUpdate).length > 0) {
          await userAPI.updatePreferences(profileUpdate);
        }
      }
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to update settings');
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
          className={`${styles.tab} ${
            activeTab === 'notifications' ? styles.activeTab : ''
          }`}
          onClick={() => setActiveTab('notifications')}
        >
          Notifications
        </button>
        <button
          className={`${styles.tab} ${
            activeTab === 'privacy' ? styles.activeTab : ''
          }`}
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
            }}
            onSubmit={handlePrivacySettingsSubmit}
            isLoading={isLoading}
          />
        )}
      </div>
    </div>
  );
}
