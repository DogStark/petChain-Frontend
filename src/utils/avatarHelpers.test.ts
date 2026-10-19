import { getInitials, getAvatarColor, getSpeciesIcon, getAvatarAlt } from './avatarHelpers';

describe('avatarHelpers', () => {
  describe('getInitials', () => {
    it('extracts initials from full name', () => {
      expect(getInitials('John Doe')).toBe('JD');
      expect(getInitials('Alice Smith')).toBe('AS');
      expect(getInitials('Bob Johnson')).toBe('BJ');
    });

    it('handles single name', () => {
      expect(getInitials('Alice')).toBe('A');
      expect(getInitials('Bob')).toBe('B');
    });

    it('handles multiple middle names', () => {
      expect(getInitials('John Michael Doe')).toBe('JD');
      expect(getInitials('Dr. Bob Alan Smith Jr.')).toBe('DJ');
    });

    it('handles empty or invalid input', () => {
      expect(getInitials('')).toBe('?');
      expect(getInitials('   ')).toBe('?');
      expect(getInitials(null as any)).toBe('?');
      expect(getInitials(undefined as any)).toBe('?');
    });

    it('handles names with special characters', () => {
      expect(getInitials("O'Brien")).toBe('O');
      expect(getInitials('Jean-Luc Picard')).toBe('JP');
    });

    it('converts to uppercase', () => {
      expect(getInitials('john doe')).toBe('JD');
      expect(getInitials('alice')).toBe('A');
    });

    it('handles extra whitespace', () => {
      expect(getInitials('  John   Doe  ')).toBe('JD');
      expect(getInitials('Alice  \n  Smith')).toBe('AS');
    });
  });

  describe('getAvatarColor', () => {
    it('generates deterministic colors', () => {
      const color1 = getAvatarColor('John Doe');
      const color2 = getAvatarColor('John Doe');
      expect(color1).toBe(color2);
    });

    it('generates different colors for different names', () => {
      const colors = [
        getAvatarColor('Alice'),
        getAvatarColor('Bob'),
        getAvatarColor('Charlie'),
        getAvatarColor('David'),
        getAvatarColor('Eve'),
      ];
      
      // At least some colors should be different (not all same)
      const uniqueColors = new Set(colors);
      expect(uniqueColors.size).toBeGreaterThan(1);
    });

    it('returns valid hex color codes', () => {
      const color = getAvatarColor('Test Name');
      expect(color).toMatch(/^#[0-9A-F]{6}$/i);
    });

    it('handles empty or invalid input with fallback color', () => {
      expect(getAvatarColor('')).toBe('#9CA3AF');
      expect(getAvatarColor(null as any)).toBe('#9CA3AF');
      expect(getAvatarColor(undefined as any)).toBe('#9CA3AF');
    });

    it('generates consistent colors across sessions', () => {
      // Test that same input always produces same output
      const testCases = ['Alice', 'Bob', 'Charlie', 'David'];
      
      testCases.forEach((name) => {
        const color1 = getAvatarColor(name);
        const color2 = getAvatarColor(name);
        expect(color1).toBe(color2);
      });
    });
  });

  describe('getSpeciesIcon', () => {
    it('maps dog species correctly', () => {
      expect(getSpeciesIcon('dog')).toBe('dog');
      expect(getSpeciesIcon('Dog')).toBe('dog');
      expect(getSpeciesIcon('canine')).toBe('dog');
      expect(getSpeciesIcon('DOG')).toBe('dog');
    });

    it('maps cat species correctly', () => {
      expect(getSpeciesIcon('cat')).toBe('cat');
      expect(getSpeciesIcon('Cat')).toBe('cat');
      expect(getSpeciesIcon('feline')).toBe('cat');
    });

    it('maps bird species correctly', () => {
      expect(getSpeciesIcon('bird')).toBe('bird');
      expect(getSpeciesIcon('avian')).toBe('bird');
    });

    it('maps fish species correctly', () => {
      expect(getSpeciesIcon('fish')).toBe('fish');
      expect(getSpeciesIcon('aquatic')).toBe('fish');
    });

    it('maps rabbit species correctly', () => {
      expect(getSpeciesIcon('rabbit')).toBe('rabbit');
      expect(getSpeciesIcon('bunny')).toBe('rabbit');
    });

    it('returns paw-print as default fallback', () => {
      expect(getSpeciesIcon('hamster')).toBe('paw-print');
      expect(getSpeciesIcon('lizard')).toBe('paw-print');
      expect(getSpeciesIcon('')).toBe('paw-print');
      expect(getSpeciesIcon(undefined)).toBe('paw-print');
    });

    it('handles case insensitivity and whitespace', () => {
      expect(getSpeciesIcon('  DOG  ')).toBe('dog');
      expect(getSpeciesIcon('  cat  ')).toBe('cat');
    });
  });

  describe('getAvatarAlt', () => {
    it('generates descriptive alt text for user avatars', () => {
      expect(getAvatarAlt('John Doe', 'user')).toBe('Profile picture for John Doe');
      expect(getAvatarAlt('Alice', 'user')).toBe('Profile picture for Alice');
    });

    it('generates descriptive alt text for pet avatars', () => {
      expect(getAvatarAlt('Buddy', 'pet')).toBe('Pet picture for Buddy');
      expect(getAvatarAlt('Whiskers', 'pet')).toBe('Pet picture for Whiskers');
    });

    it('generates descriptive alt text for staff avatars', () => {
      expect(getAvatarAlt('Dr. Smith', 'staff')).toBe('Staff member picture for Dr. Smith');
    });

    it('handles missing name gracefully', () => {
      expect(getAvatarAlt('', 'user')).toBe('Profile picture');
      expect(getAvatarAlt('', 'pet')).toBe('Pet picture');
      expect(getAvatarAlt('', 'staff')).toBe('Staff member picture');
    });

    it('returns empty string for decorative images', () => {
      expect(getAvatarAlt('John Doe', 'user', true)).toBe('');
      expect(getAvatarAlt('Buddy', 'pet', true)).toBe('');
      expect(getAvatarAlt('', 'staff', true)).toBe('');
    });

    it('respects decorative flag regardless of name', () => {
      expect(getAvatarAlt('Test Name', 'user', true)).toBe('');
      expect(getAvatarAlt('Test Name', 'user', false)).toBe('Profile picture for Test Name');
    });
  });
});
