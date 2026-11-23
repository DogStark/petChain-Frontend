import React, { useMemo } from 'react';

export interface PetIdentityCardOwner {
  name?: string;
  phone?: string;
  email?: string;
}

export interface PetIdentityCardEmergencyContact {
  name?: string;
  phone?: string;
  relationship?: string;
}

export interface PetIdentityCardProps {
  pet: {
    id: string;
    name: string;
    species: string;
    breed?: { name: string } | null;
    photoUrl?: string | null;
    microchipNumber?: string | null;
  };
  owner?: PetIdentityCardOwner | null;
  emergencyContact?: PetIdentityCardEmergencyContact | null;
  /** Base URL used to build the emergency scan link encoded in the QR code. */
  emergencyBaseUrl?: string;
  /** Card format: credit-card (85.6x54mm) or A6 (105x148mm). */
  format?: 'credit-card' | 'a6';
}

const CARD_DIMENSIONS: Record<'credit-card' | 'a6', { width: string; height: string }> = {
  'credit-card': { width: '85.6mm', height: '54mm' },
  a6: { width: '105mm', height: '148mm' },
};

/**
 * Builds a QR code image URL (via a public QR rendering endpoint) that encodes
 * the emergency scan link for this pet. Kept dependency-free so the card can be
 * printed without extra client libraries.
 */
function buildQrCodeUrl(data: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(data)}`;
}

export default function PetIdentityCard({
  pet,
  owner,
  emergencyContact,
  emergencyBaseUrl,
  format = 'credit-card',
}: PetIdentityCardProps) {
  const dimensions = CARD_DIMENSIONS[format];

  const emergencyUrl = useMemo(() => {
    const base = emergencyBaseUrl || (typeof window !== 'undefined' ? window.location.origin : '');
    return `${base}/emergency/pet/${pet.id}`;
  }, [emergencyBaseUrl, pet.id]);

  const qrCodeUrl = useMemo(() => buildQrCodeUrl(emergencyUrl), [emergencyUrl]);

  return (
    <div
      className="pet-identity-card"
      style={{
        width: dimensions.width,
        height: dimensions.height,
        border: '1px solid #d1d5db',
        borderRadius: '8px',
        padding: '4mm',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: '2mm',
        background: '#ffffff',
        color: '#111827',
        fontFamily: 'system-ui, sans-serif',
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', gap: '3mm', alignItems: 'center' }}>
        {pet.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={pet.photoUrl}
            alt={`${pet.name} photo`}
            style={{
              width: '18mm',
              height: '18mm',
              objectFit: 'cover',
              borderRadius: '6px',
              flexShrink: 0,
            }}
          />
        ) : (
          <div
            aria-hidden="true"
            style={{
              width: '18mm',
              height: '18mm',
              borderRadius: '6px',
              background: '#e5e7eb',
              flexShrink: 0,
            }}
          />
        )}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '4mm', fontWeight: 700, lineHeight: 1.1 }}>{pet.name}</div>
          <div style={{ fontSize: '2.6mm', color: '#4b5563' }}>
            {pet.species}
            {pet.breed?.name ? ` · ${pet.breed.name}` : ''}
          </div>
          {pet.microchipNumber && (
            <div style={{ fontSize: '2.2mm', color: '#6b7280' }}>
              Microchip: {pet.microchipNumber}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '3mm', flex: 1, minHeight: 0 }}>
        <div style={{ flex: 1, fontSize: '2.4mm', lineHeight: 1.4, minWidth: 0 }}>
          {owner?.name && (
            <div>
              <strong>Owner:</strong> {owner.name}
            </div>
          )}
          {owner?.phone && (
            <div>
              <strong>Phone:</strong> {owner.phone}
            </div>
          )}
          {emergencyContact?.name && (
            <div>
              <strong>Emergency:</strong> {emergencyContact.name}
              {emergencyContact.relationship ? ` (${emergencyContact.relationship})` : ''}
            </div>
          )}
          {emergencyContact?.phone && (
            <div>
              <strong>Emergency phone:</strong> {emergencyContact.phone}
            </div>
          )}
        </div>
        <div style={{ flexShrink: 0, textAlign: 'center' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrCodeUrl}
            alt={`QR code for ${pet.name} emergency info`}
            width={64}
            height={64}
            style={{ width: '16mm', height: '16mm' }}
          />
          <div style={{ fontSize: '1.8mm', color: '#6b7280' }}>Scan for emergency info</div>
        </div>
      </div>
    </div>
  );
}
