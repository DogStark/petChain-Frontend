export type EmergencyFieldKind = 'medication' | 'contact' | 'note';

export interface EmergencyProfileField {
  id: string;
  kind: EmergencyFieldKind;
  label: string;
  value: string;
  /** ISO timestamp when the field auto-expires; null means permanent. */
  expiresAt: string | null;
  /** Backend-owned: whether the caller may edit/remove this field. */
  canEdit: boolean;
  /** Backend-owned: whether the caller has consented to share this field. */
  consentGranted: boolean;
}

export interface EmergencyProfile {
  petId: string;
  fields: EmergencyProfileField[];
}

export interface ExpiryWarning {
  fieldId: string;
  label: string;
  expiresAt: string;
  /** Milliseconds until expiry; negative when already expired. */
  msRemaining: number;
  expired: boolean;
}

/** Default warning window: surface a warning within 24h of expiry. */
export const EXPIRY_WARNING_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface SetFieldExpiryInput {
  petId: string;
  fieldId: string;
  /** ISO timestamp, or null to make the field permanent. */
  expiresAt: string | null;
}

export interface EmergencyProfileClientOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

function resolveBaseUrl(options?: EmergencyProfileClientOptions): string {
  return options?.baseUrl ?? '';
}

function resolveFetch(options?: EmergencyProfileClientOptions): typeof fetch {
  return options?.fetchImpl ?? fetch;
}

async function parseError(res: Response): Promise<Error> {
  let message = `Request failed with status ${res.status}`;
  try {
    const body = (await res.json()) as { message?: string; error?: string };
    if (body?.message) message = body.message;
    else if (body?.error) message = body.error;
  } catch {
    // Non-JSON error body; keep the status-based message.
  }
  return new Error(message);
}

/**
 * Compute expiry warnings for temporary fields. Pure helper so the UI can
 * render warnings without making any authorization or consent decisions.
 */
export function getExpiryWarnings(
  fields: EmergencyProfileField[],
  now: number = Date.now(),
  windowMs: number = EXPIRY_WARNING_WINDOW_MS,
): ExpiryWarning[] {
  const warnings: ExpiryWarning[] = [];
  for (const field of fields) {
    if (!field.expiresAt) continue;
    const expiresAtMs = Date.parse(field.expiresAt);
    if (Number.isNaN(expiresAtMs)) continue;
    const msRemaining = expiresAtMs - now;
    if (msRemaining > windowMs) continue;
    warnings.push({
      fieldId: field.id,
      label: field.label,
      expiresAt: field.expiresAt,
      msRemaining,
      expired: msRemaining <= 0,
    });
  }
  return warnings.sort((a, b) => a.msRemaining - b.msRemaining);
}

/**
 * Validate a proposed expiry before sending it to the backend. Returns an
 * error message, or null when the value is acceptable. The backend remains
 * the authority on whether the change is permitted.
 */
export function validateExpiry(
  expiresAt: string | null,
  now: number = Date.now(),
): string | null {
  if (expiresAt === null) return null;
  const ms = Date.parse(expiresAt);
  if (Number.isNaN(ms)) return 'Expiry must be a valid date and time.';
  if (ms <= now) return 'Expiry must be in the future.';
  return null;
}

export async function fetchEmergencyProfile(
  petId: string,
  options?: EmergencyProfileClientOptions,
): Promise<EmergencyProfile> {
  const res = await resolveFetch(options)(
    `${resolveBaseUrl(options)}/api/pets/${encodeURIComponent(petId)}/emergency-profile`,
    { method: 'GET', credentials: 'include' },
  );
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as EmergencyProfile;
}

/**
 * Request an expiry change for a temporary field. Authorization and consent
 * are decided by the backend; the client only forwards the requested value.
 */
export async function setFieldExpiry(
  input: SetFieldExpiryInput,
  options?: EmergencyProfileClientOptions,
): Promise<EmergencyProfileField> {
  const res = await resolveFetch(options)(
    `${resolveBaseUrl(options)}/api/pets/${encodeURIComponent(input.petId)}/emergency-profile/fields/${encodeURIComponent(input.fieldId)}/expiry`,
    {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiresAt: input.expiresAt }),
    },
  );
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as EmergencyProfileField;
}
