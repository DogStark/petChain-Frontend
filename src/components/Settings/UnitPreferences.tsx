import React, { useState, useEffect } from 'react';

import { useUnitPreference, type UnitSystem } from '../../hooks/useUnitPreference';
import { useTranslation } from '../../i18n';
import styles from '../../styles/components/Settings.module.css';

export interface UnitPreferencesProps {
  onDirtyChange?: (isDirty: boolean) => void;
}

export function UnitPreferences({ onDirtyChange }: UnitPreferencesProps) {
  const { t } = useTranslation();
  const { system, source, setSystem, resetToLocale } = useUnitPreference();
  
  const [selectedSystem, setSelectedSystem] = useState<UnitSystem>(system);
  const [isDirty, setIsDirty] = useState(false);
  const [announcement, setAnnouncement] = useState<string>('');
  
  // Sync selected with actual when hook updates
  useEffect(() => {
    setSelectedSystem(system);
  }, [system]);
  
  // Track dirty state
  useEffect(() => {
    const dirty = selectedSystem !== system;
    setIsDirty(dirty);
    onDirtyChange?.(dirty);
  }, [selectedSystem, system, onDirtyChange]);
  
  const handleSystemChange = (newSystem: UnitSystem) => {
    setSelectedSystem(newSystem);
  };
  
  const handleSave = () => {
    setSystem(selectedSystem);
    setAnnouncement(t('settings.units.saved'));
    // Clear announcement after 3 seconds
    setTimeout(() => setAnnouncement(''), 3000);
  };
  
  const handleReset = () => {
    resetToLocale();
    setAnnouncement(t('settings.units.resetToLocale'));
    setTimeout(() => setAnnouncement(''), 3000);
  };
  
  const getLocaleDefault = (): UnitSystem => {
    if (typeof window === 'undefined') return 'metric';
    const locale = navigator.language || 'en-US';
    return locale.toLowerCase().startsWith('en-us') ? 'customary' : 'metric';
  };
  
  const localeDefault = getLocaleDefault();
  
  return (
    <div className={styles.section}>
      <h2>{t('settings.units.title')}</h2>
      <p className={styles.description}>{t('settings.units.description')}</p>
      
      {/* Unit system selection */}
      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>{t('settings.units.systemLabel')}</legend>
        
        <div className={styles.radioGroup}>
          <label className={styles.radioLabel}>
            <input
              type="radio"
              name="unitSystem"
              value="metric"
              checked={selectedSystem === 'metric'}
              onChange={() => handleSystemChange('metric')}
              className={styles.radio}
            />
            <span className={styles.radioText}>
              {t('settings.units.metric')}
              {localeDefault === 'metric' && (
                <span className={styles.badge}>{t('settings.units.localeDefault')}</span>
              )}
            </span>
            <span className={styles.radioDescription}>
              {t('settings.units.metricExamples')}
            </span>
          </label>
          
          <label className={styles.radioLabel}>
            <input
              type="radio"
              name="unitSystem"
              value="customary"
              checked={selectedSystem === 'customary'}
              onChange={() => handleSystemChange('customary')}
              className={styles.radio}
            />
            <span className={styles.radioText}>
              {t('settings.units.customary')}
              {localeDefault === 'customary' && (
                <span className={styles.badge}>{t('settings.units.localeDefault')}</span>
              )}
            </span>
            <span className={styles.radioDescription}>
              {t('settings.units.customaryExamples')}
            </span>
          </label>
        </div>
      </fieldset>
      
      {/* Source indicator */}
      <div className={styles.info}>
        {source === 'locale' ? (
          <p>{t('settings.units.usingLocaleDefault')}</p>
        ) : (
          <p>{t('settings.units.usingUserPreference')}</p>
        )}
      </div>
      
      {/* Explicit unit note */}
      <div className={styles.note}>
        <strong>{t('settings.units.explicitUnitNote.title')}</strong>
        <p>{t('settings.units.explicitUnitNote.description')}</p>
      </div>
      
      {/* Action buttons */}
      <div className={styles.actions}>
        <button
          type="button"
          onClick={handleSave}
          disabled={!isDirty}
          className={styles.primaryButton}
        >
          {t('settings.save')}
        </button>
        
        <button
          type="button"
          onClick={handleReset}
          disabled={source === 'locale'}
          className={styles.secondaryButton}
        >
          {t('settings.units.resetToLocale')}
        </button>
      </div>
      
      {/* Screen reader announcement */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={styles.srOnly}
      >
        {announcement}
      </div>
    </div>
  );
}
