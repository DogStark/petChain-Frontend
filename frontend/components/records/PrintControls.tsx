'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * PrintControls
 *
 * Provides a deliberate, privacy-safe print representation for a single
 * selected medical record. It toggles a `print-mode` class on the document
 * root so that print stylesheets can hide navigation, wallet controls,
 * QR/token surfaces and analytics UI, while keeping only the selected pet
 * and record scope visible.
 *
 * Print mode is announced via an aria-live region and can be cancelled at
 * any time without mutating or losing record data.
 */
export interface PrintControlsProps {
  /** Identifier of the pet whose record is being printed. */
  petId: string;
  /** Human readable pet name, used in the print header. */
  petName?: string;
  /** Identifier of the selected record, scoping the printed output. */
  recordId: string;
  /** Optional label for the record (e.g. "Vaccination - 2024-05-01"). */
  recordLabel?: string;
  /** Optional callback invoked right before the print dialog opens. */
  onBeforePrint?: () => void;
  /** Optional callback invoked after printing completes or is cancelled. */
  onAfterPrint?: () => void;
}

const PRINT_ROOT_CLASS = 'print-mode';

export default function PrintControls({
  petId,
  petName,
  recordId,
  recordLabel,
  onBeforePrint,
  onAfterPrint,
}: PrintControlsProps) {
  const [isPrintMode, setIsPrintMode] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  const enterPrintMode = useCallback(() => {
    if (typeof document === 'undefined') return;
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    document.documentElement.classList.add(PRINT_ROOT_CLASS);
    document.documentElement.setAttribute('data-print-pet', petId);
    document.documentElement.setAttribute('data-print-record', recordId);
    setIsPrintMode(true);
    setAnnouncement(
      `Print preview for ${petName ?? 'selected pet'}${
        recordLabel ? `, ${recordLabel}` : ''
      }. Navigation, wallet controls and tokens are hidden.`,
    );
  }, [petId, petName, recordId, recordLabel]);

  const exitPrintMode = useCallback(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.classList.remove(PRINT_ROOT_CLASS);
    document.documentElement.removeAttribute('data-print-pet');
    document.documentElement.removeAttribute('data-print-record');
    setIsPrintMode(false);
    setAnnouncement('Print preview closed. No record data was changed.');
    const previous = restoreFocusRef.current;
    if (previous && typeof previous.focus === 'function') {
      previous.focus();
    }
  }, []);

  const handlePrint = useCallback(() => {
    if (typeof window === 'undefined') return;
    enterPrintMode();
    onBeforePrint?.();
    // Defer so the print-mode class is applied before the dialog opens.
    window.requestAnimationFrame(() => {
      window.print();
    });
  }, [enterPrintMode, onBeforePrint]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleAfterPrint = () => {
      exitPrintMode();
      onAfterPrint?.();
    };

    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, [exitPrintMode, onAfterPrint]);

  // Ensure print mode is always cleaned up if the component unmounts.
  useEffect(() => {
    return () => {
      if (typeof document === 'undefined') return;
      document.documentElement.classList.remove(PRINT_ROOT_CLASS);
      document.documentElement.removeAttribute('data-print-pet');
      document.documentElement.removeAttribute('data-print-record');
    };
  }, []);

  return (
    <div className="print-controls" data-print-exclude="true">
      <div className="print-controls__actions">
        <button
          type="button"
          className="print-controls__button"
          onClick={handlePrint}
          aria-label={`Print record for ${petName ?? 'selected pet'}`}
        >
          Print record
        </button>
        {isPrintMode ? (
          <button
            type="button"
            className="print-controls__button print-controls__button--cancel"
            onClick={exitPrintMode}
            aria-label="Cancel print preview"
          >
            Cancel print preview
          </button>
        ) : null}
      </div>

      <p className="print-controls__scope" data-print-exclude="true">
        Scope: {petName ?? 'selected pet'}
        {recordLabel ? ` — ${recordLabel}` : ''}
      </p>

      <div
        className="print-controls__announcement"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {announcement}
      </div>
    </div>
  );
}
