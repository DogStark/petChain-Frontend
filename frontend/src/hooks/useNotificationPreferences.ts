import { useCallback, useEffect, useMemo, useState } from 'react';

export type NotificationChannel = 'push' | 'email' | 'inApp';

export type NotificationEventType =
  | 'careReminder'
  | 'appointmentReminder'
  | 'medicationReminder'
  | 'securityAlert';

export interface NotificationChannelPreferences {
  push: boolean;
  email: boolean;
  inApp: boolean;
}

export type PetNotificationPreferences = Record<
  NotificationEventType,
  NotificationChannelPreferences
>;

export interface NotificationPreferencesResponse {
  petId: string;
  preferences: PetNotificationPreferences;
  /** Event types the backend mandates and cannot be disabled by the client. */
  requiredEventTypes: NotificationEventType[];
}

export const NOTIFICATION_EVENT_TYPES: NotificationEventType[] = [
  'careReminder',
  'appointmentReminder',
  'medicationReminder',
  'securityAlert',
];

export const NOTIFICATION_CHANNELS: NotificationChannel[] = [
  'push',
  'email',
  'inApp',
];

const EMPTY_CHANNELS: NotificationChannelPreferences = {
  push: false,
  email: false,
  inApp: false,
};

/** Privacy by default: nothing enabled unless the backend says otherwise. */
export function buildDefaultPreferences(): PetNotificationPreferences {
  return NOTIFICATION_EVENT_TYPES.reduce((acc, eventType) => {
    acc[eventType] = { ...EMPTY_CHANNELS };
    return acc;
  }, {} as PetNotificationPreferences);
}

function normalizePreferences(
  incoming: Partial<PetNotificationPreferences> | undefined,
): PetNotificationPreferences {
  const base = buildDefaultPreferences();
  if (!incoming) return base;
  for (const eventType of NOTIFICATION_EVENT_TYPES) {
    const channels = incoming[eventType];
    if (!channels) continue;
    base[eventType] = {
      push: Boolean(channels.push),
      email: Boolean(channels.email),
      inApp: Boolean(channels.inApp),
    };
  }
  return base;
}

export interface UseNotificationPreferencesOptions {
  petId: string | null | undefined;
  /**
   * Fetches the current preferences for a pet. Authorization and consent
   * decisions are owned by the backend; this hook only reflects them.
   */
  fetchPreferences?: (
    petId: string,
  ) => Promise<NotificationPreferencesResponse>;
  /**
   * Persists the full preference set for a pet. The backend remains the
   * source of truth and may reject or override changes.
   */
  savePreferences?: (
    petId: string,
    preferences: PetNotificationPreferences,
  ) => Promise<NotificationPreferencesResponse>;
}

export interface UseNotificationPreferencesResult {
  preferences: PetNotificationPreferences;
  requiredEventTypes: NotificationEventType[];
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  isDenied: boolean;
  isRequired: (eventType: NotificationEventType) => boolean;
  setChannel: (
    eventType: NotificationEventType,
    channel: NotificationChannel,
    enabled: boolean,
  ) => void;
  save: () => Promise<void>;
  reload: () => Promise<void>;
}

export function useNotificationPreferences({
  petId,
  fetchPreferences,
  savePreferences,
}: UseNotificationPreferencesOptions): UseNotificationPreferencesResult {
  const [preferences, setPreferences] = useState<PetNotificationPreferences>(
    buildDefaultPreferences,
  );
  const [requiredEventTypes, setRequiredEventTypes] = useState<
    NotificationEventType[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDenied, setIsDenied] = useState(false);

  const applyResponse = useCallback((response: NotificationPreferencesResponse) => {
    setPreferences(normalizePreferences(response.preferences));
    setRequiredEventTypes(response.requiredEventTypes ?? []);
  }, []);

  const reload = useCallback(async () => {
    if (!petId || !fetchPreferences) {
      setPreferences(buildDefaultPreferences());
      setRequiredEventTypes([]);
      setIsDenied(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    setIsDenied(false);
    try {
      const response = await fetchPreferences(petId);
      applyResponse(response);
    } catch (err) {
      const status = (err as { status?: number } | null)?.status;
      if (status === 401 || status === 403) {
        setIsDenied(true);
        setPreferences(buildDefaultPreferences());
        setRequiredEventTypes([]);
      } else {
        setError('Unable to load notification preferences.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [petId, fetchPreferences, applyResponse]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const isRequired = useCallback(
    (eventType: NotificationEventType) =>
      requiredEventTypes.includes(eventType),
    [requiredEventTypes],
  );

  const setChannel = useCallback(
    (
      eventType: NotificationEventType,
      channel: NotificationChannel,
      enabled: boolean,
    ) => {
      setPreferences((prev) => {
        const current = prev[eventType] ?? { ...EMPTY_CHANNELS };
        return {
          ...prev,
          [eventType]: { ...current, [channel]: enabled },
        };
      });
    },
    [],
  );

  const save = useCallback(async () => {
    if (!petId || !savePreferences) return;
    setIsSaving(true);
    setError(null);
    try {
      const response = await savePreferences(petId, preferences);
      applyResponse(response);
    } catch (err) {
      const status = (err as { status?: number } | null)?.status;
      if (status === 401 || status === 403) {
        setIsDenied(true);
      } else {
        setError('Unable to save notification preferences.');
      }
    } finally {
      setIsSaving(false);
    }
  }, [petId, savePreferences, preferences, applyResponse]);

  return useMemo(
    () => ({
      preferences,
      requiredEventTypes,
      isLoading,
      isSaving,
      error,
      isDenied,
      isRequired,
      setChannel,
      save,
      reload,
    }),
    [
      preferences,
      requiredEventTypes,
      isLoading,
      isSaving,
      error,
      isDenied,
      isRequired,
      setChannel,
      save,
      reload,
    ],
  );
}
