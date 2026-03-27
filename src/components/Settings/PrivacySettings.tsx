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
    preferredLanguage?: string | null;
    timezone?: string | null;
  };
  onSubmit: (data: {
    privacy: {
      showEmail: boolean;
      showPhone: boolean;
      showActivity: boolean;
    };
    profile: {
      profilePublic: boolean;
      dataShareConsent: boolean;
      preferredLanguage: string;
      timezone: string;
    };
  }) => Promise<void>;
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
    preferredLanguage: 'en',
    timezone: 'UTC',
  });

  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [policyAcceptedAt, setPolicyAcceptedAt] = useState<string | null>(null);

  useEffect(() => {
    const localAccepted = localStorage.getItem('petchainPolicyAcceptedAt');
    if (localAccepted) {
      setPolicyAcceptedAt(localAccepted);
    }
    if (settings) {
      setPrivacySettings({
        showEmail: settings.showEmail ?? false,
        showPhone: settings.showPhone ?? false,
        showActivity: settings.showActivity ?? false,
      });
    }
    if (preferences) {
      setProfileSettings({
        profilePublic: preferences.profilePublic ?? true,
        dataShareConsent: preferences.dataShareConsent ?? false,
        preferredLanguage: preferences.preferredLanguage ?? 'en',
        timezone: preferences.timezone ?? 'UTC',
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
      [key]: typeof prev[key] === 'boolean' ? !prev[key] : prev[key],
    }));
  };

  const handleProfileSelectChange = (key: 'preferredLanguage' | 'timezone', value: string) => {
    setProfileSettings((prev) => ({
      ...prev,
      [key]: value,
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
      if (profileSettings.dataShareConsent) {
        const acceptedAt = new Date().toISOString();
        localStorage.setItem('petchainPolicyAcceptedAt', acceptedAt);
        setPolicyAcceptedAt(acceptedAt);
      }
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
                Make your profile publicly visible to anyone. When disabled, only authenticated
                users can view your profile.
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
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
            <div>
              <p className={styles.infoTitle}>Data Usage</p>
              <p className={styles.infoText}>
                Your data is used to improve our service and personalize your experience. We never
                sell your data to third parties.
              </p>
            </div>
          </div>

          <div className={styles.setting}>
            <div className={styles.settingContent}>
              <div className={styles.settingName}>Share Data for Analytics</div>
              <p className={styles.settingDescription}>
                Help us improve our service by sharing anonymized usage data and analytics.
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

          <div className={styles.sectionSummary}>
            <p>
              GDPR / CCPA consent status:
              <strong>{profileSettings.dataShareConsent ? ' Granted' : ' Not granted'}</strong>
            </p>
            {policyAcceptedAt && (
              <p>Last policy acceptance: {new Date(policyAcceptedAt).toLocaleString()}</p>
            )}
          </div>
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Regional Settings</h3>
          <p className={styles.sectionDescription}>
            Choose how PetChain personalizes language and time-based reminders for your account.
          </p>

          <div className={styles.fieldGroup}>
            <label htmlFor="preferredLanguage" className={styles.fieldLabel}>
              Language Preference
            </label>
            <select
              id="preferredLanguage"
              className={styles.select}
              value={profileSettings.preferredLanguage}
              onChange={(event) =>
                handleProfileSelectChange('preferredLanguage', event.target.value)
              }
              disabled={isSubmitting || isLoading}
            >
              <option value="en">English</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="de">German</option>
              <option value="pt">Portuguese</option>
            </select>
          </div>

          <div className={styles.fieldGroup}>
            <label htmlFor="timezone" className={styles.fieldLabel}>
              Timezone
            </label>
            <select
              id="timezone"
              className={styles.select}
              value={profileSettings.timezone}
              onChange={(event) => handleProfileSelectChange('timezone', event.target.value)}
              disabled={isSubmitting || isLoading}
            >
              <option value="UTC">UTC</option>
              <option value="Africa/Lagos">Africa/Lagos</option>
              <option value="America/New_York">America/New_York</option>
              <option value="America/Chicago">America/Chicago</option>
              <option value="America/Los_Angeles">America/Los_Angeles</option>
              <option value="Europe/London">Europe/London</option>
            </select>
          </div>
        </div>

        {successMessage && <div className={styles.success}>{successMessage}</div>}

        <div className={styles.actions}>
          <button type="submit" className={styles.submitBtn} disabled={isSubmitting || isLoading}>
            {isSubmitting ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
};
