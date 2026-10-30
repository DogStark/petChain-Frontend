import type { MaskKind } from '@/lib/privacy/maskIdentifiers';
import { maskValue } from '@/lib/privacy/maskIdentifiers';

/**
 * Builds the analytics export (CSV) and the preview that describes it.
 *
 * The preview and the downloaded file are produced from the same structure on
 * purpose: whatever the preview lists is exactly what the export contains.
 *
 * Personal identifiers are masked unless `includePersonalData` is explicitly
 * true. Callers must only pass `true` when the backend has authorised it —
 * see `useAnalyticsExportPreview`, which never flips that flag on its own.
 */

export interface AnalyticsExportData {
  engagementData: Array<{ date: string; activeUsers: number; newSignups: number }>;
  healthData: Array<{ name: string; value: number; color?: string }>;
  vaccinationData: Array<{ month: string; compliant: number; nonCompliant: number }>;
  geoData: Array<{ region: string; users: number }>;
  apiUsageData: Array<{ time: string; requests: number; errors: number }>;
  timestamp: string;
}

export interface ExportAccount {
  id?: string;
  email?: string;
}

export interface ExportField {
  key: string;
  label: string;
  containsPersonalData: boolean;
  /** Mask strategy; only set for personal-data fields. */
  mask?: MaskKind;
}

export interface ExportSection {
  id: string;
  title: string;
  fields: ExportField[];
  rows: Array<Record<string, string | number>>;
}

export interface ExportDateRange {
  /** Inclusive ISO date (YYYY-MM-DD). */
  startDate: string;
  /** Inclusive ISO date (YYYY-MM-DD). */
  endDate: string;
  /** Number of days covered, inclusive. */
  days: number;
}

export interface AnalyticsExport {
  /** ISO timestamp of the report, or `''` when the source timestamp is invalid. */
  generatedAt: string;
  /** Exact date range covered by the export; `null` when it cannot be derived. */
  dateRange: ExportDateRange | null;
  sections: ExportSection[];
  /** Total rows including the report-metadata row. */
  rowCount: number;
  /** Rows of actual analytics data (metadata excluded) — 0 means an empty export. */
  dataRowCount: number;
  /** True only when the backend authorised unmasked personal data. */
  personalDataIncluded: boolean;
  csv: string;
}

export interface BuildAnalyticsExportOptions {
  /** Must come from a backend decision — defaults to privacy-preserving false. */
  includePersonalData?: boolean;
  account?: ExportAccount | null;
  /** Overrides the source timestamp (used by tests). */
  generatedAt?: string;
}

const METADATA_FIELDS: ExportField[] = [
  { key: 'generated_at', label: 'Report generated', containsPersonalData: false },
  { key: 'range_start', label: 'Range start', containsPersonalData: false },
  { key: 'range_end', label: 'Range end', containsPersonalData: false },
];

const ACCOUNT_FIELDS: Record<'id' | 'email', ExportField> = {
  id: { key: 'account_id', label: 'Account ID', containsPersonalData: true, mask: 'identifier' },
  email: { key: 'account_email', label: 'Account email', containsPersonalData: true, mask: 'email' },
};

function field(key: string, label: string): ExportField {
  return { key, label, containsPersonalData: false };
}

function isValidDate(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && !Number.isNaN(Date.parse(value));
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Derives the exact date range covered by the export.
 *
 * The engagement series is one row per day ending on the report timestamp, so
 * a range spans `rows` days ending at that timestamp. It returns `null` when
 * the timestamp is unusable or the series is empty — callers must treat that
 * as "no dated rows", not as an infinite range.
 */
export function resolveExportDateRange(
  timestamp: string,
  dayRowCount: number,
  generatedAt?: string,
): ExportDateRange | null {
  const endSource = generatedAt ?? timestamp;
  if (!isValidDate(endSource)) return null;
  if (!Number.isFinite(dayRowCount) || dayRowCount < 1) return null;

  const end = new Date(endSource);
  const endDay = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  const startDay = endDay - (Math.floor(dayRowCount) - 1) * 24 * 60 * 60 * 1000;

  return {
    startDate: toIsoDate(new Date(startDay)),
    endDate: toIsoDate(new Date(endDay)),
    days: Math.floor(dayRowCount),
  };
}

function maskRow(
  fields: ExportField[],
  row: Record<string, string | number>,
  includePersonalData: boolean,
): Record<string, string | number> {
  const masked: Record<string, string | number> = {};
  for (const current of fields) {
    const value = row[current.key];
    if (value === undefined || value === null) continue;
    masked[current.key] =
      current.containsPersonalData && !includePersonalData && current.mask
        ? maskValue(current.mask, value)
        : value;
  }
  return masked;
}

function csvCell(value: string | number): string {
  const text = String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function toCsv(analyticsExport: Omit<AnalyticsExport, 'csv'>): string {
  const lines: string[] = [];

  for (const section of analyticsExport.sections) {
    lines.push(section.title);
    lines.push(section.fields.map((current) => current.key).join(','));
    for (const row of section.rows) {
      lines.push(section.fields.map((current) => csvCell(row[current.key] ?? '')).join(','));
    }
    lines.push('');
  }

  const header = [
    `Report Generated,${analyticsExport.generatedAt || 'unknown'}`,
    `Range Start,${analyticsExport.dateRange?.startDate ?? 'unavailable'}`,
    `Range End,${analyticsExport.dateRange?.endDate ?? 'unavailable'}`,
    `Personal Data,${analyticsExport.personalDataIncluded ? 'included' : 'masked'}`,
  ];

  return [...header, '', ...lines].join('\n');
}

/**
 * Reads the signed-in account (if any) used for the export metadata fields.
 * Returns `null` when nobody is signed in, so those fields are omitted from
 * the manifest entirely instead of being listed but never filled.
 */
export function readStoredExportAccount(): ExportAccount | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem('auth_user');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { id?: unknown; email?: unknown };
    const account: ExportAccount = {
      id: typeof parsed.id === 'string' && parsed.id ? parsed.id : undefined,
      email: typeof parsed.email === 'string' && parsed.email ? parsed.email : undefined,
    };
    return account.id || account.email ? account : null;
  } catch {
    return null;
  }
}

