import React, { useState, useEffect } from 'react';
import styles from './PrivacySettings.module.css';

interface SharingLink {
  id: string;
  label: string;
  createdAt: string;
  expiresAt?: string;
}

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
  sharingLinks?: SharingLink[];
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
    recordAccess: Record<string, boolean>;
    zkpPreferences: {
      allowVaccinationProof: boolean;
      allowDentalProof: boolean;
      allowLabProof: boolean;
    };
    emergencyAccess: {
      enabled: boolean;
      showVaccinations: boolean;
      showAllergies: boolean;
      showMedications: boolean;
    };
  }) => Promise<void>;
  onRevokeLink?: (id: string) => Promise<void>;
  onDirtyChange?: (isDirty: boolean) => void;
  isLoading?: boolean;
}

export const PrivacySettings: React.FC<PrivacySettingsProps> = ({
  settings,
  preferences,
  sharingLinks = [],
  onSubmit,
  onRevokeLink,
  onDirtyChange,
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

  // Per-record access control
  const [recordAccess, setRecordAccess] = useState({
    vaccinations: true,
    dental: true,
    labResults: true,
    surgeries: true,
    medications: true,
  });

  // ZKP proof preferences
  const [zkpPreferences, setZkpPreferences] = useState({
    allowVaccinationProof: true,
    allowDentalProof: false,
    allowLabProof: false,
  });

  // Emergency access settings
  const [emergencyAccess, setEmergencyAccess] = useState({
    enabled: true,
    showVaccinations: true,
    showAllergies: true,
    showMedications: true,
  });

  const [links, setLinks] = useState<SharingLink[]>(sharingLinks);
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [policyAcceptedAt, setPolicyAcceptedAt] = useState<string | null>(null);
  const [savedPrivacySettings, setSavedPrivacySettings] = useState(privacySettings);
  const [savedProfileSettings, setSavedProfileSettings] = useState(profileSettings);

  useEffect(() => {
    const localAccepted = localStorage.getItem('petchainPolicyAcceptedAt');
    if (localAccepted) setPolicyAcceptedAt(localAccepted);

    if (settings) {
      const newSettings = {
        showEmail: settings.showEmail ?? false,
        showPhone: settings.showPhone ?? false,
        showActivity: settings.showActivity ?? false,
      };
      setPrivacySettings(newSettings);
      setSavedPrivacySettings(newSettings);
    }
    if (preferences) {
      const newProfileSettings = {
        profilePublic: preferences.profilePublic ?? true,
        dataShareConsent: preferences.dataShareConsent ?? false,
        preferredLanguage: preferences.preferredLanguage ?? 'en',
        timezone: preferences.timezone ?? 'UTC',
      };
      setProfileSettings(newProfileSettings);
      setSavedProfileSettings(newProfileSettings);
    }
  }, [settings, preferences]);

  useEffect(() => {
    setLinks(sharingLinks);
  }, [sharingLinks]);

  useEffect(() => {
    const isDirty =
      JSON.stringify(privacySettings) !== JSON.stringify(savedPrivacySettings) ||
      JSON.stringify(profileSettings) !== JSON.stringify(savedProfileSettings);
    onDirtyChange?.(isDirty);
  }, [privacySettings, profileSettings, savedPrivacySettings, savedProfileSettings, onDirtyChange]);

  const toggle = <T extends Record<string, boolean>>(
    setter: React.Dispatch<React.SetStateAction<T>>,
    key: keyof T,
  ) => {
    setter((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSubmit({
        privacy: privacySettings,
        profile: profileSettings,
        recordAccess,
        zkpPreferences,
        emergencyAccess,
      });
      setSavedPrivacySettings(privacySettings);
      setSavedProfileSettings(profileSettings);
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

  const handleRevoke = async (id: string) => {
    if (!onRevokeLink) return;
    setRevokingId(id);
    try {
      await onRevokeLink(id);
      setLinks((prev) => prev.filter((l) => l.id !== id));
    } catch (error) {
      console.error('Failed to revoke link', error);
    } finally {
      setRevokingId(null);
    }
  };

  const disabled = isSubmitting || isLoading;

  return (
    <div className={styles.container}>
      <form onSubmit={handleSubmit} className={styles.form}>
        <h2 className={styles.title}>Privacy &amp; Data Settings</h2>
        <p className={styles.description}>
          Control what information is visible to others and how your data is used.
        </p>

        {/* ── Profile Visibility ── */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Profile Visibility</h3>
          <p className={styles.sectionDescription}>
            Manage what information other users can see on your profile.
          </p>

          {(
            [
              { key: 'showEmail', label: 'Show Email Address', desc: 'Allow other users to see your email address.' },
              { key: 'showPhone', label: 'Show Phone Number', desc: 'Allow other users to see your phone number.' },
              { key: 'showActivity', label: 'Show Activity Status', desc: 'Display your online status and last activity time.' },
            ] as const
          ).map(({ key, label, desc }) => (
            <div key={key} className={styles.setting}>
              <div className={styles.settingContent}>
                <div className={styles.settingName}>{label}</div>
                <p className={styles.settingDescription}>{desc}</p>
              </div>
              <label className={styles.toggle}>
                <input
                  type="checkbox"
                  checked={privacySettings[key]}
                  onChange={() => toggle(setPrivacySettings, key)}
                  disabled={disabled}
                />
                <span className={styles.toggleSlider} />
              </label>
            </div>
          ))}
        </div>

        {/* ── Account Privacy ── */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Account Privacy</h3>
          <div className={styles.setting}>
            <div className={styles.settingContent}>
              <div className={styles.settingName}>Public Profile</div>
              <p className={styles.settingDescription}>
                Make your profile publicly visible to anyone.
              </p>
            </div>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={profileSettings.profilePublic}
                onChange={() => toggle(setProfileSettings, 'profilePublic')}
                disabled={disabled}
              />
              <span className={styles.toggleSlider} />
            </label>
          </div>
        </div>

        {/* ── Per-Record Access Control ── */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Per-Record Access Control</h3>
          <p className={styles.sectionDescription}>
            Choose which medical record types are accessible to vets and shared contacts.
          </p>
          {(
            [
              { key: 'vaccinations', label: 'Vaccination Records' },
              { key: 'dental', label: 'Dental Records' },
              { key: 'labResults', label: 'Lab Results' },
              { key: 'surgeries', label: 'Surgery Records' },
              { key: 'medications', label: 'Medications' },
            ] as const
          ).map(({ key, label }) => (
            <div key={key} className={styles.setting}>
              <div className={styles.settingContent}>
                <div className={styles.settingName}>{label}</div>
              </div>
              <label className={styles.toggle}>
                <input
                  type="checkbox"
                  checked={recordAccess[key]}
                  onChange={() => toggle(setRecordAccess, key)}
                  disabled={disabled}
                />
                <span className={styles.toggleSlider} />
              </label>
            </div>
          ))}
        </div>

        {/* ── ZKP Proof Preferences ── */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>ZKP Proof Preferences</h3>
          <div className={styles.infoBox}>
            <svg className={styles.infoIcon} fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
            <div>
              <p className={styles.infoTitle}>Zero-Knowledge Proofs</p>
              <p className={styles.infoText}>
                ZKPs let you prove facts about your pet&apos;s records without revealing the full data.
                Enable only the proofs you want to share.
              </p>
            </div>
          </div>
          {(
            [
              { key: 'allowVaccinationProof', label: 'Allow Vaccination Status Proof' },
              { key: 'allowDentalProof', label: 'Allow Dental Health Proof' },
              { key: 'allowLabProof', label: 'Allow Lab Results Proof' },
            ] as const
          ).map(({ key, label }) => (
            <div key={key} className={styles.setting}>
              <div className={styles.settingContent}>
                <div className={styles.settingName}>{label}</div>
              </div>
              <label className={styles.toggle}>
                <input
                  type="checkbox"
                  checked={zkpPreferences[key]}
                  onChange={() => toggle(setZkpPreferences, key)}
                  disabled={disabled}
                />
                <span className={styles.toggleSlider} />
              </label>
            </div>
          ))}
        </div>

        {/* ── Emergency Access ── */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Emergency Access</h3>
          <p className={styles.sectionDescription}>
            Control what first responders can see when scanning your pet&apos;s emergency QR code.
          </p>
          <div className={styles.setting}>
            <div className={styles.settingContent}>
              <div className={styles.settingName}>Enable Emergency Access</div>
              <p className={styles.settingDescription}>
                Allow first responders to view critical pet info without authentication.
              </p>
            </div>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={emergencyAccess.enabled}
                onChange={() => toggle(setEmergencyAccess, 'enabled')}
                disabled={disabled}
              />
              <span className={styles.toggleSlider} />
            </label>
          </div>
          {emergencyAccess.enabled && (
            <>
              {(
                [
                  { key: 'showVaccinations', label: 'Show Vaccination Status' },
                  { key: 'showAllergies', label: 'Show Allergies' },
                  { key: 'showMedications', label: 'Show Current Medications' },
                ] as const
              ).map(({ key, label }) => (
                <div key={key} className={styles.setting}>
                  <div className={styles.settingContent}>
                    <div className={styles.settingName}>{label}</div>
                  </div>
                  <label className={styles.toggle}>
                    <input
                      type="checkbox"
                      checked={emergencyAccess[key]}
                      onChange={() => toggle(setEmergencyAccess, key)}
                      disabled={disabled}
                    />
                    <span className={styles.toggleSlider} />
                  </label>
                </div>
              ))}
            </>
          )}
        </div>

        {/* ── Active Sharing Links ── */}
        {(links.length > 0 || onRevokeLink) && (
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Active Sharing Links</h3>
            <p className={styles.sectionDescription}>
              Manage links you&apos;ve shared with vets or other contacts. Revoke access at any time.
            </p>
            {links.length === 0 ? (
              <p className={styles.settingDescription}>No active sharing links.</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {links.map((link) => (
                  <li key={link.id} className={styles.setting} style={{ flexWrap: 'wrap', gap: 8 }}>
                    <div className={styles.settingContent}>
                      <div className={styles.settingName}>{link.label}</div>
                      <p className={styles.settingDescription}>
                        Created: {new Date(link.createdAt).toLocaleDateString()}
                        {link.expiresAt && ` · Expires: ${new Date(link.expiresAt).toLocaleDateString()}`}
                      </p>
                    </div>
                    {onRevokeLink && (
                      <button
                        type="button"
                        onClick={() => handleRevoke(link.id)}
                        disabled={revokingId === link.id || disabled}
                        style={{
                          padding: '6px 14px',
                          background: '#fee2e2',
                          color: '#dc2626',
                          border: '1px solid #fca5a5',
                          borderRadius: 6,
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: 'pointer',
                          flexShrink: 0,
                        }}
                      >
                        {revokingId === link.id ? 'Revoking…' : 'Revoke'}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* ── Data Sharing ── */}
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
                Your data is used to improve our service. We never sell your data to third parties.
              </p>
            </div>
          </div>
          <div className={styles.setting}>
            <div className={styles.settingContent}>
              <div className={styles.settingName}>Share Data for Analytics</div>
              <p className={styles.settingDescription}>
                Help us improve by sharing anonymized usage data.
              </p>
            </div>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={profileSettings.dataShareConsent}
                onChange={() => toggle(setProfileSettings, 'dataShareConsent')}
                disabled={disabled}
              />
              <span className={styles.toggleSlider} />
            </label>
          </div>
          <div className={styles.sectionSummary}>
            <p>
              GDPR / CCPA consent:
              <strong>{profileSettings.dataShareConsent ? ' Granted' : ' Not granted'}</strong>
            </p>
            {policyAcceptedAt && (
              <p>Last policy acceptance: {new Date(policyAcceptedAt).toLocaleString()}</p>
            )}
          </div>
        </div>

        {/* ── Regional Settings ── */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Regional Settings</h3>
          <div className={styles.fieldGroup}>
            <label htmlFor="preferredLanguage" className={styles.fieldLabel}>
              Language Preference
            </label>
            <select
              id="preferredLanguage"
              className={styles.select}
              value={profileSettings.preferredLanguage}
              onChange={(e) =>
                setProfileSettings((prev) => ({ ...prev, preferredLanguage: e.target.value }))
              }
              disabled={disabled}
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
              onChange={(e) =>
                setProfileSettings((prev) => ({ ...prev, timezone: e.target.value }))
              }
              disabled={disabled}
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
          <button type="submit" className={styles.submitBtn} disabled={disabled}>
            {isSubmitting ? 'Saving…' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
};
