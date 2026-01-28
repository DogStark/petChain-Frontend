import React, { useState, useEffect } from 'react';
import styles from './NotificationPreferences.module.css';

interface NotificationPreferencesProps {
  preferences?: {
    emailNotifications: boolean;
    smsNotifications: boolean;
    pushNotifications: boolean;
    marketingEmails: boolean;
    activityEmails: boolean;
  };
  onSubmit: (data: any) => Promise<void>;
  isLoading?: boolean;
}

export const NotificationPreferences: React.FC<NotificationPreferencesProps> = ({
  preferences,
  onSubmit,
  isLoading = false,
}) => {
  const [settings, setSettings] = useState({
    emailNotifications: true,
    smsNotifications: false,
    pushNotifications: false,
    marketingEmails: false,
    activityEmails: true,
  });

  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (preferences) {
      setSettings(preferences);
    }
  }, [preferences]);

  const handleToggle = (key: keyof typeof settings) => {
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
          <h3 className={styles.sectionTitle}>Other Notifications</h3>

          <div className={styles.preference}>
            <div className={styles.preferenceContent}>
              <div className={styles.preferenceName}>SMS Notifications</div>
              <p className={styles.preferenceDescription}>
                Receive important alerts via SMS (if number is provided).
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
