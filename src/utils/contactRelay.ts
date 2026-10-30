import { EmergencyContact } from '@/types/pet';

/** A contact stripped of all direct PII — safe to render in a relay list. */
export interface RelayContactView {
  id: string;
  name: string;
  relationship: string;
}

/** A contact with its direct details, only ever returned when the owner opts in. */
export interface DirectContactView extends RelayContactView {
  phone: string;
  email?: string;
}

export interface ContactRelayOptions {
  /**
   * The owner explicitly opted in to reveal direct contact details (phone/email)
   * to emergency responders. When false (the default), direct details are never
   * returned — responders can only reach the owner through the secure relay.
   */
  revealDirect: boolean;
  /**
   * Whether non-public contacts should still be reachable through the relay
   * (name + relationship only, no direct details). Defaults to true so the
   * owner can always be reached even before marking a contact public.
   */
  includePrivateInRelay?: boolean;
}

export interface ContactRelayDisclosure {
  /** Echo of the owner's opt-in for direct disclosure. */
  revealDirect: boolean;
  /** True when at least one contact exists at all. */
  hasAnyContact: boolean;
  /** Direct contacts whose phone/email may be shown (revealDirect && isPublic). */
  directContacts: DirectContactView[];
  /** Contacts reachable via the secure relay (PII-stripped view). */
  relayContacts: RelayContactView[];
  /** A secure relay path exists (at least one contact to route through). */
  relayAvailable: boolean;
  /** Human-readable summary of what responders will see (colour-independent). */
  summary: string;
  /**
   * Non-fatal warning for the owner, e.g. opt-in turned on but no public
   * contact configured yet, so nothing would actually be disclosed.
   */
  warning?: string;
}

/**
 * Strip direct PII from a contact so it can be shown in a relay list without
 * leaking phone/email to a scanner.
 */
export function toRelayView(contact: EmergencyContact): RelayContactView {
  return {
    id: contact.id,
    name: contact.name,
    relationship: contact.relationship,
  };
}

/**
 * Build a privacy-preserving contact disclosure for emergency responders.
 *
 * Privacy guarantees:
 *  - Direct phone/email are NEVER returned unless the owner explicitly opted in
 *    (`revealDirect`) AND the contact is marked public (`isPublic !== false`).
 *  - When direct disclosure is off, responders can still reach the owner through
 *    a secure relay: only name + relationship are exposed, so the backend can
 *    route the message without leaking PII to the scanner.
 *
 * Pure and side-effect free — safe to unit test without a DOM or network.
 */
export function buildContactRelay(
  contacts: EmergencyContact[] | null | undefined,
  options: ContactRelayOptions,
): ContactRelayDisclosure {
  const list = Array.isArray(contacts) ? contacts : [];
  const hasAnyContact = list.length > 0;
  const revealDirect = options.revealDirect === true;
  const includePrivate = options.includePrivateInRelay !== false;

  const directContacts: DirectContactView[] = revealDirect
    ? list
        .filter((c) => c.isPublic !== false)
        .map((c) => ({
          id: c.id,
          name: c.name,
          relationship: c.relationship,
          phone: c.phone,
          ...(c.email ? { email: c.email } : {}),
        }))
    : [];

  const relayable = includePrivate
    ? list
    : list.filter((c) => c.isPublic !== false);
  const relayContacts: RelayContactView[] = relayable.map(toRelayView);

  const relayAvailable = relayContacts.length > 0;

  let summary: string;
  if (!hasAnyContact) {
    summary =
      'No emergency contacts are configured, so responders have no way to reach you.';
  } else if (revealDirect) {
    summary =
      directContacts.length > 0
        ? `Responders will see ${directContacts.length} direct contact${
            directContacts.length === 1 ? '' : 's'
          } and a secure relay option.`
        : 'You chose to reveal direct contact details, but no public contact is configured yet — only the secure relay is available.';
  } else {
    summary = `Responders reach you through a secure relay that hides your direct phone and email (${relayContacts.length} contact${
      relayContacts.length === 1 ? '' : 's'
    } available).`;
  }

  let warning: string | undefined;
  if (revealDirect && directContacts.length === 0) {
    warning =
      'Direct disclosure is on, but no public contact is configured — add a public contact or turn this off so responders are not misled.';
  }

  return {
    revealDirect,
    hasAnyContact,
    directContacts,
    relayContacts,
    relayAvailable,
    summary,
    warning,
  };
}
