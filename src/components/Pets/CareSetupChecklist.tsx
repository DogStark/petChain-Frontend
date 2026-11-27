import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';

import { appointmentsAPI } from '@/lib/api/appointmentsAPI';
import { petAPI } from '@/lib/api/petAPI';
import { vaccinationsAPI, type ReminderChannel, type VaccinationRecord } from '@/lib/api/vaccinationsAPI';
import type { PetEmergencyInfo } from '@/types/pet';

interface CareSetupChecklistProps {
  petId: string;
  petName: string;
  createdAt?: string;
}

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
  const [reminderFor, setReminderFor] = useState<VaccinationRecord | null>(null);
  const [reminderDate, setReminderDate] = useState('');
  const [reminderChannel, setReminderChannel] = useState<ReminderChannel>('email');
  const [isSavingReminder, setIsSavingReminder] = useState(false);
  const [reminderError, setReminderError] = useState<string | null>(null);
  const [reminderSuccess, setReminderSuccess] = useState<string | null>(null);

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

  if (!isRecentlyRegistered(createdAt)) return null;

  const hasVet = Boolean(emergencyInfo?.emergencyVet?.name && emergencyInfo.emergencyVet.phone);
  const hasEmergencyContact = Boolean(
    emergencyInfo?.contacts?.some((contact) => contact.name.trim() && contact.phone.trim())
  );
  const steps = [
    { label: 'Add a veterinarian', complete: hasVet },
    { label: 'Add an emergency contact', complete: hasEmergencyContact },
    { label: 'Add vaccination history', complete: vaccinations.length > 0 },
    { label: 'Schedule the next appointment', complete: hasUpcomingAppointment },
  ];
  const completedCount = steps.filter((step) => step.complete).length;

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

  const openReminderForm = (record: VaccinationRecord) => {
    setReminderFor(record);
    setReminderDate(record.nextDueDate ? record.nextDueDate.slice(0, 10) : '');
    setReminderChannel('email');
    setReminderError(null);
    setReminderSuccess(null);
  };

  const saveReminder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!reminderFor || !reminderDate) return;
    setIsSavingReminder(true);
    setReminderError(null);
    setReminderSuccess(null);
    try {
      await vaccinationsAPI.createReminder({
        petId,
        vaccinationId: reminderFor.id,
        reminderDate,
        channel: reminderChannel,
      });
      setReminderSuccess(
        `Reminder set for ${reminderFor.vaccineName} on ${reminderDate} via ${reminderChannel}.`
      );
      setReminderFor(null);
    } catch (error) {
      setReminderError(error instanceof Error ? error.message : 'Unable to set vaccination reminder.');
    } finally {
      setIsSavingReminder(false);
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
              <li key={step.label} className="flex items-center gap-2 rounded-lg bg-gray-50 p-3 text-sm">
                <span aria-hidden="true" className={step.complete ? 'text-green-700' : 'text-gray-400'}>
                  {step.complete ? '✓' : '○'}
                </span>
                <span className={step.complete ? 'text-gray-600 line-through' : 'font-medium text-gray-800'}>
                  {step.label}
                </span>
                {step.label === 'Add a veterinarian' && !step.complete && (
                  <Link className="ml-auto text-blue-700 underline" href={`/profile?petId=${encodeURIComponent(petId)}`}>
                    Add
                  </Link>
                )}
                {step.label === 'Add an emergency contact' && !step.complete && (
                  <Link className="ml-auto text-blue-700 underline" href={`/profile?petId=${encodeURIComponent(petId)}`}>
                    Add
                  </Link>
                )}
                {step.label === 'Schedule the next appointment' && !step.complete && (
                  <Link className="ml-auto text-blue-700 underline" href="/appointments">
                    Schedule
                  </Link>
                )}
              </li>
            ))}
          </ul>

          {!steps[2].complete && (
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
          {vaccinations.length > 0 && (
            <div className="mt-4 rounded-xl border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-900">Vaccination reminders</h3>
              <ul className="mt-2 grid gap-2">
                {vaccinations.map((record) => (
                  <li
                    key={record.id}
                    className="flex flex-wrap items-center gap-2 rounded-lg bg-gray-50 p-3 text-sm"
                  >
                    <span className="font-medium text-gray-800">{record.vaccineName}</span>
                    <span className="text-gray-600">
                      {record.nextDueDate ? `Due ${record.nextDueDate.slice(0, 10)}` : 'No due date'}
                    </span>
                    <button
                      type="button"
                      onClick={() => openReminderForm(record)}
                      className="ml-auto rounded-lg border border-blue-700 px-3 py-1 font-semibold text-blue-700"
                      aria-label={`Set reminder for ${record.vaccineName}`}
                    >
                      Set reminder
                    </button>
                  </li>
                ))}
              </ul>

              {reminderFor && (
                <form
                  onSubmit={saveReminder}
                  className="mt-3 grid gap-3 rounded-lg border border-blue-100 bg-blue-50 p-3 sm:grid-cols-[180px_180px_auto] sm:items-end"
                >
                  <label className="text-sm font-medium text-gray-700">
                    Reminder date
                    <input
                      required
                      type="date"
                      value={reminderDate}
                      onChange={(event) => setReminderDate(event.target.value)}
                      className="mt-1 w-full rounded-lg border border-gray-300 p-2"
                    />
                  </label>
                  <label className="text-sm font-medium text-gray-700">
                    Notification channel
                    <select
                      value={reminderChannel}
                      onChange={(event) => setReminderChannel(event.target.value as ReminderChannel)}
                      className="mt-1 w-full rounded-lg border border-gray-300 p-2"
                    >
                      <option value="push">Push</option>
                      <option value="email">Email</option>
                      <option value="sms">SMS</option>
                    </select>
                  </label>
                  <div className="flex gap-2">
                    <button
                      disabled={isSavingReminder}
                      type="submit"
                      className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {isSavingReminder ? 'Saving…' : 'Save reminder'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setReminderFor(null)}
                      className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700"
                    >
                      Cancel
                    </button>
                  </div>
                  {reminderError && (
                    <p className="text-sm text-red-700 sm:col-span-3" role="alert">{reminderError}</p>
                  )}
                </form>
              )}
              {reminderSuccess && (
                <p className="mt-2 text-sm font-medium text-green-800" role="status">{reminderSuccess}</p>
              )}
            </div>
          )}
          {completedCount === steps.length && (
            <p className="mt-4 text-sm font-medium text-green-800" role="status">
              Care setup is complete. All four items are confirmed in saved records.
            </p>
          )}
        </>
      )}
    </section>
  );
}
