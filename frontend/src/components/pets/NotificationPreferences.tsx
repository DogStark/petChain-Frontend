import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { apiClient } from '../../lib/api/client';

export type NotificationChannel = 'push' | 'email' | 'inApp';

export type NotificationEventType =
  | 'careReminder'
  | 'appointmentReminder'
  | 'medicationReminder'
  | 'securityAlert';

export interface NotificationChannelPreference {
  push: boolean;
  email: boolean;
  inApp: boolean;
}

export type NotificationPreferencesMap = Record<
  NotificationEventType,
  NotificationChannelPreference
>;

export interface NotificationPreferencesResponse {
  petId: string;
  preferences: NotificationPreferencesMap;
  /** Event types the backend mandates; these cannot be disabled by the client. */
  requiredEventTypes: NotificationEventType[];
}

interface EventTypeDescriptor {
  id: NotificationEventType;
  label: string;
  description: string;
}

const EVENT_TYPES: EventTypeDescriptor[] = [
  {
    id: 'careReminder',
    label: 'Care reminders',
    description: 'Daily care and routine reminders for this pet.',
  },
  {
    id: 'appointmentReminder',
    label: 'Appointment reminders',
    description: 'Upcoming vet visits and grooming appointments.',
  },
  {
    id: 'medicationReminder',
    label: 'Medication reminders',
    description: 'Scheduled medication doses for this pet.',
  },
  {
    id: 'securityAlert',
    label: 'Security alerts',
    description: 'Account and pet security notifications.',
  },
];

const CHANNELS: { id: NotificationChannel; label: string }[] = [
  { id: 'push', label: 'Push' },
  { id: 'email', label: 'Email' },
  { id: 'inApp', label: 'In-app' },
];

const EMPTY_CHANNEL_PREFERENCE: NotificationChannelPreference = {
  push: false,
  email: false,
  inApp: false,
};

function buildPrivacyFirstDefaults(): NotificationPreferencesMap {
  return EVENT_TYPES.reduce((acc, event) => {
    acc[event.id] = { ...EMPTY_CHANNEL_PREFERENCE };
    return acc;
  }, {} as NotificationPreferencesMap);
}

function normalizePreferences(
  incoming: Partial<NotificationPreferencesMap> | undefined,
): NotificationPreferencesMap {
  const base = buildPrivacyFirstDefaults();
  if (!incoming) return base;
  for (const event of EVENT_TYPES) {
    const pref = incoming[event.id];
    if (!pref) continue;
    base[event.id] = {
      push: Boolean(pref.push),
      email: Boolean(pref.email),
      inApp: Boolean(pref.inApp),
    };
  }
  return base;
}

interface NotificationPreferencesProps {
  petId: string;
  petName?: string;
}

type LoadState = 'idle' | 'loading' | 'ready' | 'error' | 'denied';

