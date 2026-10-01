import React, { useCallback, useEffect, useMemo, useState } from 'react';

/**
 * A single medical record entry as returned by the records API.
 */
export interface MedicalRecord {
  id: string;
  petId: string;
  petName: string;
  title: string;
  date: string;
  veterinarian?: string;
  notes?: string;
  attachments?: { id: string; name: string; url?: string }[];
  /** Sensitive fields that must never appear in printed output. */
  qrToken?: string;
  walletAddress?: string;
}

interface MedicalRecordViewProps {
  petId: string;
  petName: string;
  records: MedicalRecord[];
  /** Optional clinic / practice name shown in the print header. */
  clinicName?: string;
  onClose?: () => void;
}

/**
 * Print-specific medical record layout with privacy controls.
 *
 * Printing is scoped to the selected pet and its records only. Navigation,
 * wallet controls, QR tokens and analytics UI are excluded from the printed
 * output via the `print:hidden` utility and the `data-print-exclude` marker.
 * Long notes and tables paginate without clipping and table headers repeat
 * across pages.
 */
export function MedicalRecordView({
  petId,
  petName,
  records,
  clinicName,
  onClose,
}: MedicalRecordViewProps) {
  const [isPrinting, setIsPrinting] = useState(false);

  const scopedRecords = useMemo(
    () => records.filter((record) => record.petId === petId),
    [records, petId],
  );

  const handlePrint = useCallback(() => {
    setIsPrinting(true);
    // Announce print mode; the browser print dialog is cancellable and no
    // data is mutated, so cancelling never loses state.
    window.print();
  }, []);

  useEffect(() => {
    const handleAfterPrint = () => setIsPrinting(false);
    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, []);

  return (
    <section
      className="medical-record-view"
      aria-label={`Medical records for ${petName}`}
      data-print-scope="selected-record"
    >
      {/* Interactive controls are excluded from print output. */}
      <header
        className="medical-record-view__toolbar print:hidden"
        data-print-exclude="controls"
      >
        <h2 className="medical-record-view__heading">
          Medical records — {petName}
        </h2>
        <div className="medical-record-view__actions">
          <button
            type="button"
            onClick={handlePrint}
            aria-pressed={isPrinting}
            className="medical-record-view__print-button"
          >
            {isPrinting ? 'Preparing print…' : 'Print records'}
          </button>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="medical-record-view__close-button"
            >
              Close
            </button>
          ) : null}
        </div>
      </header>

      {/* Print-only header: identifies the selected pet and record scope. */}
      <div className="medical-record-view__print-header hidden print:block">
        <h1>{clinicName ? `${clinicName} — ` : ''}Medical records</h1>
        <p>
          Patient: {petName} · Records: {scopedRecords.length}
        </p>
      </div>

      {scopedRecords.length === 0 ? (
        <p className="medical-record-view__empty">
          No records available for {petName}.
        </p>
      ) : (
        <table className="medical-record-view__table">
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Title</th>
              <th scope="col">Veterinarian</th>
              <th scope="col">Notes</th>
            </tr>
          </thead>
          <tbody>
            {scopedRecords.map((record) => (
              <tr key={record.id}>
                <td>{record.date}</td>
                <td>{record.title}</td>
                <td>{record.veterinarian ?? '—'}</td>
                <td className="medical-record-view__notes">
                  {record.notes ?? '—'}
                  {record.attachments && record.attachments.length > 0 ? (
                    <ul className="medical-record-view__attachments">
                      {record.attachments.map((attachment) => (
                        <li key={attachment.id}>{attachment.name}</li>
                      ))}
                    </ul>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Print-only footer. */}
      <footer className="medical-record-view__print-footer hidden print:block">
        <p>
          Confidential medical record for {petName}. Generated{' '}
          {new Date().toLocaleDateString()}.
        </p>
      </footer>

      {/*
        Print stylesheet: scopes output to the selected record, hides
        navigation/wallet/analytics UI, repeats table headers and avoids
        clipping long notes and tables across pages.
      */}
      <style>{`
        @media print {
          /* Only the selected record scope is printed. */
          body * { visibility: hidden; }
          [data-print-scope="selected-record"],
          [data-print-scope="selected-record"] * { visibility: visible; }
          [data-print-scope="selected-record"] {
            position: absolute;
            inset: 0;
            width: 100%;
          }

          /* Explicitly exclude secrets and interactive controls. */
          [data-print-exclude],
          .print\\:hidden,
          nav,
          [role="navigation"],
          [data-wallet],
          [data-analytics],
          [data-qr-token] { display: none !important; }

          .medical-record-view__table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
          }
          .medical-record-view__table thead { display: table-header-group; }
          .medical-record-view__table tfoot { display: table-footer-group; }
          .medical-record-view__table tr { break-inside: avoid; }
          .medical-record-view__table th,
          .medical-record-view__table td {
            border: 1px solid #000;
            padding: 4px 6px;
            vertical-align: top;
            word-wrap: break-word;
            overflow-wrap: anywhere;
          }
          .medical-record-view__notes { white-space: pre-wrap; }
          .medical-record-view__attachments { margin: 4px 0 0; padding-left: 16px; }

          .medical-record-view__print-header,
          .medical-record-view__print-footer { display: block; }
        }
      `}</style>
    </section>
  );
}

export default MedicalRecordView;
