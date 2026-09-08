import {
  PetEmergencyInfo,
  EmergencyFieldVisibility,
  EmergencyContact,
  EmergencyVet,
  PoisonControl,
} from '@/types/pet';

/**
 * Creates default visibility settings where all fields default to private (`false`).
 * This enforces privacy by default for new emergency profile entries.
 */
export function createDefaultVisibility(): Required<EmergencyFieldVisibility> {
  return {
    medicalNotes: false,
    contacts: false,
    emergencyVet: false,
    poisonControl: false,
    customMessage: false,
  };
}

/**
 * Projects a full PetEmergencyInfo object into the public/anonymous subset that
 * unauthenticated scanners are permitted to see.
 *
 * Privacy rules:
 * - Unset or new fields default to private (`false`).
 * - A section or field is only revealed if its visibility flag is explicitly `true`.
 * - Contacts and emergency vet entries can also have per-item `isPublic` flags.
 */
export function projectEmergencyProfile(
  info: PetEmergencyInfo | null | undefined,
  visibilityOverride?: EmergencyFieldVisibility
): PetEmergencyInfo | null {
  if (!info) return null;

  const vis = visibilityOverride ?? info.visibility ?? {};

  const medicalNotes = vis.medicalNotes === true ? info.medicalNotes : undefined;

  let contacts: EmergencyContact[] = [];
  if (info.contacts && Array.isArray(info.contacts)) {
    if (vis.contacts === true) {
      contacts = info.contacts.filter((c) => c.isPublic !== false);
    } else {
      contacts = info.contacts.filter((c) => c.isPublic === true);
    }
  }

  let emergencyVet: EmergencyVet | undefined = undefined;
  if (info.emergencyVet) {
    if (vis.emergencyVet === true || info.emergencyVet.isPublic === true) {
      emergencyVet = info.emergencyVet;
    }
  }

  let poisonControl: PoisonControl | undefined = undefined;
  if (info.poisonControl) {
    if (vis.poisonControl === true || info.poisonControl.isPublic === true) {
      poisonControl = info.poisonControl;
    }
  }

  return {
    petId: info.petId,
    medicalNotes,
    contacts,
    emergencyVet,
    poisonControl,
    visibility: {
      medicalNotes: vis.medicalNotes === true,
      contacts: vis.contacts === true,
      emergencyVet: vis.emergencyVet === true,
      poisonControl: vis.poisonControl === true,
      customMessage: vis.customMessage === true,
    },
  };
}
