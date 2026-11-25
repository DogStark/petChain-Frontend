import React, { useState, useEffect } from 'react';
import styles from './NotificationPreferences.module.css';
import { useQuietHours } from '@/hooks/useQuietHours';

export type NotificationLanguage =
  | 'en'
  | 'es'
  | 'fr'
  | 'de'
  | 'pt'
  | 'it'
  | 'nl'
  | 'ja'
  | 'zh'
  | 'ko';

export const NOTIFICATION_LANGUAGES: { code: NotificationLanguage; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'pt', label: 'Português' },
  { code: 'it', label: 'Italiano' },
  { code: 'nl', label: 'Nederlands' },
  { code: 'ja', label: '日本語' },
  { code: 'zh', label: '中文' },
  { code: 'ko', label: '한국어' },
];

const EMAIL_PREVIEW_SUBJECTS: Record<NotificationLanguage, string> = {
  en: 'Your account activity summary',
  es: 'Resumen de actividad de tu cuenta',
  fr: "Résumé de l'activité de votre compte",
  de: 'Zusammenfassung Ihrer Kontoaktivität',
  pt: 'Resumo da atividade da sua conta',
  it: 'Riepilogo delle attività del tuo account',
  nl: 'Overzicht van uw accountactiviteit',
  ja: 'アカウントアクティビティの概要',
  zh: '您的账户活动摘要',
  ko: '계정 활동 요약',
};

const EMAIL_PREVIEW_BODIES: Record<NotificationLanguage, string> = {
  en: 'Hi there, here is a summary of recent activity on your account.',
  es: 'Hola, aquí tienes un resumen de la actividad reciente de tu cuenta.',
  fr: 'Bonjour, voici un résumé de l’activité récente de votre compte.',
  de: 'Hallo, hier ist eine Zusammenfassung der letzten Aktivitäten Ihres Kontos.',
  pt: 'Olá, aqui está um resumo da atividade recente da sua conta.',
  it: 'Ciao, ecco un riepilogo delle attività recenti del tuo account.',
  nl: 'Hallo, hier is een overzicht van de recente activiteit op uw account.',
  ja: 'こんにちは。アカウントの最近のアクティビティの概要です。',
  zh: '您好，这是您账户近期活动的摘要。',
  ko: '안녕하세요. 계정의 최근 활동 요약입니다.',
};

type NotificationSettings = {
  emailNotifications: boolean;
  smsNotifications: boolean;
  smsEmergencyAlerts: boolean;
  smsReminderAlerts: boolean;
  pushNotifications: boolean;
  marketingEmails: boolean;
  activityEmails: boolean;
  emailLanguage: NotificationLanguage;
};

interface NotificationPreferencesProps {
  userId: string;
  preferences?: Partial<NotificationSettings>;
  smsUsage?: { sent: number; delivered: number; costCents: number; limitCents: number | null };
  onSubmit: (data: NotificationSettings) => Promise<void>;
  onDirtyChange?: (isDirty: boolean) => void;
  isLoading?: boolean;
}

