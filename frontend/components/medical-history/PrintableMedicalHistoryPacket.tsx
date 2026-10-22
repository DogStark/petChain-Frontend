'use client';

import { useMemo, useState } from 'react';

export type MedicalHistoryCategory =
  | 'visits'
  | 'vaccinations'
  | 'medications'
  | 'labResults'
  | 'procedures'
  | 'allergies'
  | 'behavioralHealth';

export interface MedicalHistoryRecord {
  id: string;
  category: MedicalHistoryCategory;
  date: string;
  title: string;
  summary?: string;
  source: string;
  sensitive?: boolean;
}

export interface PrintableMedicalHistoryPacketProps {
  petName: string;
  records: MedicalHistoryRecord[];
  defaultStartDate?: string;
  defaultEndDate?: string;
  onExport?: (payload: {
    startDate: string;
    endDate: string;
    excludeSensitive: boolean;
    records: MedicalHistoryRecord[];
  }) => void;
}

const CATEGORY_LABELS: Record<MedicalHistoryCategory, string> = {
  visits: 'Visits',
  vaccinations: 'Vaccinations',
  medications: 'Medications',
  labResults: 'Lab Results',
  procedures: 'Procedures',
  allergies: 'Allergies',
  behavioralHealth: 'Behavioral Health',
};

const CATEGORY_ORDER: MedicalHistoryCategory[] = [
  'visits',
  'vaccinations',
  'medications',
  'labResults',
  'procedures',
  'allergies',
  'behavioralHealth',
];

function isWithinRange(date: string, startDate: string, endDate: string): boolean {
  if (!date) return false;
  if (startDate && date < startDate) return false;
  if (endDate && date > endDate) return false;
  return true;
}

export default function PrintableMedicalHistoryPacket({
  petName,
  records,
  defaultStartDate = '',
  defaultEndDate = '',
  onExport,
}: PrintableMedicalHistoryPacketProps) {
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(defaultEndDate);
  const [excludeSensitive, setExcludeSensitive] = useState(true);

  const filteredRecords = useMemo(() => {
    return records
      .filter((record) => isWithinRange(record.date, startDate, endDate))
      .filter((record) => !(excludeSensitive && record.sensitive))
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }, [records, startDate, endDate, excludeSensitive]);

  const groupedRecords = useMemo(() => {
    const groups = new Map<MedicalHistoryCategory, MedicalHistoryRecord[]>();
    for (const record of filteredRecords) {
      const existing = groups.get(record.category) ?? [];
      existing.push(record);
      groups.set(record.category, existing);
    }
    return CATEGORY_ORDER.filter((category) => groups.has(category)).map((category) => ({
      category,
      label: CATEGORY_LABELS[category],
      records: groups.get(category) ?? [],
    }));
  }, [filteredRecords]);

  const handleExport = () => {
    onExport?.({ startDate, endDate, excludeSensitive, records: filteredRecords });
  };

  return (
    <section aria-labelledby="medical-history-packet-heading" className="medical-history-packet">
      <header>
        <h2 id="medical-history-packet-heading">Longitudinal Medical History Packet</h2>
        <p>
          Printable record for <strong>{petName}</strong>.
        </p>
      </header>

      <form
        className="medical-history-packet__controls"
        onSubmit={(event) => {
          event.preventDefault();
          handleExport();
        }}
      >
        <div>
          <label htmlFor="medical-history-start-date">Start date</label>
          <input
            id="medical-history-start-date"
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
          />
        </div>
        <div>
          <label htmlFor="medical-history-end-date">End date</label>
          <input
            id="medical-history-end-date"
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
          />
        </div>
        <div>
          <input
            id="medical-history-exclude-sensitive"
            type="checkbox"
            checked={excludeSensitive}
            onChange={(event) => setExcludeSensitive(event.target.checked)}
          />
          <label htmlFor="medical-history-exclude-sensitive">
            Exclude sensitive categories
          </label>
        </div>
        <button type="submit" disabled={filteredRecords.length === 0}>
          Export printable packet
        </button>
      </form>

      {filteredRecords.length === 0 ? (
        <p role="status" className="medical-history-packet__empty">
          No records match the selected date range and privacy settings.
        </p>
      ) : (
        <>
          <nav aria-label="Table of contents" className="medical-history-packet__toc">
            <h3>Table of Contents</h3>
            <ol>
              {groupedRecords.map((group) => (
                <li key={group.category}>
                  <a href={`#medical-history-${group.category}`}>
                    {group.label} ({group.records.length})
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          {groupedRecords.map((group) => (
            <section
              key={group.category}
              id={`medical-history-${group.category}`}
              aria-labelledby={`medical-history-${group.category}-heading`}
            >
              <h3 id={`medical-history-${group.category}-heading`}>{group.label}</h3>
              <table>
                <caption className="sr-only">
                  {group.label} records for {petName}
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Record</th>
                    <th scope="col">Summary</th>
                    <th scope="col">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {group.records.map((record) => (
                    <tr key={record.id}>
                      <td>{record.date}</td>
                      <th scope="row">{record.title}</th>
                      <td>{record.summary ?? '—'}</td>
                      <td>
                        <span className="medical-history-packet__source-marker">
                          {record.source}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </>
      )}
    </section>
  );
}