export function NotificationPreferences({
  petId,
  petName,
}: NotificationPreferencesProps) {
  const headingId = useId();
  const statusId = useId();
  const [preferences, setPreferences] = useState<NotificationPreferencesMap>(
    buildPrivacyFirstDefaults,
  );
  const [requiredEventTypes, setRequiredEventTypes] = useState<
    NotificationEventType[]
  >([]);
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [savingEvent, setSavingEvent] = useState<NotificationEventType | null>(
    null,
  );
  const [statusMessage, setStatusMessage] = useState('');
  const statusRef = useRef<HTMLParagraphElement | null>(null);

  const requiredSet = useMemo(
    () => new Set<NotificationEventType>(requiredEventTypes),
    [requiredEventTypes],
  );

  useEffect(() => {
    let cancelled = false;
    setLoadState('loading');
    setStatusMessage('');

    apiClient
      .get<NotificationPreferencesResponse>(
        `/pets/${encodeURIComponent(petId)}/notification-preferences`,
      )
      .then((data) => {
        if (cancelled) return;
        setPreferences(normalizePreferences(data?.preferences));
        setRequiredEventTypes(
          Array.isArray(data?.requiredEventTypes)
            ? data.requiredEventTypes
            : [],
        );
        setLoadState('ready');
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const status = (error as { status?: number } | null)?.status;
        setPreferences(buildPrivacyFirstDefaults());
        setRequiredEventTypes([]);
        setLoadState(status === 403 || status === 401 ? 'denied' : 'error');
      });

    return () => {
      cancelled = true;
    };
  }, [petId]);

  const announce = useCallback((message: string) => {
    setStatusMessage(message);
  }, []);

  const handleToggle = useCallback(
    async (
      eventType: NotificationEventType,
      channel: NotificationChannel,
      nextChecked: boolean,
    ) => {
      if (requiredSet.has(eventType)) return;

      const previous = preferences[eventType] ?? EMPTY_CHANNEL_PREFERENCE;
      const optimistic: NotificationChannelPreference = {
        ...previous,
        [channel]: nextChecked,
      };

      setPreferences((current) => ({ ...current, [eventType]: optimistic }));
      setSavingEvent(eventType);

      try {
        const data = await apiClient.put<NotificationPreferencesResponse>(
          `/pets/${encodeURIComponent(petId)}/notification-preferences`,
          { eventType, channel, enabled: nextChecked },
        );
        setPreferences(normalizePreferences(data?.preferences));
        if (Array.isArray(data?.requiredEventTypes)) {
          setRequiredEventTypes(data.requiredEventTypes);
        }
        announce('Notification preference saved.');
      } catch (error: unknown) {
        setPreferences((current) => ({ ...current, [eventType]: previous }));
        const status = (error as { status?: number } | null)?.status;
        announce(
          status === 403
            ? 'You do not have permission to change this preference.'
            : 'Could not save the notification preference. Please try again.',
        );
      } finally {
        setSavingEvent(null);
      }
    },
    [announce, petId, preferences, requiredSet],
  );

  const isLoading = loadState === 'loading';
  const isDenied = loadState === 'denied';
  const isError = loadState === 'error';

  return (
    <section
      aria-labelledby={headingId}
      aria-describedby={statusId}
      className="rounded-lg border border-gray-200 p-4"
    >
      <h2 id={headingId} className="text-lg font-semibold">
        Notification preferences{petName ? ` for ${petName}` : ''}
      </h2>
      <p className="mt-1 text-sm text-gray-600">
        Choose how you want to be notified for each event. All channels are off
        by default.
      </p>

      <p
        id={statusId}
        ref={statusRef}
        role="status"
        aria-live="polite"
        className="mt-2 text-sm text-gray-700"
      >
        {statusMessage}
      </p>

      {isLoading && (
        <p className="mt-4 text-sm text-gray-600" role="status">
          Loading notification preferences…
        </p>
      )}

      {isDenied && (
        <p className="mt-4 text-sm text-red-700" role="alert">
          You do not have access to manage notification preferences for this
          pet.
        </p>
      )}

      {isError && (
        <p className="mt-4 text-sm text-red-700" role="alert">
          Notification preferences could not be loaded. Please try again later.
        </p>
      )}

      {!isLoading && !isDenied && !isError && (
        <div className="mt-4 space-y-6">
          {EVENT_TYPES.map((event) => {
            const isRequired = requiredSet.has(event.id);
            const pref =
              preferences[event.id] ?? EMPTY_CHANNEL_PREFERENCE;
            const isSaving = savingEvent === event.id;
            const groupLabelId = `${headingId}-${event.id}-label`;
            const groupDescId = `${headingId}-${event.id}-desc`;

            return (
              <fieldset
                key={event.id}
                aria-labelledby={groupLabelId}
                aria-describedby={groupDescId}
                disabled={isSaving}
                className="rounded-md border border-gray-100 p-3"
              >
                <legend id={groupLabelId} className="text-sm font-medium">
                  {event.label}
                </legend>
                <p id={groupDescId} className="text-xs text-gray-600">
                  {event.description}
                </p>

                {isRequired && (
                  <p className="mt-2 text-xs font-medium text-amber-700">
                    Required security notification — this cannot be disabled.
                  </p>
                )}

                <div className="mt-2 flex flex-wrap gap-4">
                  {CHANNELS.map((channel) => {
                    const inputId = `${headingId}-${event.id}-${channel.id}`;
                    const checked = isRequired
                      ? true
                      : Boolean(pref[channel.id]);
                    return (
                      <label
                        key={channel.id}
                        htmlFor={inputId}
                        className="inline-flex items-center gap-2 text-sm"
                      >
                        <input
                          id={inputId}
                          type="checkbox"
                          checked={checked}
                          disabled={isRequired || isSaving}
                          aria-describedby={
                            isRequired ? `${groupDescId} ${statusId}` : groupDescId
                          }
                          onChange={(e) =>
                            void handleToggle(
                              event.id,
                              channel.id,
                              e.target.checked,
                            )
                          }
                        />
                        <span>
                          {channel.label}
                          {isRequired ? ' (required)' : ''}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default NotificationPreferences;
