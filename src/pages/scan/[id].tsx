import { AlertOctagon, Phone, MapPin, Stethoscope, Dna, ExternalLink } from 'lucide-react';
import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import React, { useEffect, useState } from 'react';

import { petAPI } from '@/lib/api/petAPI';
import { qrcodeAPI } from '@/lib/api/qrcodeAPI';
import type { PetEmergencyInfo, EmergencyContact } from '@/types/pet';

// export const dynamic = 'force-dynamic';

interface PublicProfile {
  qrCodeId: string;
  petId: string;
  customMessage?: string;
  emergencyContact?: string;
  emergency: PetEmergencyInfo | null;
}

interface ScanPageProps {
  profile?: PublicProfile | null;
  error?: string | null;
}

export default function ScanPage({
  profile: initialProfile,
  error: initialError,
}: ScanPageProps = {}) {
  const router = useRouter();
  const { id } = router.query;
  const [profile, setProfile] = useState(initialProfile ?? null);
  const [error, setError] = useState(initialError ?? null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!id || typeof id !== 'string') return;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        // Record the scan without collecting precise identity or location data.
        const deviceType = /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop';
        qrcodeAPI.recordScan(id, { deviceType, locationConsent: false }).catch(() => {});

        const qr = await qrcodeAPI.getOne(id);

        if (!qr.isActive) {
          setProfile(null);
          setError(
            'This QR tag has been revoked or replaced by the owner. Use the newest active tag for emergency details.',
          );
          return;
        }

        let emergency: PetEmergencyInfo | null = null;
        try {
          emergency = await petAPI.getPetEmergencyInfoProjection(qr.petId);
        } catch {
          // Emergency info optional — null means not configured
        }

        setProfile({
          qrCodeId: qr.qrCodeId,
          petId: qr.petId,
          customMessage: qr.customMessage,
          emergencyContact: qr.emergencyContact,
          emergency,
        });
      } catch {
        setProfile(null);
        setError(
          'This QR tag is invalid, revoked, or no longer active. No private pet details are available from this tag.',
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50">
        <div role="status" aria-live="polite">
          <div
            className="animate-spin rounded-full h-12 w-12 border-4 border-red-500 border-t-transparent"
            aria-hidden="true"
          />
          <span className="sr-only">Loading current tag status</span>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-red-50 text-center">
        <AlertOctagon size={64} className="text-red-500 mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Tag Unavailable</h1>
        <p className="text-gray-600 mb-6">{error || 'Unable to load this pet tag.'}</p>
        <button
          onClick={() => router.push('/')}
          className="bg-gray-900 text-white px-8 py-3 rounded-full font-bold"
        >
          Return Home
        </button>
      </div>
    );
  }

  const { emergency, customMessage, emergencyContact } = profile;

  return (
    <div className="min-h-screen bg-red-50">
      <Head>
        <title>Pet Emergency Tag — PetChain</title>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0"
        />
      </Head>

      {/* Header */}
      <div className="bg-red-600 text-white p-6 shadow-xl sticky top-0 z-50">
        <div className="max-w-md mx-auto flex items-center gap-4">
          <div className="bg-white p-2 rounded-xl animate-pulse">
            <AlertOctagon size={32} className="text-red-600" />
          </div>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tighter italic">
              Emergency Record
            </h1>
            <p className="text-red-100 text-sm font-bold">
              Critical Information for Pet Responders
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto p-4 space-y-4 pb-12">
        {/* No emergency info configured */}
        {!emergency && !emergencyContact && (
          <div className="bg-white border-4 border-gray-300 rounded-3xl p-6 shadow-lg text-center">
            <AlertOctagon size={40} className="text-gray-400 mx-auto mb-3" />
            <p className="font-black text-gray-700 text-lg uppercase">No Emergency Info Set Up</p>
            <p className="text-gray-500 text-sm mt-2">
              The owner of this pet has not yet configured emergency contacts or vet information.
              If this is your pet, please update your emergency info in the PetChain app.
            </p>
          </div>
        )}

        {/* Custom message from owner */}
        {customMessage && (
          <div className="bg-white border-4 border-red-500 rounded-3xl p-6 shadow-2xl">
            <h2 className="text-red-600 font-black flex items-center gap-2 mb-3 text-lg uppercase">
              <AlertOctagon size={24} /> Critical Notes
            </h2>
            <div className="bg-red-50 p-4 rounded-2xl border-2 border-red-100 text-red-900 font-black text-xl leading-snug">
              {customMessage}
            </div>
          </div>
        )}

        {/* Medical notes from emergency info */}
        {emergency?.medicalNotes && (
          <div className="bg-white border-4 border-orange-400 rounded-3xl p-6 shadow-xl">
            <h2 className="text-orange-600 font-black flex items-center gap-2 mb-3 text-lg uppercase">
              <AlertOctagon size={24} /> Medical Notes
            </h2>
            <div className="bg-orange-50 p-4 rounded-2xl border-2 border-orange-100 text-orange-900 font-bold text-lg leading-snug">
              {emergency.medicalNotes}
            </div>
          </div>
        )}

        {/* Emergency contacts */}
        {(emergency?.contacts?.length ?? 0) > 0 && (
          <div className="bg-white rounded-3xl p-6 shadow-lg border border-red-100">
            <h2 className="text-gray-900 font-black flex items-center gap-2 mb-4 uppercase text-sm tracking-widest opacity-60">
              <Phone size={18} /> Owner Contacts
            </h2>
            <div className="space-y-3">
              {emergency!.contacts
                .sort((a: EmergencyContact, b: EmergencyContact) => a.priority - b.priority)
                .map((contact: EmergencyContact) => (
                  <a
                    key={contact.id}
                    href={`tel:${contact.phone}`}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:bg-red-50 transition-all active:scale-95 shadow-sm"
                  >
                    <div>
                      <p className="font-extrabold text-gray-900 text-lg">{contact.name}</p>
                      <p className="text-sm text-gray-500 font-bold">
                        {contact.relationship.toUpperCase()}
                      </p>
                    </div>
                    <div className="bg-red-600 text-white p-3 rounded-full shadow-lg">
                      <Phone size={24} fill="currentColor" />
                    </div>
                  </a>
                ))}
            </div>
          </div>
        )}

        {/* Inline emergency contact from QR */}
        {emergencyContact && !emergency?.contacts?.length && (
          <div className="bg-white rounded-3xl p-6 shadow-lg border border-red-100">
            <h2 className="text-gray-900 font-black flex items-center gap-2 mb-4 uppercase text-sm tracking-widest opacity-60">
              <Phone size={18} /> Emergency Contact
            </h2>
            <a
              href={`tel:${emergencyContact}`}
              className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:bg-red-50 transition-all active:scale-95"
            >
              <p className="font-extrabold text-gray-900 text-xl">{emergencyContact}</p>
              <div className="bg-red-600 text-white p-3 rounded-full shadow-lg">
                <Phone size={24} fill="currentColor" />
              </div>
            </a>
          </div>
        )}

        {/* Emergency vet */}
        {emergency?.emergencyVet && (
          <div className="bg-white rounded-3xl p-6 shadow-lg border border-red-100">
            <h2 className="text-gray-900 font-black flex items-center gap-2 mb-4 uppercase text-sm tracking-widest opacity-60">
              <Stethoscope size={18} /> Emergency Vet
            </h2>
            <div className="bg-blue-50 border-2 border-blue-100 rounded-3xl p-5 mb-4">
              <p className="font-black text-blue-900 text-xl mb-1">{emergency.emergencyVet.name}</p>
              <div className="flex items-center gap-2 text-blue-600 font-bold mb-3">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                {emergency.emergencyVet.is24Hours ? 'OPEN 24/7' : 'Check Hours'}
              </div>
              <div className="flex flex-col gap-2">
                <a
                  href={`tel:${emergency.emergencyVet.phone}`}
                  className="flex items-center justify-center gap-2 bg-blue-600 text-white rounded-full py-4 font-black shadow-lg"
                >
                  <Phone size={20} fill="currentColor" /> Call Clinic
                </a>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(emergency.emergencyVet.address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 bg-white text-blue-600 border-2 border-blue-600 rounded-full py-4 font-black"
                >
                  <MapPin size={20} /> Open Maps
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Poison control */}
        {emergency?.poisonControl && (
          <div className="bg-gradient-to-br from-gray-900 to-black rounded-3xl p-6 shadow-2xl text-white">
            <h2 className="font-black flex items-center gap-2 mb-4 uppercase text-sm tracking-widest opacity-60">
              <AlertOctagon size={18} /> Poison Control
            </h2>
            <p className="text-2xl font-black mb-1">{emergency.poisonControl.name}</p>
            <a
              href={`tel:${emergency.poisonControl.phone}`}
              className="flex items-center justify-between p-4 bg-white/10 rounded-2xl border border-white/10 mt-4 active:scale-95 transition-all"
            >
              <p className="font-black text-2xl">{emergency.poisonControl.phone}</p>
              <div className="bg-white text-black p-3 rounded-full">
                <Phone size={24} fill="currentColor" />
              </div>
            </a>
            {emergency.poisonControl.website && (
              <a
                href={emergency.poisonControl.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm opacity-60 mt-4 justify-center"
              >
                Visit Website <ExternalLink size={14} />
              </a>
            )}
          </div>
        )}

        <div className="text-center pt-8">
          <div className="flex items-center justify-center gap-2 text-gray-400 mb-2">
            <Dna size={16} />
            <span className="font-black tracking-widest text-xs uppercase">
              Verified by PetChain
            </span>
          </div>
          <p className="text-[10px] text-gray-400 font-bold max-w-[200px] mx-auto uppercase">
            Data secured via Stellar Blockchain technology.
          </p>
        </div>
      </div>
    </div>
  );
}

// This page's data (QR tag status, emergency contacts, medical notes) must
// always be current — a deactivated tag or an edited emergency contact has
// to show up on the very next scan. getServerSideProps forces a fresh
// server render on every request instead of the static-generation +
// revalidate:false combo this page used to have, which cached the first
// scan's result forever. The actual data fetch still happens client-side
// in useEffect above (via qrcodeAPI/petAPI), so this only needs to opt the
// route out of static generation.
export const getServerSideProps: GetServerSideProps = async () => {
  return {
    props: {},
  };
};
