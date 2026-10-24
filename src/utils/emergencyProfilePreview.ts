import { PetEmergencyInfo } from '@/types/pet';
import { projectEmergencyProfile } from './emergencyProjection';

/**
 * The five field categories that may be revealed on a public emergency QR scan.
 * `customMessage` has no separate content payload on the profile — it is a
 * visibility-only feature, so its "content" is the owner's opt-in itself.
 */
export type ProfileFieldKey =
  | 'medicalNotes'
  | 'contacts'
  | 'emergencyVet'
  | 'poisonControl'
  | 'customMessage';

export interface CompletenessFieldRow {
  /** Stable key for the field category. */
  key: ProfileFieldKey;
  /** Human-readable label matching the owner page sections. */
  label: string;
  /**
   * Whether this field WILL actually appear on a public scan.
   * True only when the owner enabled it *and* populated it with content.
   */
  visible: boolean;
  /** Whether the owner has populated this field (independent of visibility). */
  hasContent: boolean;
  /**
   * The public scan is rendered responsively, so the visible field set is
   * identical on mobile and desktop. These flags are surfaced so a preview UI
   * can describe both viewports without inventing divergent behaviour.
   */
  visibleOnMobile: boolean;
  visibleOnDesktop: boolean;
}

const FIELD_ORDER: { key: ProfileFieldKey; label: string }[] = [
  { key: 'medicalNotes', label: 'Critical medical notes' },
  { key: 'contacts', label: 'Owner contacts' },
  { key: 'emergencyVet', label: 'Emergency veterinarian' },
  { key: 'poisonControl', label: 'Poison control' },
  { key: 'customMessage', label: 'Custom message' },
];

function isFilled(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (Array.isArray(value)) return value.length > 0;
  return Boolean(String(value).trim());
}

/**
 * Builds a per-field completeness preview for the owner configuration screen.
 *
 * Each row reports whether the public scan will reveal that field
 * (`visible` = enabled AND has content), and whether the owner actually has
 * data for it (`hasContent`). This lets an owner see exactly which fields a
 * scanner will show before publishing or changing the profile.
 *
 * Pure and side-effect free — safe to unit test without a DOM or network.
 */
export function buildCompletenessPreview(
  info: PetEmergencyInfo | null | undefined
): CompletenessFieldRow[] {
  const projected = projectEmergencyProfile(info);

  const hasContent: Record<ProfileFieldKey, boolean> = {
    medicalNotes: isFilled(info?.medicalNotes),
    contacts: isFilled(info?.contacts),
    emergencyVet: isFilled(info?.emergencyVet),
    poisonControl: isFilled(info?.poisonControl),
    customMessage: info?.visibility?.customMessage === true,
  };

  const visible: Record<ProfileFieldKey, boolean> = {
    medicalNotes: Boolean(projected?.medicalNotes),
    contacts: Boolean(projected?.contacts && projected.contacts.length > 0),
    emergencyVet: Boolean(projected?.emergencyVet),
    poisonControl: Boolean(projected?.poisonControl),
    customMessage: projected?.visibility?.customMessage === true,
  };

  return FIELD_ORDER.map(({ key, label }) => ({
    key,
    label,
    visible: visible[key],
    hasContent: hasContent[key],
    visibleOnMobile: visible[key],
    visibleOnDesktop: visible[key],
  }));
}

/**
 * Convenience: the list of field keys that WILL be shown on the public scan.
 */
export function visibleFields(
  info: PetEmergencyInfo | null | undefined
): ProfileFieldKey[] {
  return buildCompletenessPreview(info)
    .filter((row) => row.visible)
    .map((row) => row.key);
}