export function buildAnalyticsExport(
  data: AnalyticsExportData,
  options: BuildAnalyticsExportOptions = {},
): AnalyticsExport {
  const includePersonalData = options.includePersonalData === true;
  const generatedAt =
    options.generatedAt ?? (isValidDate(data.timestamp) ? new Date(data.timestamp).toISOString() : '');
  const dateRange = resolveExportDateRange(data.timestamp, data.engagementData.length, generatedAt);

  const metadataFields = [...METADATA_FIELDS];
  if (options.account?.id) metadataFields.push(ACCOUNT_FIELDS.id);
  if (options.account?.email) metadataFields.push(ACCOUNT_FIELDS.email);

  const metadataRow: Record<string, string | number> = {
    generated_at: generatedAt || 'unknown',
    range_start: dateRange?.startDate ?? 'unavailable',
    range_end: dateRange?.endDate ?? 'unavailable',
  };
  if (options.account?.id) metadataRow.account_id = options.account.id;
  if (options.account?.email) metadataRow.account_email = options.account.email;

  const sectionInputs: Array<Omit<ExportSection, 'rows'> & {
    rows: Array<Record<string, string | number>>;
  }> = [
    { id: 'metadata', title: 'Report metadata', fields: metadataFields, rows: [metadataRow] },
    {
      id: 'engagement',
      title: 'User Engagement',
      fields: [
        field('date', 'Date'),
        field('activeUsers', 'Active users'),
        field('newSignups', 'New signups'),
      ],
      rows: data.engagementData,
    },
    {
      id: 'health',
      title: 'Pet Health',
      fields: [field('name', 'Health status'), field('value', 'Pets')],
      rows: data.healthData.map(({ name, value }) => ({ name, value })),
    },
    {
      id: 'vaccination',
      title: 'Vaccination Compliance',
      fields: [
        field('month', 'Month'),
        field('compliant', 'Compliant (%)'),
        field('nonCompliant', 'Non-compliant (%)'),
      ],
      rows: data.vaccinationData,
    },
    {
      id: 'geographic',
      title: 'Geographic Distribution',
      fields: [
        { key: 'region', label: 'Region', containsPersonalData: true, mask: 'text' },
        field('users', 'Users'),
      ],
      rows: data.geoData,
    },
    {
      id: 'apiUsage',
      title: 'API Usage',
      rows: data.apiUsageData,
      fields: [
        field('time', 'Time'),
        field('requests', 'Requests'),
        field('errors', 'Errors'),
      ],
    },
  ];

  const sections: ExportSection[] = sectionInputs.map((section) => ({
    ...section,
    rows: section.rows.map((row) => maskRow(section.fields, row, includePersonalData)),
  }));

  const rowCount = sections.reduce((total, section) => total + section.rows.length, 0);
  const dataRowCount = sections
    .filter((section) => section.id !== 'metadata')
    .reduce((total, section) => total + section.rows.length, 0);

  const analyticsExport: AnalyticsExport = {
    generatedAt,
    dateRange,
    sections,
    rowCount,
    dataRowCount,
    personalDataIncluded: includePersonalData,
    csv: '',
  };

  return { ...analyticsExport, csv: toCsv(analyticsExport) };
}

/** Triggers a browser download of the built export. */
export function downloadAnalyticsExport(analyticsExport: AnalyticsExport): void {
  const blob = new Blob([analyticsExport.csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `analytics_report_${analyticsExport.generatedAt || 'export'}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
