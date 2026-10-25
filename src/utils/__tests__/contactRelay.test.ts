import {
  buildContactRelay,
  toRelayView,
  type ContactRelayDisclosure,
} from '../contactRelay';
import { EmergencyContact } from '@/types/pet';

const publicContact: EmergencyContact = {
  id: 'c1',
  name: 'Jane Doe',
  relationship: 'Vet',
  phone: '+1-555-0100',
  email: 'jane@example.com',
  priority: 1,
  isPublic: true,
};

const privateContact: EmergencyContact = {
  id: 'c2',
  name: 'Bob Smith',
  relationship: 'Neighbor',
  phone: '+1-555-0200',
  priority: 2,
  isPublic: false,
};

describe('toRelayView', () => {
  it('strips direct PII from a contact', () => {
    const view = toRelayView(publicContact);
    expect(view.id).toBe('c1');
    expect(view.name).toBe('Jane Doe');
    expect(view.relationship).toBe('Vet');
    expect((view as Record<string, unknown>).phone).toBeUndefined();
    expect((view as Record<string, unknown>).email).toBeUndefined();
  });
});

describe('buildContactRelay — empty / denied states', () => {
  it('handles null contacts without throwing', () => {
    const d: ContactRelayDisclosure = buildContactRelay(null, { revealDirect: false });
    expect(d.hasAnyContact).toBe(false);
    expect(d.relayAvailable).toBe(false);
    expect(d.directContacts).toHaveLength(0);
    expect(d.relayContacts).toHaveLength(0);
    expect(d.summary).toMatch(/no emergency contacts/i);
  });

  it('hides direct details by default (relay-only) even with public contacts', () => {
    const d = buildContactRelay([publicContact, privateContact], { revealDirect: false });
    expect(d.revealDirect).toBe(false);
    expect(d.directContacts).toHaveLength(0);
    expect(d.relayContacts).toHaveLength(2);
    expect(d.relayAvailable).toBe(true);
    expect(d.summary).toMatch(/secure relay/i);
  });
});

describe('buildContactRelay — opt-in disclosure', () => {
  it('reveals only public contacts when opted in', () => {
    const d = buildContactRelay([publicContact, privateContact], { revealDirect: true });
    expect(d.revealDirect).toBe(true);
    expect(d.directContacts).toHaveLength(1);
    expect(d.directContacts[0].id).toBe('c1');
    expect(d.directContacts[0].phone).toBe('+1-555-0100');
    expect(d.directContacts[0].email).toBe('jane@example.com');
    // private contact stays in the relay set, never in direct
    expect(d.relayContacts).toHaveLength(2);
  });

  it('warns when opted in but no public contact is configured', () => {
    const d = buildContactRelay([privateContact], { revealDirect: true });
    expect(d.directContacts).toHaveLength(0);
    expect(d.relayAvailable).toBe(true);
    expect(d.warning).toBeDefined();
    expect(d.warning).toMatch(/no public contact/i);
  });

  it('exposes email only when present', () => {
    const noEmail: EmergencyContact = { ...privateContact, isPublic: true, email: undefined };
    const d = buildContactRelay([noEmail], { revealDirect: true });
    expect(d.directContacts[0].email).toBeUndefined();
    expect(d.directContacts[0].phone).toBe('+1-555-0200');
  });
});

describe('buildContactRelay — relay scoping', () => {
  it('limits relay to public contacts when includePrivateInRelay is false', () => {
    const d = buildContactRelay([publicContact, privateContact], {
      revealDirect: false,
      includePrivateInRelay: false,
    });
    expect(d.relayContacts).toHaveLength(1);
    expect(d.relayContacts[0].id).toBe('c1');
  });
});
