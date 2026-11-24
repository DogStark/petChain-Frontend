import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';

import { appointmentsAPI } from '@/lib/api/appointmentsAPI';
import { petAPI } from '@/lib/api/petAPI';
import { vaccinationsAPI, type VaccinationRecord } from '@/lib/api/vaccinationsAPI';
import type { PetEmergencyInfo } from '@/types/pet';

interface CareSetupChecklistProps {
  petId: string;
  petName: string;
  createdAt?: string;
}

interface CareSetupStep {
  id: 'vet' | 'emergency' | 'vaccinations' | 'appointments';
  label: string;
  description: string;
  href: string;
  linkLabel: string;
  complete: boolean;
}

const DISMISSED_STORAGE_PREFIX = 'care-setup-dismissed:';

function isRecentlyRegistered(createdAt?: string): boolean {
  if (!createdAt) return false;
  const registeredAt = new Date(createdAt).getTime();
  return (
    Number.isFinite(registeredAt) &&
    registeredAt <= Date.now() &&
    Date.now() - registeredAt <= 30 * 24 * 60 * 60 * 1000
  );
}

export default function CareSetupChecklist({
  petId,
  petName,
  createdAt,
}: CareSetupChecklistProps) {
  const [emergencyInfo, setEmergencyInfo] = useState<PetEmergencyInfo | null>(null);
  const [vaccinations, setVaccinations] = useState<VaccinationRecord[]>([]);
  const [hasUpcomingAppointment, setHasUpcomingAppointment] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [vaccineName, setVaccineName] = useState('');
  const [administeredDate, setAdministeredDate] = useState('');
  const [isSavingVaccination, setIsSavingVaccination] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);

  const loadChecklist = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [emergency, records, appointments] = await Promise.all([
        petAPI.getPetEmergencyInfo(petId),
        vaccinationsAPI.getByPetId(petId),
        appointmentsAPI.getUpcomingAppointments(),
      ]);
      setEmergencyInfo(emergency);
      setVaccinations(records);
      setHasUpcomingAppointment(
        appointments.some(
          ({ appointment }) =>
            appointment.petId === petId &&
            appointment.status === 'Scheduled' &&
            new Date(appointment.scheduledAt).getTime() >= Date.now()
        )
      );
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to load care setup status.');
    } finally {
      setIsLoading(false);
    }
  }, [petId]);

  useEffect(() => {
    void loadChecklist();
  }, [loadChecklist]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      setIsDismissed(window.localStorage.getItem(`${DISMISSED_STORAGE_PREFIX}${petId}`) === 'true');
    } catch {
      setIsDismissed(false);
    }
  }, [petId]);

  const dismissChecklist = useCallback(() => {
    setIsDismissed(true);
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(`${DISMISSED_STORAGE_PREFIX}${petId}`, 'true');
    } catch {
      // Ignore storage failures; dismissal still applies for this session.
    }
  }, [petId]);

  if (!isRecentlyRegistered(createdAt) || isDismissed) return null;

  const hasVet = Boolean(emergencyInfo?.emergencyVet?.name && emergencyInfo.emergencyVet.phone);
  const hasEmergencyContact = Boolean(
    emergencyInfo?.contacts?.some((contact) => contact.name.trim() && contact.phone.trim())
  );
  const steps: CareSetupStep[] = [
    {
      id: 'vet',
      label: 'Schedule the first vet visit',
      description: 'Book an initial checkup with a veterinarian.',
      href: '/appointments',
      linkLabel: 'Schedule',
      complete: hasUpcomingAppointment,
    },
    {
      id: 'vaccinations',
      label: 'Add vaccinations',
      description: 'Record your pet&apos;s vaccination history.',
      href: `/pets/${encodeURIComponent(petId)}#vaccinations`,
      linkLabel: 'Add',
      complete: vaccinations.length > 0,
    },
    {
      id: 'emergency',
      label: 'Add an emergency contact',
      description: 'Keep a reachable contact on file for emergencies.',
      href: `/profile?petId=${encodeURIComponent(petId)}`,
      linkLabel: 'Add',
      complete: hasEmergencyContact,
    },
    {
      id: 'vet',
      label: 'Add a veterinarian',
      description: 'Save your primary vet&apos;s details for quick access.',
      href: `/profile?petId=${encodeURIComponent(petId)}`,
      linkLabel: 'Add',
      complete: hasVet,
    },
  ];
  const completedCount = steps.filter((step) => step.complete).length;
  const allComplete = completedCount === steps.length;

  const saveVaccination = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!vaccineName.trim() || !administeredDate) return;
    setIsSavingVaccination(true);
    setSaveError(null);
    try {
      await vaccinationsAPI.create({
        petId,
        vaccineName: vaccineName.trim(),
        administeredDate,
      });
      setVaccineName('');
      setAdministeredDate('');
      await loadChecklist();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Unable to save vaccination history.');
    } finally {
      setIsSavingVaccination(false);
    }
  };

  return (
    <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm" aria-labelledby="care-setup-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="care-setup-title" className="text-lg font-semibold text-gray-900">
            Care setup for {petName}
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Your progress reflects information saved to your pet&apos;s records.
          </p>
        </div>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-800">
          {completedCount} of {steps.length} complete
        </span>
      </div>

      {isLoading ? (
        <p className="mt-4 text-sm text-gray-600" role="status">Checking saved care details…</p>
      ) : loadError ? (
        <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">
          <p>{loadError}</p>
          <button type="button" onClick={() => void loadChecklist()} className="mt-2 font-semibold underline">
            Retry
          </button>
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={() => void loadChecklist()}
            className="mt-3 text-sm font-medium text-blue-700 underline"
          >
            Refresh saved status
          </button>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {steps.map((step) => (
              <li key={step.label} className="flex items-start gap-2 rounded-lg bg-gray-50 p-3 text-sm">
                <span aria-hidden="true" className={step.complete ? 'text-green-700' : 'text-gray-400'}>
                  {step.complete ? '✓' : '○'}
                </span>
                <div className="flex-1">
                  <p className={step.complete ? 'text-gray-600 line-through' : 'font-medium text-gray-800'}>
                    {step.label}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">{step.description}</p>
                </div>
                {!step.complete && (
                  <Link className="ml-auto text-blue-700 underline" href={step.href}>
                    {step.linkLabel}
                  </Link>
                )}
              </li>
            ))}
          </ul>

          {!steps.find((step) => step.id === 'vaccinations')?.complete && (
            <form onSubmit={saveVaccination} className="mt-4 grid gap-3 rounded-xl border border-gray-200 p-4 sm:grid-cols-[1fr_180px_auto] sm:items-end">
              <label className="text-sm font-medium text-gray-700">
                Vaccine
                <input
                  required
                  value={vaccineName}
                  onChange={(event) => setVaccineName(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 p-2"
                  placeholder="e.g. Rabies"
                />
              </label>
              <label className="text-sm font-medium text-gray-700">
                Date given
                <input
                  required
                  type="date"
                  value={administeredDate}
                  onChange={(event) => setAdministeredDate(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 p-2"
                />
              </label>
              <button
                disabled={isSavingVaccination}
                type="submit"
                className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {isSavingVaccination ? 'Saving…' : 'Save vaccination'}
              </button>
              {saveError && <p className="text-sm text-red-700 sm:col-span-3" role="alert">{saveError}</p>}
            </form>
          )}

          {allComplete && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-green-50 p-3 text-sm text-green-800">
              <p>All care setup steps are complete. Nice work!</p>
              <button
                type="button"
                onClick={dismissChecklist}
                className="rounded-lg bg-green-700 px-3 py-1.5 font-semibold text-white"
              >
                Dismiss checklist
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
