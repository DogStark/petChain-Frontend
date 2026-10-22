import React from 'react';

export type ProfileFieldSource = 'owner' | 'vet' | 'chain';

export interface ProfileFieldAttestation {
  key: string;
  label: string;
  source: ProfileFieldSource;
  present: boolean;
  /** Backend-provided guidance on how to improve coverage for this field. */
  guidance?: string;
}

export interface ProfileCompletenessReviewData {
  /** Fields the backend has authorized the viewer to see. */
  fields: ProfileFieldAttestation[];
  /** Backend-owned consent decision; when false, no field details are rendered. */
  consentGranted: boolean;
  /** Optional backend-provided message for denied/empty states. */
  message?: string;
}

export interface ProfileCompletenessReviewProps {
  data: ProfileCompletenessReviewData | null;
  loading?: boolean;
}

const SOURCE_ORDER: ProfileFieldSource[] = ['owner', 'vet', 'chain'];

const SOURCE_LABELS: Record<ProfileFieldSource, string> = {
  owner: 'Owner-entered',
  vet: 'Vet-verified',
  chain: 'Chain-anchored',
};

const SOURCE_DESCRIPTIONS: Record<ProfileFieldSource, string> = {
  owner: 'Details you provided directly.',
  vet: 'Details attested by a verified veterinarian.',
  chain: 'Details anchored on-chain for tamper-evident proof.',
};

function coverageFor(fields: ProfileFieldAttestation[]): { present: number; total: number } {
  const total = fields.length;
  const present = fields.filter((f) => f.present).length;
  return { present, total };
}

export function ProfileCompletenessReview({ data, loading }: ProfileCompletenessReviewProps) {
  if (loading) {
    return (
      <section aria-labelledby="profile-completeness-heading" aria-busy="true">
        <h2 id="profile-completeness-heading">Profile completeness</h2>
        <p role="status">Loading profile completeness…</p>
      </section>
    );
  }

  if (!data || !data.consentGranted) {
    return (
      <section aria-labelledby="profile-completeness-heading">
        <h2 id="profile-completeness-heading">Profile completeness</h2>
        <p role="status">
          {data?.message ??
            'Profile completeness details are not available. Consent is required to review attested fields.'}
        </p>
      </section>
    );
  }

  if (data.fields.length === 0) {
    return (
      <section aria-labelledby="profile-completeness-heading">
        <h2 id="profile-completeness-heading">Profile completeness</h2>
        <p role="status">No profile fields are available to review yet.</p>
      </section>
    );
  }

  const overall = coverageFor(data.fields);

  return (
    <section aria-labelledby="profile-completeness-heading">
      <h2 id="profile-completeness-heading">Profile completeness</h2>
      <p>
        {overall.present} of {overall.total} fields complete.
      </p>
      {SOURCE_ORDER.map((source) => {
        const fields = data.fields.filter((f) => f.source === source);
        if (fields.length === 0) {
          return null;
        }
        const { present, total } = coverageFor(fields);
        const headingId = `profile-completeness-${source}`;
        return (
          <div key={source}>
            <h3 id={headingId}>
              {SOURCE_LABELS[source]} ({present}/{total})
            </h3>
            <p>{SOURCE_DESCRIPTIONS[source]}</p>
            <ul aria-labelledby={headingId}>
              {fields.map((field) => (
                <li key={field.key}>
                  <span>{field.label}</span>{' '}
                  <span>{field.present ? 'Complete' : 'Missing'}</span>
                  {!field.present && field.guidance ? (
                    <span> — {field.guidance}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </section>
  );
}

export default ProfileCompletenessReview;
