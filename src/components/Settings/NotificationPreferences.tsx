import React, { useState, useEffect } from 'react';
import styles from '../../styles/pages/PreferencesPage.module.css';
import styles from './NotificationPreferences.module.css';
import { usePushNotifications } from '../../hooks/usePushNotifications';

interface NotificationPreferencesProps {
  userId: string;
  preferences?: {
    emailNotifications: boolean;
    smsNotifications: boolean;
    smsEmergencyAlerts?: boolean;
    smsReminderAlerts?: boolean;
    pushNotifications: boolean;
    marketingEmails: boolean;
    activityEmails: boolean;
  };
  smsUsage?: { sent: number; delivered: number; costCents: number; limitCents: number | null };
  onSubmit: (data: any) => Promise<void>;
  isLoading?: boolean;
}

export const NotificationPreferences: React.FC<NotificationPreferencesProps> = ({
  userId,
  preferences,
  smsUsage,
  onSubmit,
  isLoading = false,
}) => {
  const [settings, setSettings] = useState({
    emailNotifications: true,
    smsNotifications: false,
    smsEmergencyAlerts: true,
    smsReminderAlerts: false,
    pushNotifications: false,
    marketingEmails: false,
    activityEmails: true,
  });

  const { requestPermission, disablePushNotifications, error: pushError } = usePushNotifications(userId);

  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (preferences) {
      setSettings((prev) => ({
        ...prev,
        ...preferences,
        smsEmergencyAlerts: preferences.smsEmergencyAlerts ?? true,
        smsReminderAlerts: preferences.smsReminderAlerts ?? false,
      }));
    }
  }, [preferences]);

  const handleToggle = async (key: keyof typeof settings) => {
    if (key === 'pushNotifications') {
      const isEnabling = !settings.pushNotifications;
      if (isEnabling) {
        const token = await requestPermission();
        if (!token) return; // Permission denied or error
      } else {
        await disablePushNotifications();
      }
    }

    setSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await onSubmit(settings);
      setSuccessMessage('Notification preferences saved successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Failed to save preferences', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>
      <form onSubmit={handleSubmit} className={styles.form}>
        <h2 className={styles.title}>Notification Preferences</h2>
        <p className={styles.description}>
          Choose how you want to receive notifications about your account and activities.
        </p>

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Email Notifications</h3>

          <div className={styles.preference}>
            <div className={styles.preferenceContent}>
              <div className={styles.preferenceName}>
                Essential Notifications
              </div>
              <p className={styles.preferenceDescription}>
                Receive important notifications about your account security and
                critical updates.
              </p>
            </div>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={settings.emailNotifications}
                onChange={() => handleToggle('emailNotifications')}
                disabled={isSubmitting || isLoading}
              />
              <span className={styles.toggleSlider} />
            </label>
          </div>

          <div className={styles.preference}>
            <div className={styles.preferenceContent}>
              <div className={styles.preferenceName}>Activity Updates</div>
              <p className={styles.preferenceDescription}>
                Get notified about account activity like logins and profile changes.
              </p>
            </div>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={settings.activityEmails}
                onChange={() => handleToggle('activityEmails')}
                disabled={isSubmitting || isLoading}
              />
              <span className={styles.toggleSlider} />
            </label>
          </div>

          <div className={styles.preference}>
            <div className={styles.preferenceContent}>
              <div className={styles.preferenceName}>
                Marketing & Promotional Emails
              </div>
              <p className={styles.preferenceDescription}>
                Receive emails about new features, tips, and promotional offers.
              </p>
            </div>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={settings.marketingEmails}
                onChange={() => handleToggle('marketingEmails')}
                disabled={isSubmitting || isLoading}
              />
              <span className={styles.toggleSlider} />
            </label>
          </div>
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>SMS Notifications</h3>

          <div className={styles.preference}>
            <div className={styles.preferenceContent}>
              <div className={styles.preferenceName}>Enable SMS</div>
              <p className={styles.preferenceDescription}>
                Receive important alerts via SMS when a phone number is set in your profile.
              </p>
            </div>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={settings.smsNotifications}
                onChange={() => handleToggle('smsNotifications')}
                disabled={isSubmitting || isLoading}
              />
              <span className={styles.toggleSlider} />
            </label>
          </div>

          {settings.smsNotifications && (
            <>
              <div className={styles.preference}>
                <div className={styles.preferenceContent}>
                  <div className={styles.preferenceName}>Emergency Alerts</div>
                  <p className={styles.preferenceDescription}>
                    Get SMS for critical emergencies (e.g. medical, lost pet).
                  </p>
                </div>
                <label className={styles.toggle}>
                  <input
                    type="checkbox"
                    checked={settings.smsEmergencyAlerts}
                    onChange={() => handleToggle('smsEmergencyAlerts')}
                    disabled={isSubmitting || isLoading}
                  />
                  <span className={styles.toggleSlider} />
                </label>
              </div>
              <div className={styles.preference}>
                <div className={styles.preferenceContent}>
                  <div className={styles.preferenceName}>Reminder Alerts</div>
                  <p className={styles.preferenceDescription}>
                    Get SMS for vaccination and care reminders.
                  </p>
                </div>
                <label className={styles.toggle}>
                  <input
                    type="checkbox"
                    checked={settings.smsReminderAlerts}
                    onChange={() => handleToggle('smsReminderAlerts')}
                    disabled={isSubmitting || isLoading}
                  />
                  <span className={styles.toggleSlider} />
                </label>
              </div>
            </>
          )}

          {smsUsage != null && settings.smsNotifications && (
            <p className={styles.preferenceDescription} style={{ marginTop: 8 }}>
              This month: {smsUsage.sent} sent, {smsUsage.delivered} delivered
              {smsUsage.limitCents != null && ` · Limit $${(smsUsage.limitCents / 100).toFixed(2)}`}
            </p>
          )}
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Other Notifications</h3>

          <div className={styles.preference}>
            <div className={styles.preferenceContent}>
              <div className={styles.preferenceName}>Push Notifications</div>
              <p className={styles.preferenceDescription}>
                Receive browser and mobile app push notifications.
              </p>
            </div>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={settings.pushNotifications}
                onChange={() => handleToggle('pushNotifications')}
                disabled={isSubmitting || isLoading}
              />
              <span className={styles.toggleSlider} />
            </label>
          </div>
        </div>

        {pushError && (
          <div className={styles.error}>{pushError}</div>
        )}

        {successMessage && (
          <div className={styles.success}>{successMessage}</div>
        )}

        <div className={styles.actions}>
          <button
            type="submit"
            className={styles.submitBtn}
            disabled={isSubmitting || isLoading}
          >
            {isSubmitting ? 'Saving...' : 'Save Preferences'}
          </button>
        </div>
      </form>
    </div>
  );
};
