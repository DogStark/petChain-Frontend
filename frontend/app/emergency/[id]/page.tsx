import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

// Server-rendered public emergency profile.
// Essential identity/contact info is rendered in server HTML so it is
// available without client JavaScript. No private account controls render here.
//
// Privacy: these pages are reachable from QR codes and must never be indexed
// or leak the referring URL. We force dynamic rendering so the no-store cache
// headers below are emitted on every response and shared proxies cannot retain
// the sensitive payload.

export const dynamic = 'force-dynamic';

export const dynamicParams = true;

export function generateStaticParams() {
  return [];
}

interface EmergencyContact {
  label: string;
  value: string;
  href?: string;
}

interface EmergencyProfile {
  id: string;
  displayName: string;
  bloodType?: string;
  allergies?: string[];
  conditions?: string[];
  medications?: string[];
  contacts: EmergencyContact[];
  qrPath: string;
}

async function getEmergencyProfile(id: string): Promise<EmergencyProfile | null> {
  const baseUrl = process.env.EMERGENCY_API_URL;
  if (!baseUrl) {
    return null;
  }

  try {
    const res = await fetch(`${baseUrl}/emergency/${encodeURIComponent(id)}`, {
      cache: 'no-store',
    });
    if (!res.ok) {
      return null;
    }
    return (await res.json()) as EmergencyProfile;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const profile = await getEmergencyProfile(params.id);
  if (!profile) {
    return {
      title: 'Emergency profile not found',
      robots: { index: false, follow: false, noarchive: true },
      referrer: 'no-referrer',
    };
  }
  return {
    title: `${profile.displayName} — Emergency profile`,
    robots: { index: false, follow: false, noarchive: true },
    referrer: 'no-referrer',
  };
}

export default async function EmergencyProfilePage({
  params,
}: {
  params: { id: string };
}) {
  const profile = await getEmergencyProfile(params.id);

  if (!profile) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">{profile.displayName}</h1>
        <p className="mt-1 text-sm text-gray-600">Public emergency profile</p>
      </header>

      <section aria-labelledby="emergency-details" className="mb-6">
        <h2 id="emergency-details" className="text-lg font-medium">
          Emergency details
        </h2>
        <dl className="mt-2 space-y-1 text-sm">
          {profile.bloodType ? (
            <div className="flex gap-2">
              <dt className="font-medium">Blood type:</dt>
              <dd>{profile.bloodType}</dd>
            </div>
          ) : null}
          {profile.allergies?.length ? (
            <div className="flex gap-2">
              <dt className="font-medium">Allergies:</dt>
              <dd>{profile.allergies.join(', ')}</dd>
            </div>
          ) : null}
          {profile.conditions?.length ? (
            <div className="flex gap-2">
              <dt className="font-medium">Conditions:</dt>
              <dd>{profile.conditions.join(', ')}</dd>
            </div>
          ) : null}
          {profile.medications?.length ? (
            <div className="flex gap-2">
              <dt className="font-medium">Medications:</dt>
              <dd>{profile.medications.join(', ')}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      <section aria-labelledby="emergency-contacts" className="mb-6">
        <h2 id="emergency-contacts" className="text-lg font-medium">
          Emergency contacts
        </h2>
        <ul className="mt-2 space-y-1 text-sm">
          {profile.contacts.map((contact) => (
            <li key={`${contact.label}-${contact.value}`}>
              <span className="font-medium">{contact.label}: </span>
              {contact.href ? (
                <a className="underline" href={contact.href}>
                  {contact.value}
                </a>
              ) : (
                <span>{contact.value}</span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="emergency-qr" className="mb-6">
        <h2 id="emergency-qr" className="text-lg font-medium">
          QR code
        </h2>
        <p className="mt-2 text-sm">
          <a className="underline" href={profile.qrPath}>
            Open QR code
          </a>
        </p>
      </section>

      <aside
        role="note"
        className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
      >
        This is a read-only public emergency view. Account settings and private
        controls are not available here. If you need to manage this profile,
        sign in to your account.
      </aside>
    </main>
  );
}
