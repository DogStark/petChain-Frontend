import { apiRequest } from './client';

export type NotificationChannel = 'push' | 'email' | 'in_app';

export type NotificationEventType =
  | 'care_reminder'
  | 'appointment'
  | 'medication'
  | 'security';

export interface NotificationChannelPreference {
  channel: NotificationChannel;
  enabled: boolean;
  /** Backend-owned: true when this channel cannot be disabled for this event. */
  locked: boolean;
  /** Backend-owned reason shown to the user when locked (e.g. security notice). */
  lockedReason?: string;
}

export interface PetNotificationPreference {
  petId: string;
  eventType: NotificationEventType;
  channels: NotificationChannelPreference[];
}

export interface PetNotificationPreferencesResponse {
  petId: string;
  preferences: PetNotificationPreference[];
}

export interface UpdatePetNotificationPreferenceInput {
  petId: string;
  eventType: NotificationEventType;
  channel: NotificationChannel;
  enabled: boolean;
}

/**
 * Fetch per-pet notification channel preferences.
 * Authorization and consent decisions are owned by the backend; the client
 * only renders what the backend returns.
 */
export async function getPetNotificationPreferences(
  petId: string,
): Promise<PetNotificationPreferencesResponse> {
  return apiRequest<PetNotificationPreferencesResponse>(
    `/pets/${encodeURIComponent(petId)}/notification-preferences`,
    { method: 'GET' },
  );
}

/**
 * Update a single channel preference for a pet and event type.
 * The backend remains the source of truth and may reject or lock channels
 * (e.g. required security notifications).
 */
export async function updatePetNotificationPreference(
  input: UpdatePetNotificationPreferenceInput,
): Promise<PetNotificationPreference> {
  const { petId, eventType, channel, enabled } = input;
  return apiRequest<PetNotificationPreference>(
    `/pets/${encodeURIComponent(petId)}/notification-preferences`,
    {
      method: 'PATCH',
      body: JSON.stringify({ eventType, channel, enabled }),
    },
  );
}