export const NotificationPreferences: React.FC<NotificationPreferencesProps> = ({
  userId: _userId,
  preferences,
  smsUsage,
  onSubmit,
  onDirtyChange,
  isLoading = false,
}) => {
  const { config: quietHours, update: updateQuietHours, isActive: quietActive } = useQuietHours();

  const [settings, setSettings] = useState<NotificationSettings>({
    emailNotifications: true,
    smsNotifications: false,
    smsEmergencyAlerts: true,
    smsReminderAlerts: false,
    pushNotifications: false,
    marketingEmails: false,
    activityEmails: true,
    emailLanguage: 'en',
  });

  const [savedSettings, setSavedSettings] = useState<NotificationSettings | null>(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (preferences) {
      const newSettings = {
        emailNotifications: preferences.emailNotifications ?? true,
        smsNotifications: preferences.smsNotifications ?? false,
        smsEmergencyAlerts: preferences.smsEmergencyAlerts ?? true,
        smsReminderAlerts: preferences.smsReminderAlerts ?? false,
        pushNotifications: preferences.pushNotifications ?? false,
        marketingEmails: preferences.marketingEmails ?? false,
        activityEmails: preferences.activityEmails ?? true,
        emailLanguage: preferences.emailLanguage ?? 'en',
      };
      setSettings(newSettings);
      setSavedSettings(newSettings);
    }
  }, [preferences]);

  useEffect(() => {
    if (savedSettings) {
      const isDirty = JSON.stringify(settings) !== JSON.stringify(savedSettings);
      onDirtyChange?.(isDirty);
    }
  }, [settings, savedSettings, onDirtyChange]);

  const handleToggle = async (key: keyof typeof settings) => {
    setSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSettings((prev) => ({
      ...prev,
      emailLanguage: e.target.value as NotificationLanguage,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await onSubmit(settings);
      setSavedSettings(settings);
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
              <div className={styles.preferenceName}>Essential Notifications</div>
              <p className={styles.preferenceDescription}>
                Receive important notifications about your account security and critical updates.
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
              <div className={styles.preferenceName}>Marketing & Promotional Emails</div>
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

          <div className={styles.preference}>
            <div className={styles.preferenceContent}>
              <div className={styles.preferenceName}>Email Language</div>
              <p className={styles.preferenceDescription}>
                Choose the language used for your email notifications.
              </p>
            </div>
            <select
              className={styles.languageSelect}
              value={settings.emailLanguage}
              onChange={handleLanguageChange}
              disabled={isSubmitting || isLoading}
              aria-label="Email notification language"
            >
              {NOTIFICATION_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.label}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.emailPreview} aria-live="polite">
            <div className={styles.emailPreviewLabel}>Email Preview</div>
            <div className={styles.emailPreviewSubject}>
              {EMAIL_PREVIEW_SUBJECTS[settings.emailLanguage]}
            </div>
            <p className={styles.emailPreviewBody}>
              {EMAIL_PREVIEW_BODIES[settings.emailLanguage]}
            </p>
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
        </div>

        {/* ── Quiet Hours ── */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Quiet Hours</h3>

          <div className={styles.preference}>
            <div className={styles.preferenceContent}>
              <div className={styles.preferenceName}>Enable Quiet Hours</div>
              <p className={styles.preferenceDescription}>
                Suppress push notifications during a chosen time range.
                {quietActive && (
                  <span className="ml-2 text-amber-600 font-semibold text-xs">(Active now)</span>
                )}
              </p>
            </div>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={quietHours.enabled}
                onChange={(e) => updateQuietHours({ enabled: e.target.checked })}
              />
              <span className={styles.toggleSlider} />
            </label>
          </div>

          {quietHours.enabled && (
            <div className="mt-4 space-y-4 pl-2">
              <div className="flex flex-col sm:flex-row gap-4">
                <label className="flex flex-col gap-1 flex-1">
                  <span className="text-xs font-semibold text-gray-600">Start time</span>
                  <input
                    type="time"
                    value={quietHours.startTime}
                    onChange={(e) => updateQuietHours({ startTime: e.target.value })}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </label>
                <label className="flex flex-col gap-1 flex-1">
                  <span className="text-xs font-semibold text-gray-600">End time</span>
                  <input
                    type="time"
                    value={quietHours.endTime}
                    onChange={(e) => updateQuietHours({ endTime: e.target.value })}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </label>
              </div>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-gray-600">Timezone</span>
                <input
                  type="text"
                  value={quietHours.timezone}
                  onChange={(e) => updateQuietHours({ timezone: e.target.value })}
                  placeholder="e.g. America/New_York"
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-xs text-gray-400">IANA timezone (auto-detected from your device)</span>
              </label>

              <div className={styles.preference}>
                <div className={styles.preferenceContent}>
                  <div className={styles.preferenceName}>Allow urgent alerts</div>
                  <p className={styles.preferenceDescription}>
                    Urgent notifications (emergencies, critical health alerts) bypass quiet hours.
                  </p>
                </div>
                <label className={styles.toggle}>
                  <input
                    type="checkbox"
                    checked={quietHours.allowUrgent}
                    onChange={(e) => updateQuietHours({ allowUrgent: e.target.checked })}
                  />
                  <span className={styles.toggleSlider} />
                </label>
              </div>
            </div>
          )}
        </div>

        {successMessage && <div className={styles.successMessage}>{successMessage}</div>}

        <button
          type="submit"
          className={styles.submitButton}
          disabled={isSubmitting || isLoading}
        >
          {isSubmitting ? 'Saving...' : 'Save Preferences'}
        </button>
      </form>
    </div>
  );
};
