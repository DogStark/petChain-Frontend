import { useCallback, useMemo, useState } from 'react';

export type MedicalHistorySource = 'visit' | 'lab' | 'prescription' | 'vaccination' | 'note';

export interface MedicalHistoryRecord {
  id: string;
  date: string;
  title: string;
  summary?: string;
  source: MedicalHistorySource;
  sensitive?: boolean;
}

export interface MedicalHistoryPacketSection {
  id: string;
  heading: string;
  records: MedicalHistoryRecord[];
}

export interface MedicalHistoryPacketOptions {
  petId: string;
  startDate: string;
  endDate: string;
  excludeSensitive?: boolean;
}

export interface MedicalHistoryPacket {
  petId: string;
  startDate: string;
  endDate: string;
  generatedAt: string;
  tableOfContents: { id: string; heading: string; count: number }[];
  sections: MedicalHistoryPacketSection[];
  excludedSensitiveCount: number;
}

export type MedicalHistoryPacketStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'denied' | 'error';

export interface UseMedicalHistoryPacketResult {
  status: MedicalHistoryPacketStatus;
  packet: MedicalHistoryPacket | null;
  error: string | null;
  generate: (options: MedicalHistoryPacketOptions) => Promise<void>;
  reset: () => void;
}

const SOURCE_HEADINGS: Record<MedicalHistorySource, string> = {
  visit: 'Visits',
  lab: 'Lab Results',
  prescription: 'Prescriptions',
  vaccination: 'Vaccinations',
  note: 'Clinical Notes',
};

const SOURCE_ORDER: MedicalHistorySource[] = ['visit', 'lab', 'prescription', 'vaccination', 'note'];

function isValidRange(startDate: string, endDate: string): boolean {
  if (!startDate || !endDate) return false;
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return false;
  return start <= end;
}

function buildPacket(
  options: MedicalHistoryPacketOptions,
  records: MedicalHistoryRecord[],
): MedicalHistoryPacket {
  const start = new Date(options.startDate).getTime();
  const end = new Date(options.endDate).getTime();

  let excludedSensitiveCount = 0;
  const inRange = records.filter((record) => {
    const time = new Date(record.date).getTime();
    if (Number.isNaN(time) || time < start || time > end) return false;
    if (options.excludeSensitive && record.sensitive) {
      excludedSensitiveCount += 1;
      return false;
    }
    return true;
  });

  const sections: MedicalHistoryPacketSection[] = SOURCE_ORDER.map((source) => ({
    id: `section-${source}`,
    heading: SOURCE_HEADINGS[source],
    records: inRange
      .filter((record) => record.source === source)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
  })).filter((section) => section.records.length > 0);

  return {
    petId: options.petId,
    startDate: options.startDate,
    endDate: options.endDate,
    generatedAt: new Date().toISOString(),
    tableOfContents: sections.map((section) => ({
      id: section.id,
      heading: section.heading,
      count: section.records.length,
    })),
    sections,
    excludedSensitiveCount,
  };
}

export function useMedicalHistoryPacket(
  fetchRecords: (petId: string, startDate: string, endDate: string) => Promise<MedicalHistoryRecord[]>,
): UseMedicalHistoryPacketResult {
  const [status, setStatus] = useState<MedicalHistoryPacketStatus>('idle');
  const [packet, setPacket] = useState<MedicalHistoryPacket | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setStatus('idle');
    setPacket(null);
    setError(null);
  }, []);

  const generate = useCallback(
    async (options: MedicalHistoryPacketOptions) => {
      setError(null);
      setPacket(null);

      if (!options.petId) {
        setStatus('error');
        setError('Select a pet before generating a packet.');
        return;
      }

      if (!isValidRange(options.startDate, options.endDate)) {
        setStatus('error');
        setError('Choose a valid date range where the start is on or before the end.');
        return;
      }

      setStatus('loading');
      try {
        const records = await fetchRecords(options.petId, options.startDate, options.endDate);
        const built = buildPacket(options, records);
        setPacket(built);
        setStatus(built.sections.length > 0 ? 'ready' : 'empty');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to generate the medical history packet.';
        const denied = /forbidden|unauthori[sz]ed|denied|403|401/i.test(message);
        setStatus(denied ? 'denied' : 'error');
        setError(message);
      }
    },
    [fetchRecords],
  );

  return useMemo(
    () => ({ status, packet, error, generate, reset }),
    [status, packet, error, generate, reset],
  );
}
