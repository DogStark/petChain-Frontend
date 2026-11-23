'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useEmergencyProfile } from '@/hooks/useEmergencyProfile';
import { EmergencyProfileForm } from '@/components/emergency/EmergencyProfileForm';
import {
  closeLostPetReport,
  createLostPetReport,
  getLostPetReport,
  type LostPetReport,
} from '@/lib/api/emergencyProfile';

interface PetProfile {
  id: string;
  name: string;
  species?: string;
  breed?: string;
  color?: string;
  photoUrl?: string;
}

interface PetProfilePageProps {
  pet?: PetProfile;
}

function PublicDetailsPreview({ report }: { report: LostPetReport }) {
  return (
    <section aria-labelledby="lost-pet-public-details" className="lost-pet-preview">
      <h3 id="lost-pet-public-details">Public details shown on the scan page</h3>
      <dl>
        <dt>Pet name</dt>
        <dd>{report.petName || 'Not provided'}</dd>
        <dt>Species</dt>
        <dd>{report.species || 'Not provided'}</dd>
        <dt>Breed</dt>
        <dd>{report.breed || 'Not provided'}</dd>
        <dt>Color / markings</dt>
        <dd>{report.color || 'Not provided'}</dd>
        <dt>Last seen</dt>
        <dd>{report.lastSeenLocation || 'Not provided'}</dd>
        <dt>Contact</dt>
        <dd>{report.contactInfo || 'Not provided'}</dd>
        <dt>Notes</dt>
        <dd>{report.notes || 'Not provided'}</dd>
      </dl>
      <p className="lost-pet-preview__privacy">
        Only the details above are shared publicly while the alert is active. Your
        emergency medical profile stays private.
      </p>
    </section>
  );
}

export default function PetProfilePage({ pet }: PetProfilePageProps) {
  const params = useParams<{ id: string }>();
  const petId = pet?.id ?? params?.id;
  const { profile, loading: profileLoading, error: profileError } = useEmergencyProfile(petId);

  const [report, setReport] = useState<LostPetReport | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    lastSeenLocation: '',
    contactInfo: '',
    notes: '',
  });

  const loadReport = useCallback(async () => {
    if (!petId) return;
    setLoadingReport(true);
    setError(null);
    try {
      const existing = await getLostPetReport(petId);
      setReport(existing);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load lost-pet report.');
    } finally {
      setLoadingReport(false);
    }
  }, [petId]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  const publicDetails = useMemo<LostPetReport | null>(() => {
    if (!report) return null;
    return {
      ...report,
      petName: report.petName || pet?.name || '',
      species: report.species || pet?.species || '',
      breed: report.breed || pet?.breed || '',
      color: report.color || pet?.color || '',
    };
  }, [report, pet]);

  const handleMarkMissing = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!petId) return;
    setSubmitting(true);
    setError(null);
    setStatusMessage(null);
    try {
      const created = await createLostPetReport(petId, {
        lastSeenLocation: form.lastSeenLocation.trim(),
        contactInfo: form.contactInfo.trim(),
        notes: form.notes.trim(),
      });
      setReport(created);
      setShowForm(false);
      setStatusMessage('Lost-pet alert is now active.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create lost-pet alert.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseAlert = async () => {
    if (!petId) return;
    setSubmitting(true);
    setError(null);
    setStatusMessage(null);
    try {
      await closeLostPetReport(petId);
      setReport(null);
      setStatusMessage('Lost-pet alert closed. Welcome home!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to close lost-pet alert.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!petId) {
    return (
      <main className="pet-profile">
        <p role="alert">No pet selected.</p>
      </main>
    );
  }

  return (
    <main className="pet-profile">
      <h1>{pet?.name ? `${pet.name}'s profile` : 'Pet profile'}</h1>

      {profileError ? (
        <p role="alert" className="pet-profile__error">
          {profileError}
        </p>
      ) : null}

      <section aria-labelledby="lost-pet-heading" className="lost-pet">
        <h2 id="lost-pet-heading">Lost-pet report</h2>

        {statusMessage ? (
          <p role="status" className="lost-pet__status">
            {statusMessage}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="lost-pet__error">
            {error}
          </p>
        ) : null}

        {loadingReport ? (
          <p aria-live="polite">Loading lost-pet status…</p>
        ) : report ? (
          <div className="lost-pet__active">
            <p role="status">
              This pet is marked missing. The alert is visible on the emergency scan
              page.
            </p>
            {publicDetails ? <PublicDetailsPreview report={publicDetails} /> : null}
            <button
              type="button"
              onClick={handleCloseAlert}
              disabled={submitting}
              aria-busy={submitting}
            >
              {submitting ? 'Closing alert…' : 'Mark as recovered and close alert'}
            </button>
          </div>
        ) : showForm ? (
          <form onSubmit={handleMarkMissing} aria-labelledby="lost-pet-heading">
            <p>
              These details will be shown publicly on the emergency scan page while
              the alert is active. Your emergency medical profile stays private.
            </p>
            <label htmlFor="lastSeenLocation">Last seen location</label>
            <input
              id="lastSeenLocation"
              name="lastSeenLocation"
              value={form.lastSeenLocation}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, lastSeenLocation: e.target.value }))
              }
              required
            />
            <label htmlFor="contactInfo">Contact info for finders</label>
            <input
              id="contactInfo"
              name="contactInfo"
              value={form.contactInfo}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, contactInfo: e.target.value }))
              }
              required
            />
            <label htmlFor="notes">Notes (optional)</label>
            <textarea
              id="notes"
              name="notes"
              value={form.notes}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
            />
            <div className="lost-pet__actions">
              <button type="submit" disabled={submitting} aria-busy={submitting}>
                {submitting ? 'Activating alert…' : 'Activate lost-pet alert'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                disabled={submitting}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="lost-pet__idle">
            <p>This pet is not currently marked missing.</p>
            <button type="button" onClick={() => setShowForm(true)}>
              Mark pet as missing
            </button>
          </div>
        )}
      </section>

      <section aria-labelledby="emergency-profile-heading" className="pet-profile__emergency">
        <h2 id="emergency-profile-heading">Emergency profile</h2>
        {profileLoading ? (
          <p aria-live="polite">Loading emergency profile…</p>
        ) : (
          <EmergencyProfileForm petId={petId} initialProfile={profile} />
        )}
      </section>
    </main>
  );
}
