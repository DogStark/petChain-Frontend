import { useId } from 'react';
import { useOfflineRetention } from '../hooks/useOfflineRetention';
import {
  DELETED_LOCAL_DATA,
  NOT_DELETED_LOCAL_DATA,
  RETENTION_OPTIONS,
  describeRetention,
} from '../lib/offlineRetention';

export interface OfflineRetentionSettingsProps {
  endpoint?: string;
  fetchImpl?: typeof fetch;
}

export function OfflineRetentionSettings({ endpoint, fetchImpl }: OfflineRetentionSettingsProps) {
  const { policy, allowed, loading, saving, error, save, reload } = useOfflineRetention({
    endpoint,
    fetchImpl,
  });
  const groupId = useId('offline-retention-group');
  const headingId = useId('offline-retention-heading');
  const descriptionId = useId('offline-retention-description');

  const selectedId = policy?.id ?? '';

  if (loading) {
    return (
      <section aria-labelledby={headingId} className="offline-retention-settings">
        <h2 id={headingId}>Offline data retention</h2>
        <p role="status">Loading offline retention settings…</p>
      </section>
    );
  }

  if (!allowed) {
    return (
      <section aria-labelledby={headingId} className="offline-retention-settings">
        <h2 id={headingId}>Offline data retention</h2>
        <p role="alert">
          {error ?? 'You do not have permission to manage offline retention.'}
        </p>
        <button type="button" onClick={() => void reload()}>
          Retry
        </button>
      </section>
    );
  }

  return (
    <section
      aria-labelledby={headingId}
      aria-describedby={descriptionId}
      className="offline-retention-settings"
    >
      <h2 id={headingId}>Offline data retention</h2>
      <p id={descriptionId}>
        Choose how long cached medical records stay on this device. Shorter periods
        reduce privacy risk if this device is shared or lost.
      </p>

      <fieldset aria-describedby={descriptionId} disabled={saving}>
        <legend>Retention period</legend>
        <div role="radiogroup" aria-labelledby={headingId} id={groupId}>
          {RETENTION_OPTIONS.map((option) => {
            const inputId = `${groupId}-${option.id}`;
            const descId = `${inputId}-desc`;
            return (
              <div key={option.id} className="offline-retention-option">
                <input
                  type="radio"
                  id={inputId}
                  name={groupId}
                  value={option.id}
                  checked={selectedId === option.id}
                  onChange={() => void save(option.id)}
                  aria-describedby={descId}
                />
                <label htmlFor={inputId}>{option.label}</label>
                <p id={descId}>{option.description}</p>
              </div>
            );
          })}
        </div>
      </fieldset>

      <p className="offline-retention-summary">{describeRetention(policy)}</p>

      <details>
        <summary>What local data is deleted?</summary>
        <p>When the retention period expires, the following data is deleted from this device:</p>
        <ul>
          {DELETED_LOCAL_DATA.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p>The following data is not deleted:</p>
        <ul>
          {NOT_DELETED_LOCAL_DATA.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </details>

      <div role="status" aria-live="polite">
        {saving ? 'Saving retention setting…' : ''}
      </div>
      {error ? (
        <p role="alert">{error}</p>
      ) : null}
    </section>
  );
}

export default OfflineRetentionSettings;
