'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';

type Channel = 'push' | 'email' | 'inApp';

type EventType =
  | 'careReminder'
  | 'appointmentReminder'
  | 'medicationReminder'
  | 'securityAlert';

interface EventDefinition {
  id: EventType;
  label: string;
  description: string;
  required?: boolean;
}

const EVENTS: EventDefinition[] = [
  {
    id: 'careReminder',
    label: 'Care reminders',
    description: 'Daily care tasks and routine reminders for this pet.',
  },
  {
    id: 'appointmentReminder',
    label: 'Appointment reminders',
    description: 'Upcoming vet visits and scheduled appointments.',
  },
  {
    id: 'medicationReminder',
    label: 'Medication reminders',
    description: 'Doses and treatment schedules for this pet.',
  },
  {
    id: 'securityAlert',
    label: 'Security alerts',
    description:
      'Account and pet security notifications. These are required and cannot be disabled.',
    required: true,
  },
];

const CHANNELS: { id: Channel; label: string }[] = [
  { id: 'push', label: 'Push' },
  { id: 'email', label: 'Email' },
  { id: 'inApp', label: 'In-app' },
];

type Preferences = Record<EventType, Record<Channel, boolean>>;

const EMPTY_PREFERENCES: Preferences = {
  careReminder: { push: false, email: false, inApp: false },
  appointmentReminder: { push: false, email: false, inApp: false },
  medicationReminder: { push: false, email: false, inApp: false },
  securityAlert: { push: true, email: true, inApp: true },
};

function normalizePreferences(raw: unknown): Preferences {
  const next: Preferences = {
    careReminder: { ...EMPTY_PREFERENCES.careReminder },
    appointmentReminder: { ...EMPTY_PREFERENCES.appointmentReminder },
    medicationReminder: { ...EMPTY_PREFERENCES.medicationReminder },
    securityAlert: { ...EMPTY_PREFERENCES.securityAlert },
  };

  if (!raw || typeof raw !== 'object') {
    return next;
  }

  const source = raw as Record<string, unknown>;
  for (const event of EVENTS) {
    const value = source[event.id];
    if (!value || typeof value !== 'object') {
      continue;
    }
    const channels = value as Record<string, unknown>;
    for (const channel of CHANNELS) {
      if (event.required) {
        next[event.id][channel.id] = true;
      } else if (typeof channels[channel.id] === 'boolean') {
        next[event.id][channel.id] = channels[channel.id] as boolean;
      }
    }
  }

  return next;
}

export default function PetNotificationsPage() {
  const params = useParams<{ id: string }>();
  const petId = params?.id;

  const [preferences, setPreferences] = useState<Preferences>(EMPTY_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!petId) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`${API_BASE}/api/pets/${encodeURIComponent(petId)}/notifications`, {
      credentials: 'include',
    })
      .then(async (res) => {
        if (res.status === 401 || res.status === 403) {
          throw new Error('You do not have access to these notification settings.');
        }
        if (!res.ok) {
          throw new Error('Unable to load notification settings.');
        }
        return res.json();
      })
      .then((data) => {
        if (!cancelled) {
          setPreferences(normalizePreferences(data?.preferences ?? data));
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [petId]);

  const toggle = useCallback(
    (event: EventDefinition, channel: Channel) => {
      if (event.required) {
        return;
      }
      setStatus(null);
      setPreferences((prev) => ({
        ...prev,
        [event.id]: {
          ...prev[event.id],
          [channel]: !prev[event.id][channel],
        },
      }));
    },
    [],
  );

  const save = useCallback(async () => {
    if (!petId) {
      return;
    }
    setSaving(true);
    setError(null);
    setStatus(null);

    try {
      const res = await fetch(
        `${API_BASE}/api/pets/${encodeURIComponent(petId)}/notifications`,
        {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ preferences }),
        },
      );

      if (res.status === 401 || res.status === 403) {
        throw new Error('You do not have permission to change these settings.');
      }
      if (!res.ok) {
        throw new Error('Unable to save notification settings.');
      }

      const data = await res.json().catch(() => null);
      if (data) {
        setPreferences(normalizePreferences(data?.preferences ?? data));
      }
      setStatus('Notification preferences saved.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }, [petId, preferences]);

  const heading = useMemo(
    () => (petId ? `Notification settings for pet ${petId}` : 'Notification settings'),
    [petId],
  );

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-semibold text-gray-900">{heading}</h1>
      <p className="mt-2 text-sm text-gray-600">
        Choose how you want to be notified for each event type. Channels are off by
        default unless you enable them.
      </p>

      {error && (
        <div
          role="alert"
          className="mt-4 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error}
        </div>
      )}

      {status && (
        <div
          role="status"
          aria-live="polite"
          className="mt-4 rounded-md border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800"
        >
          {status}
        </div>
      )}

      {loading ? (
        <p role="status" aria-live="polite" className="mt-6 text-sm text-gray-600">
          Loading notification settings…
        </p>
      ) : (
        <form
          className="mt-6 space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          {EVENTS.map((event) => (
            <fieldset
              key={event.id}
              className="rounded-lg border border-gray-200 p-4"
              aria-describedby={`${event.id}-description`}
            >
              <legend className="text-base font-medium text-gray-900">
                {event.label}
              </legend>
              <p id={`${event.id}-description`} className="mt-1 text-sm text-gray-600">
                {event.description}
              </p>

              {event.required && (
                <p
                  className="mt-2 inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700"
                  aria-hidden="false"
                >
                  <span aria-hidden="true">🔒</span>
                  Required security notification — cannot be disabled
                </p>
              )}

              <div className="mt-3 flex flex-wrap gap-4">
                {CHANNELS.map((channel) => {
                  const inputId = `${event.id}-${channel.id}`;
                  const checked = preferences[event.id][channel.id];
                  const disabled = Boolean(event.required);
                  return (
                    <div key={channel.id} className="flex items-center gap-2">
                      <input
                        id={inputId}
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                        checked={checked}
                        disabled={disabled}
                        aria-describedby={
                          disabled ? `${event.id}-required-note` : undefined
                        }
                        onChange={() => toggle(event, channel.id)}
                      />
                      <label htmlFor={inputId} className="text-sm text-gray-800">
                        {channel.label}
                      </label>
                    </div>
                  );
                })}
              </div>

              {event.required && (
                <span id={`${event.id}-required-note`} className="sr-only">
                  This channel is required for security notifications and cannot be
                  disabled.
                </span>
              )}
            </fieldset>
          ))}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save preferences'}
            </button>
          </div>
        </form>
      )}
    </main>
  );
}
