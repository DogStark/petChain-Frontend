import React, { useState, useEffect } from 'react';
import styles from './PrivacySettings.module.css';

interface PrivacySettingsProps {
  settings?: {
    showEmail?: boolean;
    showPhone?: boolean;
    showActivity?: boolean;
  };
  preferences?: {
    profilePublic?: boolean;
    dataShareConsent?: boolean;
  };
  onSubmit: (data: any) => Promise<void>;
  isLoading?: boolean;
}

export const PrivacySettings: React.FC<PrivacySettingsProps> = ({
  settings,
  preferences,
  onSubmit,
  isLoading = false,
}) => {
  const [privacySettings, setPrivacySettings] = useState({
    showEmail: false,
    showPhone: false,
    showActivity: false,
  });

  const [profileSettings, setProfileSettings] = useState({
    profilePublic: true,
    dataShareConsent: false,
  });

  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (settings) {
      setPrivacySettings(settings);
    }
    if (preferences) {
      setProfileSettings({
        profilePublic: preferences.profilePublic ?? true,
        dataShareConsent: preferences.dataShareConsent ?? false,
      });
    }
  }, [settings, preferences]);

  const handlePrivacyToggle = (key: keyof typeof privacySettings) => {
    setPrivacySettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleProfileToggle = (key: keyof typeof profileSettings) => {
    setProfileSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await onSubmit({
        privacy: privacySettings,
        profile: profileSettings,
      });
      setSuccessMessage('Privacy settings saved successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Failed to save privacy settings', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>
      <form onSubmit={handleSubmit} className={styles.form}>
        <h2 className={styles.title}>Privacy & Data Settings</h2>
        <p className={styles.description}>
          Control what information is visible to others and how your data is used.
        </p>

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Profile Visibility</h3>
          <p className={styles.sectionDescription}>
            Manage what information other users can see on your profile.
          </p>

          <div className={styles.setting}>
            <div className={styles.settingContent}>
              <div className={styles.settingName}>Show Email Address</div>
              <p className={styles.settingDescription}>
                Allow other users to see your email address on your profile.
              </p>
            </div>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={privacySettings.showEmail}
                onChange={() => handlePrivacyToggle('showEmail')}
                disabled={isSubmitting || isLoading}
              />
              <span className={styles.toggleSlider} />
            </label>
          </div>

          <div className={styles.setting}>
            <div className={styles.settingContent}>
              <div className={styles.settingName}>Show Phone Number</div>
              <p className={styles.settingDescription}>
                Allow other users to see your phone number on your profile.
              </p>
            </div>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={privacySettings.showPhone}
                onChange={() => handlePrivacyToggle('showPhone')}
                disabled={isSubmitting || isLoading}
              />
              <span className={styles.toggleSlider} />
            </label>
          </div>

          <div className={styles.setting}>
            <div className={styles.settingContent}>
              <div className={styles.settingName}>Show Activity Status</div>
              <p className={styles.settingDescription}>
                Display your online status and last activity time to other users.
              </p>
            </div>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={privacySettings.showActivity}
                onChange={() => handlePrivacyToggle('showActivity')}
                disabled={isSubmitting || isLoading}
              />
              <span className={styles.toggleSlider} />
            </label>
          </div>
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Account Privacy</h3>

          <div className={styles.setting}>
            <div className={styles.settingContent}>
              <div className={styles.settingName}>Public Profile</div>
              <p className={styles.settingDescription}>
                Make your profile publicly visible to anyone. When disabled, only
                authenticated users can view your profile.
              </p>
            </div>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={profileSettings.profilePublic}
                onChange={() => handleProfileToggle('profilePublic')}
                disabled={isSubmitting || isLoading}
              />
              <span className={styles.toggleSlider} />
            </label>
          </div>
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Data Sharing</h3>

          <div className={styles.infoBox}>
            <svg className={styles.infoIcon} fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <div>
              <p className={styles.infoTitle}>Data Usage</p>
              <p className={styles.infoText}>
                Your data is used to improve our service and personalize your
                experience. We never sell your data to third parties.
              </p>
            </div>
          </div>

          <div className={styles.setting}>
            <div className={styles.settingContent}>
              <div className={styles.settingName}>Share Data for Analytics</div>
              <p className={styles.settingDescription}>
                Help us improve our service by sharing anonymized usage data and
                analytics.
              </p>
            </div>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={profileSettings.dataShareConsent}
                onChange={() => handleProfileToggle('dataShareConsent')}
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
            {isSubmitting ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
};
