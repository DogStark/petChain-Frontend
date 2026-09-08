import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { GetStaticProps, GetStaticPaths } from 'next';
import { useRouter } from 'next/router';
import {
  Phone,
  MapPin,
  AlertOctagon,
  User,
  Stethoscope,
  Dna,
  ExternalLink,
  Eye,
  EyeOff,
  Shield,
  Check,
  Lock,
  Globe,
} from 'lucide-react';
import { petAPI } from '@/lib/api/petAPI';
import {
  PetEmergencyInfo,
  EmergencyContact,
  EmergencyFieldVisibility,
} from '@/types/pet';
import { projectEmergencyProfile, createDefaultVisibility } from '@/utils/emergencyProjection';

export const dynamic = 'force-dynamic';

type ViewMode = 'owner' | 'preview';

export default function EmergencyAccessPage() {
  const router = useRouter();
  const { id } = router.query;
  const [data, setData] = useState<PetEmergencyInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('owner');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (!id || typeof id !== 'string') return;

    const loadData = async () => {
      try {
        const result = await petAPI.getPetEmergencyInfo(id);
        if (result) {
          // Ensure visibility object exists with defaults for missing keys
          const visibility: EmergencyFieldVisibility = {
            ...createDefaultVisibility(),
            ...(result.visibility ?? {}),
          };
          setData({ ...result, visibility });
        } else {
          setData(null);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load emergency records');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [id]);

  const toggleFieldVisibility = (field: keyof EmergencyFieldVisibility) => {
    if (!data) return;
    const currentVis = data.visibility ?? createDefaultVisibility();
    const updatedVisibility: EmergencyFieldVisibility = {
      ...currentVis,
      [field]: !currentVis[field],
    };
    setData({
      ...data,
      visibility: updatedVisibility,
    });
    setSaveSuccess(false);
  };

  const handleSaveVisibility = async () => {
    if (!id || typeof id !== 'string' || !data) return;
    setIsSaving(true);
    try {
      await petAPI.updatePetEmergencyInfo(id, data);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save visibility settings');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-red-50"
        role="status"
        aria-live="polite"
      >
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-red-500 border-t-transparent shadow-lg" />
        <span className="sr-only">Loading emergency record…</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-red-50 text-center">
        <AlertOctagon size={64} className="text-red-500 mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Emergency Access Denied</h1>
        <p className="text-gray-600 mb-6">
          {error || 'Unable to retrieve emergency information for this pet.'}
        </p>
        <button
          onClick={() => router.push('/')}
          className="bg-gray-900 text-white px-8 py-3 rounded-full font-bold shadow-xl hover:bg-gray-800 transition-all focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
        >
          Return Home
        </button>
      </div>
    );
  }

  // Calculate projected view for anonymous scanner preview
  const projectedData = projectEmergencyProfile(data);
  const activeData = viewMode === 'preview' ? projectedData : data;
  const visibility = data.visibility ?? createDefaultVisibility();

  const hasAnyVisibleFields =
    projectedData &&
    (Boolean(projectedData.medicalNotes) ||
      (projectedData.contacts && projectedData.contacts.length > 0) ||
      Boolean(projectedData.emergencyVet) ||
      Boolean(projectedData.poisonControl));

  return (
    <div className="min-h-screen bg-red-50">
      <Head>
        <title>
          {viewMode === 'preview' ? 'Scanner Preview — PetChain' : 'EMERGENCY RECORD — PetChain'}
        </title>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0"
        />
      </Head>

      {/* Emergency Header */}
      <header className="bg-red-600 text-white p-4 sm:p-6 shadow-xl sticky top-0 z-50">
        <div className="max-w-md mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-white p-2 rounded-xl animate-pulse shrink-0">
              <AlertOctagon size={28} className="text-red-600" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tighter italic leading-none">
                Emergency Record
              </h1>
              <p className="text-red-100 text-xs sm:text-sm font-bold mt-1">
                {viewMode === 'preview' ? 'Anonymous Scanner Preview' : 'Owner Configuration & Controls'}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Mode Selector Tabs (Keyboard accessible) */}
      <div className="max-w-md mx-auto px-4 pt-4">
        <div
          role="tablist"
          aria-label="View mode selection"
          className="flex bg-white/80 backdrop-blur-sm p-1 rounded-2xl border border-red-200 shadow-sm"
        >
          <button
            role="tab"
            aria-selected={viewMode === 'owner'}
            aria-controls="panel-owner"
            id="tab-owner"
            onClick={() => setViewMode('owner')}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
              viewMode === 'owner'
                ? 'bg-red-600 text-white shadow-md'
                : 'text-gray-600 hover:text-red-600'
            }`}
          >
            <Shield size={16} /> Owner View
          </button>
          <button
            role="tab"
            aria-selected={viewMode === 'preview'}
            aria-controls="panel-preview"
            id="tab-preview"
            onClick={() => setViewMode('preview')}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
              viewMode === 'preview'
                ? 'bg-red-600 text-white shadow-md'
                : 'text-gray-600 hover:text-red-600'
            }`}
          >
            <Eye size={16} /> Scanner Preview
          </button>
        </div>
      </div>

      <main
        id={viewMode === 'owner' ? 'panel-owner' : 'panel-preview'}
        role="tabpanel"
        aria-labelledby={viewMode === 'owner' ? 'tab-owner' : 'tab-preview'}
        className="max-w-md mx-auto p-4 space-y-4 pb-12"
      >
        {/* Preview Mode Banner */}
        {viewMode === 'preview' && (
          <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 text-amber-900 text-xs sm:text-sm flex items-start gap-3 shadow-sm">
            <Eye className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-extrabold uppercase tracking-wide text-amber-800">
                Live Anonymous Preview
              </p>
              <p className="mt-0.5 text-amber-700">
                This is exactly what anonymous responders will see when scanning this pet&apos;s QR code tag.
              </p>
            </div>
          </div>
        )}

        {/* Owner Save Actions Banner */}
        {viewMode === 'owner' && (
          <div className="bg-white border border-red-100 rounded-2xl p-4 shadow-sm flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Field Privacy</p>
              <p className="text-sm font-semibold text-gray-800">Default: Private</p>
            </div>
            <button
              onClick={handleSaveVisibility}
              disabled={isSaving}
              className="bg-gray-900 hover:bg-gray-800 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
            >
              {saveSuccess ? (
                <>
                  <Check size={14} className="text-green-400" /> Saved!
                </>
              ) : isSaving ? (
                'Saving…'
              ) : (
                'Save Preferences'
              )}
            </button>
          </div>
        )}

        {/* Empty state in preview mode when no fields are visible */}
        {viewMode === 'preview' && !hasAnyVisibleFields && (
          <div className="bg-white border-4 border-gray-200 rounded-3xl p-8 shadow-lg text-center">
            <Lock size={48} className="text-gray-400 mx-auto mb-3" />
            <h2 className="text-lg font-black text-gray-800 uppercase tracking-tight">
              No emergency info visible to anonymous scanners
            </h2>
            <p className="text-gray-500 text-xs sm:text-sm mt-2 leading-relaxed">
              All emergency fields are currently set to private. Switch to the Owner View to choose which
              contacts, notes, or veterinary details to make public on the QR tag.
            </p>
          </div>
        )}

        {/* Critical Medical Notes */}
        {(viewMode === 'owner' ? Boolean(data.medicalNotes) : Boolean(activeData?.medicalNotes)) && (
          <div className="bg-white border-4 border-red-500 rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-red-600 font-black flex items-center gap-2 text-base sm:text-lg uppercase">
                <AlertOctagon size={24} /> Critical Medical Notes
              </h2>
              {viewMode === 'owner' && (
                <button
                  type="button"
                  role="switch"
                  aria-checked={visibility.medicalNotes === true}
                  aria-label="Medical notes visibility"
                  data-testid="toggle-medicalNotes"
                  onClick={() => toggleFieldVisibility('medicalNotes')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all ${
                    visibility.medicalNotes
                      ? 'bg-green-100 text-green-800 border border-green-300'
                      : 'bg-gray-100 text-gray-600 border border-gray-300'
                  }`}
                >
                  {visibility.medicalNotes ? (
                    <>
                      <Globe size={12} /> Public
                    </>
                  ) : (
                    <>
                      <Lock size={12} /> Private
                    </>
                  )}
                </button>
              )}
            </div>
            <div className="bg-red-50 p-4 rounded-2xl border-2 border-red-100 text-red-900 font-black text-lg sm:text-xl leading-snug">
              {activeData?.medicalNotes ?? data.medicalNotes}
            </div>
          </div>
        )}

        {/* Primary Contacts */}
        {(viewMode === 'owner' ? data.contacts.length > 0 : (activeData?.contacts?.length ?? 0) > 0) && (
          <div className="bg-white rounded-3xl p-6 shadow-lg border border-red-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-gray-900 font-black flex items-center gap-2 uppercase text-xs sm:text-sm tracking-widest opacity-60">
                <User size={18} /> Owner Contacts
              </h2>
              {viewMode === 'owner' && (
                <button
                  type="button"
                  role="switch"
                  aria-checked={visibility.contacts === true}
                  aria-label="Owner contacts visibility"
                  data-testid="toggle-contacts"
                  onClick={() => toggleFieldVisibility('contacts')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all ${
                    visibility.contacts
                      ? 'bg-green-100 text-green-800 border border-green-300'
                      : 'bg-gray-100 text-gray-600 border border-gray-300'
                  }`}
                >
                  {visibility.contacts ? (
                    <>
                      <Globe size={12} /> Public
                    </>
                  ) : (
                    <>
                      <Lock size={12} /> Private
                    </>
                  )}
                </button>
              )}
            </div>

            <div className="space-y-3">
              {(activeData?.contacts ?? data.contacts)
                .sort((a: EmergencyContact, b: EmergencyContact) => a.priority - b.priority)
                .map((contact: EmergencyContact) => (
                  <a
                    key={contact.id}
                    href={`tel:${contact.phone}`}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:bg-red-50 transition-all active:scale-95 shadow-sm"
                  >
                    <div>
                      <p className="font-extrabold text-gray-900 text-base sm:text-lg">{contact.name}</p>
                      <p className="text-xs sm:text-sm text-gray-500 font-bold">
                        {contact.relationship.toUpperCase()}
                      </p>
                    </div>
                    <div className="bg-red-600 text-white p-3 rounded-full shadow-lg">
                      <Phone size={22} fill="currentColor" />
                    </div>
                  </a>
                ))}
            </div>
          </div>
        )}

        {/* 24/7 Vet */}
        {(viewMode === 'owner' ? Boolean(data.emergencyVet) : Boolean(activeData?.emergencyVet)) && (
          <div className="bg-white rounded-3xl p-6 shadow-lg border border-red-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-gray-900 font-black flex items-center gap-2 uppercase text-xs sm:text-sm tracking-widest opacity-60">
                <Stethoscope size={18} /> Emergency Vet
              </h2>
              {viewMode === 'owner' && (
                <button
                  type="button"
                  role="switch"
                  aria-checked={visibility.emergencyVet === true}
                  aria-label="Emergency vet visibility"
                  data-testid="toggle-emergencyVet"
                  onClick={() => toggleFieldVisibility('emergencyVet')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all ${
                    visibility.emergencyVet
                      ? 'bg-green-100 text-green-800 border border-green-300'
                      : 'bg-gray-100 text-gray-600 border border-gray-300'
                  }`}
                >
                  {visibility.emergencyVet ? (
                    <>
                      <Globe size={12} /> Public
                    </>
                  ) : (
                    <>
                      <Lock size={12} /> Private
                    </>
                  )}
                </button>
              )}
            </div>

            {(activeData?.emergencyVet || data.emergencyVet) && (
              <div className="bg-blue-50 border-2 border-blue-100 rounded-3xl p-5 mb-4">
                <p className="font-black text-blue-900 text-lg sm:text-xl mb-1">
                  {(activeData?.emergencyVet ?? data.emergencyVet)!.name}
                </p>
                <div className="flex items-center gap-2 text-blue-600 font-bold mb-3 text-xs sm:text-sm">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  {(activeData?.emergencyVet ?? data.emergencyVet)!.is24Hours
                    ? 'OPEN 24/7'
                    : 'Check Hours'}
                </div>

                <div className="flex flex-col gap-2">
                  <a
                    href={`tel:${(activeData?.emergencyVet ?? data.emergencyVet)!.phone}`}
                    className="flex items-center justify-center gap-2 bg-blue-600 text-white rounded-full py-3.5 font-black shadow-lg hover:bg-blue-700 transition-colors"
                  >
                    <Phone size={18} fill="currentColor" /> Call Clinic
                  </a>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      (activeData?.emergencyVet ?? data.emergencyVet)!.address
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 bg-white text-blue-600 border-2 border-blue-600 rounded-full py-3.5 font-black hover:bg-blue-50 transition-colors"
                  >
                    <MapPin size={18} /> Open Maps
                  </a>
                </div>
              </div>
            )}
            {(activeData?.emergencyVet ?? data.emergencyVet)?.notes && (
              <p className="text-xs sm:text-sm text-gray-600 italic px-2">
                <span className="font-bold uppercase text-[10px] tracking-widest block text-gray-400 not-italic">
                  Notes
                </span>
                {(activeData?.emergencyVet ?? data.emergencyVet)!.notes}
              </p>
            )}
          </div>
        )}

        {/* Poison Control */}
        {(viewMode === 'owner' ? Boolean(data.poisonControl) : Boolean(activeData?.poisonControl)) && (
          <div className="bg-gradient-to-br from-gray-900 to-black rounded-3xl p-6 shadow-2xl text-white">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-black flex items-center gap-2 uppercase text-xs sm:text-sm tracking-widest opacity-60">
                <AlertOctagon size={18} /> Poison Control
              </h2>
              {viewMode === 'owner' && (
                <button
                  type="button"
                  role="switch"
                  aria-checked={visibility.poisonControl === true}
                  aria-label="Poison control visibility"
                  data-testid="toggle-poisonControl"
                  onClick={() => toggleFieldVisibility('poisonControl')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all ${
                    visibility.poisonControl
                      ? 'bg-green-500/30 text-green-300 border border-green-400/40'
                      : 'bg-white/10 text-gray-300 border border-white/20'
                  }`}
                >
                  {visibility.poisonControl ? (
                    <>
                      <Globe size={12} /> Public
                    </>
                  ) : (
                    <>
                      <Lock size={12} /> Private
                    </>
                  )}
                </button>
              )}
            </div>

            <p className="text-xl sm:text-2xl font-black mb-1">
              {(activeData?.poisonControl ?? data.poisonControl)!.name}
            </p>
            <a
              href={`tel:${(activeData?.poisonControl ?? data.poisonControl)!.phone}`}
              className="flex items-center justify-between p-4 bg-white/10 rounded-2xl border border-white/10 mt-4 active:scale-95 transition-all"
            >
              <p className="font-black text-xl sm:text-2xl">
                {(activeData?.poisonControl ?? data.poisonControl)!.phone}
              </p>
              <div className="bg-white text-black p-3 rounded-full">
                <Phone size={22} fill="currentColor" />
              </div>
            </a>
            {(activeData?.poisonControl ?? data.poisonControl)?.website && (
              <a
                href={(activeData?.poisonControl ?? data.poisonControl)!.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs sm:text-sm opacity-60 mt-4 justify-center hover:opacity-100 transition-opacity"
              >
                Visit Website <ExternalLink size={14} />
              </a>
            )}
          </div>
        )}

        <footer className="text-center pt-8">
          <div className="flex items-center justify-center gap-2 text-gray-400 mb-2">
            <Dna size={16} />
            <span className="font-black tracking-widest text-xs uppercase">
              Verified by PetChain
            </span>
          </div>
          <p className="text-[10px] text-gray-400 font-bold max-w-[200px] mx-auto uppercase">
            Data secured via Stellar Blockchain technology. High-integrity medical registry.
          </p>
        </footer>
      </main>
    </div>
  );
}

export const getStaticPaths: GetStaticPaths = async () => {
  return {
    paths: [],
    fallback: 'blocking',
  };
};

export const getStaticProps: GetStaticProps = async ({ params }) => {
  return {
    props: {},
    revalidate: false,
  };
};
