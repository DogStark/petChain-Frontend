import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Printer, Wallet } from 'lucide-react';
import { getEmergencyPassStatus, type EmergencyPassRecord } from './emergencyPassStatus';

interface EmergencyPassOptionsProps {
  petId: string;
  petName: string;
  emergencyUrl: string;
  /** Public QR record for the pet, or null when none exists or it was denied. */
  record: EmergencyPassRecord | null;
  /** Requests the wallet pass from the backend, which decides whether to issue it. */
  onRequestWalletPass?: () => Promise<Blob>;
}

const STATUS_TEXT = {
  active: 'Active',
  expired: 'Expired',
  revoked: 'Revoked',
  unavailable: 'Unavailable',
} as const;

const PRINT_CSS = `
@media print {
  body * { visibility: hidden !important; }
  #emergency-print-card, #emergency-print-card * { visibility: visible !important; }
  #emergency-print-card { position: absolute; left: 0; top: 0; width: 100%; }
}`;

/**
 * Print card and wallet pass built only from public fields: pet name, the
 * public emergency link, the public message and the code status. Contact
 * details are never rendered here.
 */
export const EmergencyPassOptions: React.FC<EmergencyPassOptionsProps> = ({
  petId,
  petName,
  emergencyUrl,
  record,
  onRequestWalletPass,
}) => {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const status = getEmergencyPassStatus(record);
  const canIssue = status === 'active';
  const expiry =
    record?.expiresAt && !Number.isNaN(Date.parse(record.expiresAt))
      ? new Date(record.expiresAt).toLocaleDateString()
      : 'No expiration';

  const handlePrint = () => {
    if (canIssue) window.print();
  };

  const handleWallet = async () => {
    if (!canIssue || !onRequestWalletPass) return;
    setBusy(true);
    setError(null);
    try {
      const blob = await onRequestWalletPass();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${petName}-emergency.pkpass`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('The wallet pass could not be created. Try again later.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby={`pass-heading-${petId}`} className="w-full flex flex-col gap-3">
      <style>{PRINT_CSS}</style>
      <h4 id={`pass-heading-${petId}`} className="text-sm font-semibold text-gray-900">
        Print card and wallet pass
      </h4>

      <div id="emergency-print-card" className="rounded-2xl border border-gray-200 p-4 text-center">
        <p className="font-bold text-gray-900">{petName}</p>
        {canIssue && (
          <QRCodeSVG value={emergencyUrl} size={120} level="H" className="mx-auto my-2" />
        )}
        {record?.customMessage && canIssue && (
          <p className="text-sm text-gray-700">{record.customMessage}</p>
        )}
        <dl className="text-xs text-gray-600 mt-2">
          <dt className="inline font-semibold">Status: </dt>
          <dd className="inline" data-testid="pass-status">
            {STATUS_TEXT[status]}
          </dd>
          <br />
          <dt className="inline font-semibold">Expires: </dt>
          <dd className="inline">{expiry}</dd>
        </dl>
      </div>

      {!canIssue && (
        <p role="status" className="text-xs text-red-600">
          {status === 'unavailable'
            ? 'No emergency QR code is available for this pet.'
            : `This emergency code is ${STATUS_TEXT[status].toLowerCase()}, so a card or pass cannot be created.`}
        </p>
      )}
      {error && (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={handlePrint}
          disabled={!canIssue}
          className="flex-1 flex items-center justify-center gap-2 border border-gray-300 rounded-full py-2 text-sm font-semibold disabled:opacity-50"
        >
          <Printer size={16} aria-hidden="true" /> Print card
        </button>
        <button
          type="button"
          onClick={handleWallet}
          disabled={!canIssue || busy || !onRequestWalletPass}
          className="flex-1 flex items-center justify-center gap-2 border border-gray-300 rounded-full py-2 text-sm font-semibold disabled:opacity-50"
        >
          <Wallet size={16} aria-hidden="true" /> {busy ? 'Creating pass...' : 'Add to wallet'}
        </button>
      </div>
    </section>
  );
};
