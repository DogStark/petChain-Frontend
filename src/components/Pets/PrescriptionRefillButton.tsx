import React, { useState } from 'react';
import { RefreshCcw } from 'lucide-react';

interface PrescriptionRefillButtonProps {
  petId: string;
  prescriptionId: string;
  medicationName: string;
}

type Status = 'idle' | 'loading' | 'success' | 'error';

export default function PrescriptionRefillButton({
  petId,
  prescriptionId,
  medicationName,
}: PrescriptionRefillButtonProps) {
  const [status, setStatus] = useState<Status>('idle');

  const handleRefill = async () => {
    setStatus('loading');
    try {
      const res = await fetch(`/api/pets/${petId}/prescriptions/${prescriptionId}/refill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('Request failed');
      setStatus('success');
    } catch {
      setStatus('error');
    }
  };

  if (status === 'success') {
    return (
      <span
        style={{
          fontSize: 12,
          color: '#16a34a',
          fontWeight: 600,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        ✓ Refill requested
      </span>
    );
  }

  return (
    <button
      onClick={handleRefill}
      disabled={status === 'loading'}
      aria-label={`Request refill for ${medicationName}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 12px',
        fontSize: 13,
        fontWeight: 600,
        borderRadius: 20,
        border: '1.5px solid #2563eb',
        background: status === 'loading' ? '#eff6ff' : 'white',
        color: '#2563eb',
        cursor: status === 'loading' ? 'not-allowed' : 'pointer',
        opacity: status === 'loading' ? 0.7 : 1,
        transition: 'background 0.15s',
      }}
    >
      <RefreshCcw size={14} />
      {status === 'loading' ? 'Requesting…' : 'Request Refill'}
      {status === 'error' && (
        <span style={{ color: '#dc2626', marginLeft: 4 }} title="Request failed — try again">
          ✕
        </span>
      )}
    </button>
  );
}
