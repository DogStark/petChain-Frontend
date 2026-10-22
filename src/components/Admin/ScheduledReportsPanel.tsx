import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { isAxiosError } from 'axios';
import { AlertCircle, Calendar, CheckCircle2 } from 'lucide-react';
import type {
  ReportRecipientScope,
  ReportSchedule,
  ReportScheduleFrequency,
  ReportScheduleInput,
  ScheduledReportType,
} from '@/lib/api/reportSchedulesAPI';
import { reportSchedulesAPI } from '@/lib/api/reportSchedulesAPI';

const reportOptions: { value: ScheduledReportType; label: string }[] = [
  { value: 'activity', label: 'User activity' },
  { value: 'financial', label: 'Financial' },
  { value: 'health', label: 'Health trends' },
  { value: 'usage', label: 'System usage' },
];

const frequencyOptions: { value: ReportScheduleFrequency; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

function localDateTimeValue(date: Date): string {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
}

function formatScheduleDate(value: string, timezone: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: timezone,
    }).format(date);
  } catch {
    return value;
  }
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (isAxiosError(error)) {
    if (error.response?.status === 401 || error.response?.status === 403) {
      return 'You are not authorized to manage scheduled reports.';
    }
  }

  return error instanceof Error ? error.message : fallback;
}

