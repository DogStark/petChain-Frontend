import { projectEmergencyProfile, createDefaultVisibility } from './emergencyProjection';
import { PetEmergencyInfo } from '@/types/pet';

describe('emergencyProjection utility', () => {
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
      medicalNotes: false, // defaulted to private
      contacts: false,     // section-level private
      emergencyVet: false, // private
      poisonControl: true, // public
    },
  };

  describe('createDefaultVisibility', () => {
    it('defaults all new fields to private (false)', () => {
      const defaults = createDefaultVisibility();
      expect(defaults.medicalNotes).toBe(false);
      expect(defaults.contacts).toBe(false);
      expect(defaults.emergencyVet).toBe(false);
      expect(defaults.poisonControl).toBe(false);
      expect(defaults.customMessage).toBe(false);
    });
  });

  describe('projectEmergencyProfile', () => {
    it('returns null when input is null or undefined', () => {
      expect(projectEmergencyProfile(null)).toBeNull();
      expect(projectEmergencyProfile(undefined)).toBeNull();
    });

    it('hides fields that are configured as private in visibility settings', () => {
      const projected = projectEmergencyProfile(fullProfile);
      expect(projected).not.toBeNull();
      // Medical notes are private
      expect(projected?.medicalNotes).toBeUndefined();
      // Emergency vet is private
      expect(projected?.emergencyVet).toBeUndefined();
      // Poison control is public
      expect(projected?.poisonControl).toBeDefined();
      expect(projected?.poisonControl?.name).toBe('Animal Poison Control Center');
    });

    it('filters individual private contacts when section is public or default', () => {
      const profileWithMixedContacts: PetEmergencyInfo = {
        ...fullProfile,
        visibility: {
          ...fullProfile.visibility,
          contacts: true,
        },
      };
      const projected = projectEmergencyProfile(profileWithMixedContacts);
      // c1 is isPublic: false, c2 is isPublic: true => only c2 is included
      expect(projected?.contacts).toHaveLength(1);
      expect(projected?.contacts[0].name).toBe('John Smith');
    });

    it('defaults to private when visibility object is omitted or incomplete (legacy data)', () => {
      const legacyProfile: PetEmergencyInfo = {
        petId: 'pet-legacy',
        medicalNotes: 'Legacy note',
        contacts: [
          {
            id: 'c1',
            name: 'Jane Doe',
            relationship: 'Owner',
            phone: '+1-555-0199',
            priority: 1,
          },
        ],
        emergencyVet: {
          name: 'Vet Clinic',
          phone: '123',
          address: '456 St',
          is24Hours: false,
        },
      };

      const projected = projectEmergencyProfile(legacyProfile);
      // All fields default to private
      expect(projected?.medicalNotes).toBeUndefined();
      expect(projected?.contacts).toEqual([]);
      expect(projected?.emergencyVet).toBeUndefined();
    });

    it('reveals fields when visibility is explicitly set to true', () => {
      const fullyPublicProfile: PetEmergencyInfo = {
        ...fullProfile,
        contacts: [
          {
            id: 'c1',
            name: 'Jane Doe',
            relationship: 'Owner',
            phone: '+1-555-0199',
            priority: 1,
            isPublic: true,
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
        visibility: {
          medicalNotes: true,
          contacts: true,
          emergencyVet: true,
          poisonControl: true,
        },
      };

      const projected = projectEmergencyProfile(fullyPublicProfile);
      expect(projected?.medicalNotes).toBe('Severe peanut allergy. Needs daily insulin.');
      expect(projected?.emergencyVet?.name).toBe('Downtown Animal Hospital');
      expect(projected?.poisonControl?.name).toBe('Animal Poison Control Center');
      expect(projected?.contacts.length).toBe(2);
    });
  });
});
