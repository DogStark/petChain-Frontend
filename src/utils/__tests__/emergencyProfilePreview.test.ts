import {
  buildCompletenessPreview,
  visibleFields,
} from '../emergencyProfilePreview';
import { PetEmergencyInfo } from '@/types/pet';

const fullProfile: PetEmergencyInfo = {
  petId: 'pet-123',
  medicalNotes: 'Severe peanut allergy. Needs daily insulin.',
  contacts: [
    {
      id: 'c1',
      name: 'Jane Doe',
      relationship: 'Owner',
      phone: '+1-555-0199',
      email: 'jane@example.com',
      priority: 1,
      isPublic: false,
    },
    {
      id: 'c2',
      name: 'John Smith',
      relationship: 'Co-owner',
      phone: '+1-555-0200',
      priority: 2,
      isPublic: true,
    },
  ],
  emergencyVet: {
    name: 'Downtown Animal Hospital',
    phone: '+1-555-0911',
    address: '100 Main St',
    is24Hours: true,
    notes: 'Gate code #1234',
    isPublic: false,
  },
  poisonControl: {
    name: 'Animal Poison Control Center',
    phone: '+1-888-426-4435',
    website: 'https://aspca.org',
    isPublic: true,
  },
  visibility: {
    medicalNotes: false, // private
    contacts: false, // section private
    emergencyVet: false, // private
    poisonControl: true, // public
    customMessage: false, // off
  },
};

describe('buildCompletenessPreview', () => {
  it('returns five rows in the canonical order', () => {
    const rows = buildCompletenessPreview(fullProfile);
    expect(rows.map((r) => r.key)).toEqual([
      'medicalNotes',
      'contacts',
      'emergencyVet',
      'poisonControl',
      'customMessage',
    ]);
  });

  it('flags hasContent independently of visibility (primary flow)', () => {
    const rows = buildCompletenessPreview(fullProfile);
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r]));
    // All populated, even though most are private:
    expect(byKey.medicalNotes.hasContent).toBe(true);
    expect(byKey.contacts.hasContent).toBe(true);
    expect(byKey.emergencyVet.hasContent).toBe(true);
    expect(byKey.poisonControl.hasContent).toBe(true);
    // customMessage has no content payload -> only true when opted in:
    expect(byKey.customMessage.hasContent).toBe(false);
  });

  it('reflects the effective public projection (section vs per-item visibility)', () => {
    const rows = buildCompletenessPreview(fullProfile);
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r]));
    // medicalNotes / emergencyVet are section-private with no per-item override:
    expect(byKey.medicalNotes.visible).toBe(false);
    expect(byKey.emergencyVet.visible).toBe(false);
    // poisonControl is section-public -> visible:
    expect(byKey.poisonControl.visible).toBe(true);
    // contacts: section is private, but c2 is individually isPublic=true, so one
    // contact still appears on the scan -> the category is visible:
    expect(byKey.contacts.visible).toBe(true);
    // customMessage off -> not visible:
    expect(byKey.customMessage.visible).toBe(false);
  });

  it('treats mobile and desktop visibility identically (responsive)', () => {
    const rows = buildCompletenessPreview(fullProfile);
    for (const row of rows) {
      expect(row.visibleOnMobile).toBe(row.visible);
      expect(row.visibleOnDesktop).toBe(row.visible);
    }
  });

  it('returns no visible fields for null or undefined input (denied/empty state)', () => {
    expect(buildCompletenessPreview(null).every((r) => !r.visible)).toBe(true);
    expect(buildCompletenessPreview(undefined).every((r) => !r.visible)).toBe(true);
    expect(
      buildCompletenessPreview(null).every((r) => r.hasContent === false)
    ).toBe(true);
  });

  it('shows every populated field when all visibility flags are enabled (boundary)', () => {
    const allPublic: PetEmergencyInfo = {
      ...fullProfile,
      visibility: {
        medicalNotes: true,
        contacts: true,
        emergencyVet: true,
        poisonControl: true,
        customMessage: true,
      },
    };
    const rows = buildCompletenessPreview(allPublic);
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r]));
    expect(byKey.medicalNotes.visible).toBe(true);
    expect(byKey.contacts.visible).toBe(true);
    expect(byKey.emergencyVet.visible).toBe(true);
    expect(byKey.poisonControl.visible).toBe(true);
    // customMessage is opted in -> considered visible:
    expect(byKey.customMessage.visible).toBe(true);
  });

  it('hides contacts entirely when the section is private and no contact is individually public', () => {
    const allPrivateContacts: PetEmergencyInfo = {
      ...fullProfile,
      contacts: fullProfile.contacts.map((c) => ({ ...c, isPublic: false })),
    };
    const rows = buildCompletenessPreview(allPrivateContacts);
    const contacts = rows.find((r) => r.key === 'contacts');
    expect(contacts?.hasContent).toBe(true);
    expect(contacts?.visible).toBe(false);
  });

  it('visibleFields lists only the fields that will appear on the scan', () => {
    // c2 is individually public -> contacts shows; poisonControl is section-public.
    expect(visibleFields(fullProfile)).toEqual(['contacts', 'poisonControl']);
    expect(visibleFields(null)).toEqual([]);
  });
});
