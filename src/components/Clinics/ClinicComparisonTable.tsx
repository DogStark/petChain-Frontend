import React from 'react';
import type { ComparableClinic } from '../../hooks/useClinicComparison';

export interface ClinicComparisonTableProps {
  clinics: ComparableClinic[];
  onRemove?: (id: string) => void;
  onClear?: () => void;
  caption?: string;
}

function formatRating(clinic: ComparableClinic): string {
  const count = clinic.reviewCount;
  return count != null ? `${clinic.rating.toFixed(1)} (${count})` : clinic.rating.toFixed(1);
}

function formatDistance(clinic: ComparableClinic): string {
  return clinic.distanceKm != null ? `${clinic.distanceKm.toFixed(1)} km` : '—';
}

function formatServices(clinic: ComparableClinic): string {
  return clinic.services.length > 0 ? clinic.services.join(', ') : '—';
}

export function ClinicComparisonTable({
  clinics,
  onRemove,
  onClear,
  caption = 'Clinic comparison',
}: ClinicComparisonTableProps): JSX.Element | null {
  if (clinics.length === 0) return null;

  return (
    <section aria-label={caption} className="clinic-comparison">
      <div className="clinic-comparison__header">
        <h2 className="clinic-comparison__title">{caption}</h2>
        {onClear && (
          <button type="button" className="clinic-comparison__clear" onClick={onClear}>
            Clear comparison
          </button>
        )}
      </div>
      <div className="clinic-comparison__scroll">
        <table className="clinic-comparison__table">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              <th scope="col">Attribute</th>
              {clinics.map((clinic) => (
                <th key={clinic.id} scope="col">
                  <span className="clinic-comparison__name">{clinic.name}</span>
                  {onRemove && (
                    <button
                      type="button"
                      className="clinic-comparison__remove"
                      onClick={() => onRemove(clinic.id)}
                      aria-label={`Remove ${clinic.name} from comparison`}
                    >
                      Remove
                    </button>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Services</th>
              {clinics.map((clinic) => (
                <td key={clinic.id}>{formatServices(clinic)}</td>
              ))}
            </tr>
            <tr>
              <th scope="row">Rating</th>
              {clinics.map((clinic) => (
                <td key={clinic.id}>{formatRating(clinic)}</td>
              ))}
            </tr>
            <tr>
              <th scope="row">Hours</th>
              {clinics.map((clinic) => (
                <td key={clinic.id}>{clinic.hours ?? '—'}</td>
              ))}
            </tr>
            <tr>
              <th scope="row">Distance</th>
              {clinics.map((clinic) => (
                <td key={clinic.id}>{formatDistance(clinic)}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default ClinicComparisonTable;