export default function ScheduledReportsPanel() {
  const [schedules, setSchedules] = useState<ReportSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [reportType, setReportType] = useState<ScheduledReportType>('activity');
  const [frequency, setFrequency] = useState<ReportScheduleFrequency>('weekly');
  const [startsAt, setStartsAt] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [recipientScope, setRecipientScope] = useState<ReportRecipientScope>('requesting_admin');
  const [expiresAt, setExpiresAt] = useState('');

  useEffect(() => {
    const now = new Date();
    const firstRun = new Date(now);
    firstRun.setDate(firstRun.getDate() + 1);
    firstRun.setHours(9, 0, 0, 0);
    const expiry = new Date(now);
    expiry.setDate(expiry.getDate() + 7);
    expiry.setHours(23, 59, 0, 0);
    setStartsAt(localDateTimeValue(firstRun));
    setExpiresAt(localDateTimeValue(expiry));
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');

    let active = true;
    reportSchedulesAPI.list().then(
      (items) => {
        if (active) {
          setSchedules(items);
          setLoading(false);
        }
      },
      (error: unknown) => {
        if (active) {
          setLoadError(getErrorMessage(error, 'Scheduled reports could not be loaded.'));
          setLoading(false);
        }
      }
    );

    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError(null);
    setSuccessMessage(null);

    if (expiresAt <= startsAt) {
      setSubmitError('Expiry must be later than the first scheduled delivery.');
      return;
    }

    try {
      new Intl.DateTimeFormat(undefined, { timeZone: timezone });
    } catch {
      setSubmitError('Enter a valid IANA timezone, such as America/Los_Angeles.');
      return;
    }

    const input: ReportScheduleInput = {
      reportType,
      frequency,
      startsAt,
      timezone,
      recipientScope,
      expiresAt,
    };

    setSubmitting(true);
    try {
      const created = await reportSchedulesAPI.create(input);
      setSchedules((current) => [...current, created]);
      setSuccessMessage('Report schedule created.');
    } catch (error) {
      setSubmitError(getErrorMessage(error, 'The report schedule could not be saved.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section
      aria-labelledby="scheduled-reports-heading"
      className="bg-white p-6 md:p-8 rounded-3xl shadow-lg border border-slate-100 animate-in fade-in slide-in-from-bottom-4 duration-500 print:hidden"
    >
      <h2 id="scheduled-reports-heading" className="text-xl font-bold text-slate-800 mb-2">
        Automated Report Deliveries
      </h2>
      <p className="text-sm text-slate-600 mb-6">
        Schedules are private by default. Reports are delivered only to the selected administrator
        scope and are never published as public links.
      </p>

      {loadError && (
        <div role="alert" className="mb-6 flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
          <AlertCircle aria-hidden="true" className="w-5 h-5 shrink-0" />
          <span>{loadError}</span>
        </div>
      )}

      {!loadError && (
        <form onSubmit={handleSubmit} className="space-y-5" aria-describedby="schedule-privacy-note">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label htmlFor="scheduled-report-type" className="block text-sm font-medium text-slate-700 mb-1">
                Report
              </label>
              <select
                id="scheduled-report-type"
                value={reportType}
                onChange={(event) => setReportType(event.target.value as ScheduledReportType)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              >
                {reportOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="scheduled-report-frequency" className="block text-sm font-medium text-slate-700 mb-1">
                Frequency
              </label>
              <select
                id="scheduled-report-frequency"
                value={frequency}
                onChange={(event) => setFrequency(event.target.value as ReportScheduleFrequency)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              >
                {frequencyOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="scheduled-report-start" className="block text-sm font-medium text-slate-700 mb-1">
                First delivery
              </label>
              <input
                id="scheduled-report-start"
                type="datetime-local"
                required
                value={startsAt}
                onChange={(event) => setStartsAt(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </div>
            <div>
              <label htmlFor="scheduled-report-timezone" className="block text-sm font-medium text-slate-700 mb-1">
                Timezone (IANA)
              </label>
              <input
                id="scheduled-report-timezone"
                type="text"
                required
                value={timezone}
                onChange={(event) => setTimezone(event.target.value)}
                placeholder="America/Los_Angeles"
                autoComplete="off"
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </div>
            <div>
              <label htmlFor="scheduled-report-expiry" className="block text-sm font-medium text-slate-700 mb-1">
                Schedule expires
              </label>
              <input
                id="scheduled-report-expiry"
                type="datetime-local"
                required
                value={expiresAt}
                onChange={(event) => setExpiresAt(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </div>
          </div>

          <fieldset>
            <legend className="block text-sm font-medium text-slate-700 mb-2">Deliver to</legend>
            <div className="space-y-2">
              <label className="flex items-start gap-2 text-sm text-slate-700">
                <input
                  type="radio"
                  name="report-recipient-scope"
                  value="requesting_admin"
                  checked={recipientScope === 'requesting_admin'}
                  onChange={() => setRecipientScope('requesting_admin')}
                  className="mt-1"
                />
                <span>Only me (the requesting administrator)</span>
              </label>
              <label className="flex items-start gap-2 text-sm text-slate-700">
                <input
                  type="radio"
                  name="report-recipient-scope"
                  value="admin_team"
                  checked={recipientScope === 'admin_team'}
                  onChange={() => setRecipientScope('admin_team')}
                  className="mt-1"
                />
                <span>Authorized administrators</span>
              </label>
            </div>
            <p id="schedule-privacy-note" className="text-xs text-slate-500 mt-2">
              The server verifies access and recipient consent before creating a schedule.
            </p>
          </fieldset>

          {submitError && <p role="alert" className="text-sm text-red-700">{submitError}</p>}
          {successMessage && (
            <p role="status" className="flex items-center gap-2 text-sm text-green-700">
              <CheckCircle2 aria-hidden="true" className="w-4 h-4" />
              {successMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || !startsAt || !expiresAt || !timezone.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl font-medium inline-flex items-center gap-2"
          >
            <Calendar aria-hidden="true" className="w-4 h-4" />
            {submitting ? 'Creating schedule...' : 'Schedule report'}
          </button>
        </form>
      )}

      <div className="mt-8 border-t border-slate-200 pt-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Existing schedules</h3>
        {loading ? (
          <p role="status" className="text-sm text-slate-600">Loading scheduled reports...</p>
        ) : loadError ? null : schedules.length === 0 ? (
          <p className="text-sm text-slate-600">No reports are scheduled.</p>
        ) : (
          <ul className="space-y-3">
            {schedules.map((schedule) => (
              <li key={schedule.id} className="rounded-lg border border-slate-200 p-4">
                <p className="font-medium text-slate-800">
                  {reportOptions.find((option) => option.value === schedule.reportType)?.label ?? 'Report'} - {schedule.frequency}
                </p>
                <p className="text-sm text-slate-600">
                  {formatScheduleDate(schedule.startsAt, schedule.timezone)} ({schedule.timezone}) - Expires{' '}
                  {formatScheduleDate(schedule.expiresAt, schedule.timezone)}
                </p>
                <p className="text-sm text-slate-600">
                  Recipients: {schedule.recipientScope === 'admin_team' ? 'authorized administrators' : 'requesting administrator'}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
