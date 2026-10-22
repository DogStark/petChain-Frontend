import React, { useMemo } from 'react';

export interface PetIdentityField {
  key: string;
  label: string;
  value: string;
}

export interface PetIdentityCardProps {
  petName: string;
  species?: string;
  breed?: string;
  /** Owner-selected identity/contact fields to print on the card. */
  fields: PetIdentityField[];
  /** ISO timestamp of when the card was issued. */
  issuedAt: string;
  /** Public profile slug/id; QR is only rendered when public profile is enabled. */
  publicProfileId?: string;
  /** Backend-owned privacy decision: whether the public profile is visible. */
  publicProfileEnabled: boolean;
  /** Base URL for public profiles; defaults to the app origin. */
  publicProfileBaseUrl?: string;
}

function formatIssuedAt(issuedAt: string): string {
  const date = new Date(issuedAt);
  if (Number.isNaN(date.getTime())) {
    return issuedAt;
  }
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function buildPublicProfileUrl(
  baseUrl: string,
  publicProfileId: string,
): string {
  const trimmed = baseUrl.replace(/\/+$/, '');
  return `${trimmed}/pets/${encodeURIComponent(publicProfileId)}`;
}

export const PetIdentityCard: React.FC<PetIdentityCardProps> = ({
  petName,
  species,
  breed,
  fields,
  issuedAt,
  publicProfileId,
  publicProfileEnabled,
  publicProfileBaseUrl,
}) => {
  const publicProfileUrl = useMemo(() => {
    if (!publicProfileEnabled || !publicProfileId) {
      return null;
    }
    const baseUrl =
      publicProfileBaseUrl ??
      (typeof window !== 'undefined' ? window.location.origin : '');
    if (!baseUrl) {
      return null;
    }
    return buildPublicProfileUrl(baseUrl, publicProfileId);
  }, [publicProfileEnabled, publicProfileId, publicProfileBaseUrl]);

  const qrSrc = publicProfileUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(
        publicProfileUrl,
      )}`
    : null;

  const visibleFields = fields.filter(
    (field) => field.value && field.value.trim().length > 0,
  );

  return (
    <section
      aria-labelledby="pet-identity-card-heading"
      className="pet-identity-card"
      style={{
        border: '1px solid #d0d7de',
        borderRadius: 8,
        padding: 16,
        maxWidth: 420,
        background: '#fff',
      }}
    >
      <header>
        <h2 id="pet-identity-card-heading" style={{ margin: 0 }}>
          {petName}
        </h2>
        {(species || breed) && (
          <p style={{ margin: '4px 0 0', color: '#57606a' }}>
            {[species, breed].filter(Boolean).join(' \u00b7 ')}
          </p>
        )}
      </header>

      {visibleFields.length > 0 ? (
        <dl style={{ margin: '12px 0 0' }}>
          {visibleFields.map((field) => (
            <div key={field.key} style={{ marginBottom: 8 }}>
              <dt style={{ fontWeight: 600 }}>{field.label}</dt>
              <dd style={{ margin: 0 }}>{field.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p style={{ margin: '12px 0 0', color: '#57606a' }}>
          No identity or contact fields selected.
        </p>
      )}

      <footer style={{ marginTop: 12 }}>
        <p style={{ margin: 0, fontSize: 12, color: '#57606a' }}>
          Issued: <time dateTime={issuedAt}>{formatIssuedAt(issuedAt)}</time>
        </p>

        {publicProfileUrl && qrSrc ? (
          <div style={{ marginTop: 8 }}>
            <img
              src={qrSrc}
              alt={`QR code linking to ${petName}'s public profile`}
              width={120}
              height={120}
            />
            <p style={{ margin: '4px 0 0', fontSize: 12 }}>
              <a href={publicProfileUrl} rel="noopener noreferrer" target="_blank">
                View public profile
              </a>
            </p>
          </div>
        ) : (
          <p style={{ margin: '8px 0 0', fontSize: 12, color: '#57606a' }}>
            Public profile is private; no QR link is included.
          </p>
        )}
      </footer>
    </section>
  );
};

export default PetIdentityCard;
