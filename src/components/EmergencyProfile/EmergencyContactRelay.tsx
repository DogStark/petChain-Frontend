import React from 'react';
import { Eye, Lock, ShieldCheck } from 'lucide-react';
import { EmergencyContact } from '@/types/pet';
import { buildContactRelay } from '@/utils/contactRelay';

interface EmergencyContactRelayProps {
  /** The owner's emergency contacts (may be null/empty while loading). */
  contacts: EmergencyContact[] | null | undefined;
  /** Whether the owner has opted in to reveal direct contact details to responders. */
  revealDirect: boolean;
  /** Called when the owner toggles direct-disclosure opt-in. */
  onRevealChange?: (next: boolean) => void;
  /** Optional id so the section can be referenced by aria-labelledby. */
  id?: string;
}

/**
 * Shows the owner exactly how emergency responders will be able to reach them,
 * and lets the owner opt in to revealing direct phone/email.
 *
 * Privacy model (authorization/consent stays with the backend):
 *  - By default responders reach the owner through a *secure relay* that only
 *    exposes each contact's name + relationship — never the phone or email.
 *  - When the owner explicitly opts in, direct contact details for public
 *    contacts are shown. The relay remains available either way.
 *
 * Keyboard / screen-reader friendly: a labelled <section>, a real checkbox
 * toggle with a described-by hint, a live `role="status"` summary, and
 * status text that does not rely on colour alone.
 */
export function EmergencyContactRelay({
  contacts,
  revealDirect,
  onRevealChange,
  id,
}: EmergencyContactRelayProps) {
  const disclosure = buildContactRelay(contacts, { revealDirect });
  const relayId = `${id ?? 'contact-relay'}-relay-desc`;

  return (
    <section
      id={id}
      aria-label="Emergency contact disclosure"
      className="bg-white border border-red-100 rounded-2xl p-4 shadow-sm"
    >
      <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide flex items-center gap-2">
        <ShieldCheck size={16} className="text-red-600" aria-hidden="true" />
        How responders can reach you
      </h2>

      <p className="text-xs text-gray-500 mt-1" role="status">
        {disclosure.summary}
      </p>

      {disclosure.hasAnyContact && (
        <label className="mt-3 flex items-start gap-2 text-sm text-gray-800">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={revealDirect}
            onChange={(e) => onRevealChange?.(e.target.checked)}
            aria-describedby={relayId}
          />
          <span>
            Reveal my direct phone and email to responders
            <span id={relayId} className="block text-xs text-gray-500">
              Off by default. When off, responders still reach you through a secure
              relay that hides your direct details.
            </span>
          </span>
        </label>
      )}

      {disclosure.warning && (
        <p
          role="alert"
          className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1"
        >
          {disclosure.warning}
        </p>
      )}

      {disclosure.hasAnyContact ? (
        <ul role="list" className="mt-3 space-y-2">
          {disclosure.relayContacts.map((c) => {
            const direct = disclosure.directContacts.find((d) => d.id === c.id);
            if (direct) {
              return (
                <li
                  key={c.id}
                  role="listitem"
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="font-medium text-gray-800">
                    {c.name}
                    <span className="font-normal text-gray-500"> · {c.relationship}</span>
                    <span className="block text-xs text-gray-600">{direct.phone}</span>
                    {direct.email ? (
                      <span className="block text-xs text-gray-600">{direct.email}</span>
                    ) : null}
                  </span>
                  <span
                    className="inline-flex items-center gap-1 text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5 text-xs font-bold"
                    aria-label={`${c.name} direct contact ${direct.phone}${
                      direct.email ? `, email ${direct.email}` : ''
                    } is visible to responders`}
                  >
                    <Eye size={12} aria-hidden="true" /> Direct
                  </span>
                </li>
              );
            }
            return (
              <li
                key={c.id}
                role="listitem"
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="font-medium text-gray-800">
                  {c.name}
                  <span className="font-normal text-gray-500"> · {c.relationship}</span>
                </span>
                <span
                  className="inline-flex items-center gap-1 text-gray-500 bg-gray-50 border border-gray-200 rounded-full px-2 py-0.5 text-xs font-bold"
                  aria-label={`${c.name} is reachable through the secure relay, direct details hidden`}
                >
                  <Lock size={12} aria-hidden="true" /> Relay only
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-gray-500">
          Add at least one emergency contact so responders can reach you.
        </p>
      )}
    </section>
  );
}

export default EmergencyContactRelay;
