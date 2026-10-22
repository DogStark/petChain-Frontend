import React, { useMemo } from 'react';

export interface ClinicOpeningHours {
  day: string;
  open: string;
  close: string;
  closed?: boolean;
}

export interface ClinicCredential {
  name: string;
  verified: boolean;
  expiresAt?: string;
}

export interface ClinicComparisonData {
  id: string;
  name: string;
  distanceKm?: number;
  services?: string[];
  openingHours?: ClinicOpeningHours[];
  credentials?: ClinicCredential[];
}

export interface ClinicComparisonProps {
  clinics: ClinicComparisonData[];
  /** ISO timestamp of when the comparison data was retrieved. */
  dataTimestamp?: string;
  /** Optional message shown when the backend denies access or returns no clinics. */
  deniedMessage?: string;
  loading?: boolean;
}

const formatDistance = (distanceKm?: number): string => {
  if (distanceKm === undefined || distanceKm === null || Number.isNaN(distanceKm)) {
    return 'Not available';
  }
  return `${distanceKm.toFixed(1)} km`;
};

const formatTimestamp = (timestamp?: string): string => {
  if (!timestamp) {
    return 'Timestamp unavailable';
  }
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) {
    return 'Timestamp unavailable';
  }
  return parsed.toLocaleString();
};

const formatOpeningHours = (hours?: ClinicOpeningHours[]): string => {
  if (!hours || hours.length === 0) {
    return 'Not available';
  }
  return hours
    .map((entry) =>
      entry.closed
        ? `${entry.day}: Closed`
        : `${entry.day}: ${entry.open} - ${entry.close}`,
    )
    .join('; ');
};

const formatServices = (services?: string[]): string => {
  if (!services || services.length === 0) {
    return 'Not available';
  }
  return services.join(', ');
};

const formatCredentials = (credentials?: ClinicCredential[]): string => {
  if (!credentials || credentials.length === 0) {
    return 'Not available';
  }
  return credentials
    .map((credential) =>
      credential.verified
        ? `${credential.name} (verified)`
        : `${credential.name} (unverified)`,
    )
    .join('; ');
};

const ClinicComparison: React.FC<ClinicComparisonProps> = ({
  clinics,
  dataTimestamp,
  deniedMessage,
  loading = false,
}) => {
  const hasClinics = clinics.length > 0;

  const rows = useMemo(
    () => [
      {
        key: 'distance',
        label: 'Distance',
        render: (clinic: ClinicComparisonData) => formatDistance(clinic.distanceKm),
      },
      {
        key: 'services',
        label: 'Services',
        render: (clinic: ClinicComparisonData) => formatServices(clinic.services),
      },
      {
        key: 'hours',
        label: 'Opening hours',
        render: (clinic: ClinicComparisonData) => formatOpeningHours(clinic.openingHours),
      },
      {
        key: 'credentials',
        label: 'Verified credentials',
        render: (clinic: ClinicComparisonData) => formatCredentials(clinic.credentials),
      },
    ],
    [],
  );

  if (loading) {
    return (
      <section aria-busy="true" aria-live="polite" className="clinic-comparison">
        <p>Loading clinic comparison…</p>
      </section>
    );
  }

  if (deniedMessage) {
    return (
      <section role="alert" className="clinic-comparison clinic-comparison--denied">
        <p>{deniedMessage}</p>
      </section>
    );
  }

  if (!hasClinics) {
    return (
      <section aria-live="polite" className="clinic-comparison clinic-comparison--empty">
        <p>Select at least two clinics to compare.</p>
      </section>
    );
  }

  return (
    <section aria-labelledby="clinic-comparison-heading" className="clinic-comparison">
      <h2 id="clinic-comparison-heading">Clinic comparison</h2>
      <p className="clinic-comparison__timestamp">
        Data as of: <time dateTime={dataTimestamp}>{formatTimestamp(dataTimestamp)}</time>
      </p>
      <div className="clinic-comparison__table-wrapper" tabIndex={0} role="region" aria-label="Clinic comparison table">
        <table className="clinic-comparison__table">
          <caption className="sr-only">
            Comparison of selected clinics on distance, services, opening hours, and verified credentials.
          </caption>
          <thead>
            <tr>
              <th scope="col">Attribute</th>
              {clinics.map((clinic) => (
                <th key={clinic.id} scope="col">
                  {clinic.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <th scope="row">{row.label}</th>
                {clinics.map((clinic) => (
                  <td key={`${clinic.id}-${row.key}`}>{row.render(clinic)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default ClinicComparison;
