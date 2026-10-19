'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface MedicalRecord {
  id: string;
  petId: string;
  petName: string;
  species: string;
  breed?: string;
  ownerName: string;
  visitDate: string;
  veterinarian: string;
  clinic: string;
  diagnosis: string;
  treatment: string;
  notes: string;
  attachments: { id: string; name: string; url: string }[];
  medications: { name: string; dosage: string; frequency: string }[];
  vitals: { label: string; value: string; unit?: string }[];
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function MedicalRecordPage() {
  const params = useParams<{ id: string }>();
  const recordId = params?.id;
  const [record, setRecord] = useState<MedicalRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [printMode, setPrintMode] = useState(false);

  useEffect(() => {
    if (!recordId) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/records/${recordId}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load medical record');
        return res.json();
      })
      .then((data: MedicalRecord) => {
        if (!cancelled) {
          setRecord(data);
          setError(null);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [recordId]);

  useEffect(() => {
    if (!printMode) return;
    const handleAfterPrint = () => setPrintMode(false);
    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, [printMode]);

  const printedAt = useMemo(() => new Date().toLocaleString(), []);

  const startPrint = () => {
    setPrintMode(true);
    // Defer so the print layout is committed before the dialog opens.
    window.setTimeout(() => window.print(), 0);
  };

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <p role="status">Loading medical record…</p>
      </main>
    );
  }

  if (error || !record) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <p role="alert" className="text-red-600">
          {error ?? 'Medical record not found.'}
        </p>
        <Link href="/records" className="text-blue-600 underline">
          Back to records
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <style>{`
        @media print {
          @page { margin: 16mm; }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          .print-root { max-width: none; padding: 0; }
          .print-section { break-inside: avoid; }
          .print-table { width: 100%; border-collapse: collapse; }
          .print-table thead { display: table-header-group; }
          .print-table tr { break-inside: avoid; }
          .print-table th, .print-table td {
            border: 1px solid #999;
            padding: 4px 6px;
            text-align: left;
            vertical-align: top;
          }
          .print-notes { white-space: pre-wrap; overflow-wrap: anywhere; }
          .print-footer { position: fixed; bottom: 0; left: 0; right: 0; font-size: 10px; }
        }
        .print-only { display: none; }
      `}</style>

      <div className="no-print mb-6 flex items-center justify-between">
        <Link href="/records" className="text-blue-600 underline">
          Back to records
        </Link>
        <button
          type="button"
          onClick={startPrint}
          className="rounded bg-blue-600 px-4 py-2 text-white"
        >
          Print record
        </button>
      </div>

      {printMode && (
        <div className="no-print mb-4 rounded border border-blue-300 bg-blue-50 p-3" role="status">
          <p className="text-sm">
            Print mode is active. Only this pet&apos;s record will be printed. Choose
            Cancel in the print dialog to return without losing any data.
          </p>
          <button
            type="button"
            onClick={() => setPrintMode(false)}
            className="mt-2 rounded border border-blue-600 px-3 py-1 text-sm text-blue-700"
          >
            Cancel print mode
          </button>
        </div>
      )}

      <article className="print-root">
        <header className="print-section mb-6 border-b pb-4">
          <h1 className="text-2xl font-bold">Medical Record</h1>
          <p className="text-sm text-gray-600">
            {record.petName} · {record.species}
            {record.breed ? ` · ${record.breed}` : ''}
          </p>
          <p className="text-sm text-gray-600">
            Owner: {record.ownerName} · Visit: {formatDate(record.visitDate)}
          </p>
          <p className="text-sm text-gray-600">
            {record.veterinarian} · {record.clinic}
          </p>
          <p className="print-only text-xs text-gray-500">
            Record ID: {record.id} · Printed: {printedAt}
          </p>
        </header>

        <section className="print-section mb-6">
          <h2 className="mb-2 text-lg font-semibold">Diagnosis</h2>
          <p className="print-notes">{record.diagnosis}</p>
        </section>

        <section className="print-section mb-6">
          <h2 className="mb-2 text-lg font-semibold">Treatment</h2>
          <p className="print-notes">{record.treatment}</p>
        </section>

        {record.vitals.length > 0 && (
          <section className="print-section mb-6">
            <h2 className="mb-2 text-lg font-semibold">Vitals</h2>
            <table className="print-table w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th scope="col">Measurement</th>
                  <th scope="col">Value</th>
                  <th scope="col">Unit</th>
                </tr>
              </thead>
              <tbody>
                {record.vitals.map((vital) => (
                  <tr key={vital.label}>
                    <td>{vital.label}</td>
                    <td>{vital.value}</td>
                    <td>{vital.unit ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {record.medications.length > 0 && (
          <section className="print-section mb-6">
            <h2 className="mb-2 text-lg font-semibold">Medications</h2>
            <table className="print-table w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th scope="col">Medication</th>
                  <th scope="col">Dosage</th>
                  <th scope="col">Frequency</th>
                </tr>
              </thead>
              <tbody>
                {record.medications.map((med) => (
                  <tr key={med.name}>
                    <td>{med.name}</td>
                    <td>{med.dosage}</td>
                    <td>{med.frequency}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <section className="print-section mb-6">
          <h2 className="mb-2 text-lg font-semibold">Notes</h2>
          <p className="print-notes">{record.notes}</p>
        </section>

        {record.attachments.length > 0 && (
          <section className="print-section mb-6">
            <h2 className="mb-2 text-lg font-semibold">Attachments</h2>
            <ul className="list-disc pl-5 text-sm">
              {record.attachments.map((attachment) => (
                <li key={attachment.id}>
                  {attachment.name}
                  <span className="no-print">
                    {' '}
                    <a href={attachment.url} className="text-blue-600 underline">
                      Open
                    </a>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <footer className="print-footer print-only text-gray-500">
          {record.petName} · Record {record.id} · Page footer generated {printedAt}
        </footer>
      </article>
    </main>
  );
}
