import { apiClient } from './client';

export type CareReminderType =
  | 'medication'
  | 'vaccination'
  | 'grooming'
  | 'feeding'
  | 'vet_visit';

export type DigestWindow = 'morning' | 'midday' | 'evening';

export interface CareReminderDigestPreference {
  enabled: boolean;
  window: DigestWindow;
  includedTypes: CareReminderType[];
}

export const CARE_REMINDER_TYPES: readonly CareReminderType[] = [
  'medication',
  'vaccination',
  'grooming',
  'feeding',
  'vet_visit',
];

export const DIGEST_WINDOWS: readonly DigestWindow[] = [
  'morning',
  'midday',
  'evening',
];

export const DEFAULT_DIGEST_PREFERENCE: CareReminderDigestPreference = {
  enabled: false,
  window: 'morning',
  includedTypes: [],
};

/**
 * Fetch the current user's daily care reminder digest preference.
 * Authorization and consent are enforced by the backend; a denied or
 * unauthenticated request surfaces as an error from the client.
 */
export async function getCareReminderDigestPreference(): Promise<CareReminderDigestPreference> {
  const response = await apiClient.get<CareReminderDigestPreference>(
    '/care-reminders/digest-preference',
  );
  return response.data;
}

/**
 * Persist the user's daily care reminder digest preference.
 * The frontend only submits the preference; the backend decides whether a
 * reminder is delivered individually or folded into the digest so that no
 * duplicate delivery occurs.
 */
export async function updateCareReminderDigestPreference(
  preference: CareReminderDigestPreference,
): Promise<CareReminderDigestPreference> {
  const response = await apiClient.put<CareReminderDigestPreference>(
    '/care-reminders/digest-preference',
    preference,
  );
  return response.data;
}
