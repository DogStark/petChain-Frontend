import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { GetStaticProps, GetStaticPaths } from 'next';
import { ArrowLeft, QrCode, Printer } from 'lucide-react';
import { PetPhotosManager } from '@/components/PetPhotos';
import Avatar from '@/components/Avatar';
import { EmergencyQR } from '@/components/Profile/EmergencyQR';
import CareSetupChecklist from '@/components/Pets/CareSetupChecklist';
import HealthScoreExplanation from '@/components/Pets/HealthScoreExplanation';
import PetSharingSummary from '@/components/Pets/PetSharingSummary';
import ResultsDashboard from '@/components/LabResults/ResultsDashboard';
import AttachmentQueueView from '@/components/Offline/AttachmentQueueView';
import PetDocumentsManager from '@/components/Pets/PetDocumentsManager';
import PetIdentityCard from '@/components/PetIdentityCard';
import styles from '@/styles/pages/PetDetailPage.module.css';
import { getApiBaseUrl } from '@/lib/api/apiBaseUrl';
import ZkpVaccinationProof from '@/components/ZkpVaccinationProof';
import { vaccinationsAPI, type VaccinationRecord } from '@/lib/api/vaccinationsAPI';
import { zkpService, type ZkpProof } from '@/lib/zkp';
import type { PetInsuranceDetails } from '@/types/pet';

export const dynamic = 'force-dynamic';

interface Pet {
  id: string;
  name: string;
  species: string;
  breed?: { name: string };
  gender: string;
  dateOfBirth: string;
  weight: number | null;
  color: string | null;
  microchipNumber: string | null;
  specialNeeds: string | null;
  insuranceDetails?: PetInsuranceDetails;
  photos: Array<{
    id: string;
    photoUrl: string;
    thumbnailUrl: string;
    isPrimary: boolean;
  }>;
  createdAt?: string;
}

const API_BASE_URL = getApiBaseUrl();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function PetDetailPage() {
  const router = useRouter();
  const { id } = router.query;

  const [pet, setPet] = useState<Pet | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [insuranceForm, setInsuranceForm] = useState<PetInsuranceDetails>({});
  const [isSavingInsurance, setIsSavingInsurance] = useState(false);
  const [insuranceMessage, setInsuranceMessage] = useState<string | null>(null);
  const [vaccinations, setVaccinations] = useState<VaccinationRecord[]>([]);
  const [zkpProofs, setZkpProofs] = useState<ZkpProof[]>([]);
  const [vaccinationLoading, setVaccinationLoading] = useState(true);
  const [proofLoading, setProofLoading] = useState(true);
  const [vaccinationError, setVaccinationError] = useState<string | null>(null);
  const [proofError, setProofError] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Router not yet hydrated — stay in loading state until id is available
    if (!id || typeof id !== 'string') return;

    // id is present but not a valid UUID — stop loading and surface an error
    if (!UUID_RE.test(id)) {
      setIsLoading(false);
      setError('Invalid pet id');
      return;
    }

    // Use sanitized copy to break taint flow
    const safeId = id.replace(/[^0-9a-f-]/gi, '');

    const controller = new AbortController();
    let cancelled = false;

    const fetchPet = async () => {
      try {
        setIsLoading(true);
        const token = localStorage.getItem('authToken');
        const res = await fetch(`${API_BASE_URL}/pets/${safeId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error(res.status === 404 ? 'Pet not found' : 'Failed to load pet');
        }

        const data = await res.json();
        if (cancelled) return;
        setPet(data);
        setInsuranceForm(data.insuranceDetails ?? {});
      } catch (err: unknown) {
        if (cancelled || err?.name === 'AbortError') return;
        setError(err.message);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchPet();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [id]);

  useEffect(() => {
    if (!pet?.id) return;
    let cancelled = false;
    setVaccinationLoading(true);
    setProofLoading(true);
    setVaccinationError(null);
    setProofError(null);

    void vaccinationsAPI.getByPetId(pet.id)
      .then((records) => {
        if (!cancelled) setVaccinations(records);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setVaccinationError(err instanceof Error ? err.message : 'Unable to load vaccination records.');
        }
      })
      .finally(() => {
        if (!cancelled) setVaccinationLoading(false);
      });

    void zkpService.getProofsForPet(pet.id)
      .then((proofs) => {
        if (!cancelled) setZkpProofs(proofs);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setProofError(err instanceof Error ? err.message : 'Unable to load vaccination proof status.');
        }
      })
      .finally(() => {
        if (!cancelled) setProofLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [pet?.id]);

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <span>Loading pet details...</span>
        </div>
      </div>
    );
  }

  if (error || !pet) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <h2>Something went wrong</h2>
          <p>{error || 'Pet not found'}</p>
        </div>
      </div>
    );
  }

  const primaryPhoto = pet.photos?.find((p) => p.isPrimary);
  const age = getAge(pet.dateOfBirth);

  const handlePrintCard = () => {
    if (typeof window === 'undefined') return;
    window.print();
  };

  const handleInsuranceSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!pet) return;
    setIsSavingInsurance(true);
    setInsuranceMessage(null);

    const insuranceDetails: PetInsuranceDetails = {
      provider: insuranceForm.provider?.trim() || undefined,
      policyNumber: insuranceForm.policyNumber?.trim() || undefined,
      expiryDate: insuranceForm.expiryDate?.trim() || undefined,
      coverageSummary: insuranceForm.coverageSummary?.trim() || undefined,
    };
    const hasInsuranceDetails = Object.values(insuranceDetails).some(Boolean);

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE_URL}/pets/${encodeURIComponent(pet.id)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          insuranceDetails: hasInsuranceDetails ? insuranceDetails : null,
        }),
      });
      if (!response.ok) {
        throw new Error(response.status === 404
          ? 'Pet not found'
          : 'Unable to save insurance details');
      }

      setPet((current) =>
        current
          ? { ...current, insuranceDetails: hasInsuranceDetails ? insuranceDetails : undefined }
          : current,
      );
      setInsuranceForm(insuranceDetails);
      setInsuranceMessage('Insurance details saved.');
    } catch (err: unknown) {
      setInsuranceMessage(err instanceof Error ? err.message : 'Unable to save insurance details.');
    } finally {
      setIsSavingInsurance(false);
    }
  };

  const insuranceExpiryDays = pet.insuranceDetails?.expiryDate
    ? getDaysUntil(pet.insuranceDetails.expiryDate)
    : null;

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <button className={styles.backButton} onClick={() => router.back()}>
          <ArrowLeft size={16} />
          Back
        </button>

        <div className={styles.petHeader}>
          <Avatar
            src={primaryPhoto?.thumbnailUrl || primaryPhoto?.photoUrl}
            name={pet.name}
            type="pet"
            species={pet.species}
            size={80}
            className={styles.petAvatar}
            sizes="80px"
          />
          <div className={styles.petInfo}>
            <h1>{pet.name}</h1>
            <div className={styles.petMeta}>
              <span className={styles.metaItem}>{capitalize(pet.species)}</span>
              {pet.breed && <span className={styles.metaItem}>{pet.breed.name}</span>}
              {age && <span className={styles.metaItem}>{age}</span>}
            </div>
          </div>
        </div>

        <CareSetupChecklist petId={pet.id} petName={pet.name} createdAt={pet.createdAt} />

        <section className={styles.section} aria-labelledby="pet-health-title">
          <h2 id="pet-health-title" className={styles.sectionTitle}>Health</h2>
          <HealthScoreExplanation petId={pet.id} />
          <div className="mt-6">
            <ResultsDashboard petId={pet.id} />
          </div>
          <div className="mt-8">
            <AttachmentQueueView petId={pet.id} />
          </div>
        </section>

        <section className={styles.section} aria-labelledby="vaccinations-title">
          <h2 id="vaccinations-title" className={styles.sectionTitle}>Vaccination records</h2>
          {vaccinationLoading ? (
            <p role="status">Loading vaccination records…</p>
          ) : vaccinationError ? (
            <p role="alert" className="text-sm text-red-700">{vaccinationError}</p>
          ) : vaccinations.length === 0 ? (
            <p className="text-sm text-gray-600">No vaccination records yet.</p>
          ) : (
            <ul className="space-y-4">
              {vaccinations.map((vaccination) => {
                const proof = zkpProofs.find(
                  (item) => item.vaccinationId === vaccination.id,
                );
                return (
                  <li
                    key={vaccination.id}
                    className="rounded-xl border border-gray-200 bg-white p-4"
                  >
                    <p className="font-semibold text-gray-900">{vaccination.vaccineName}</p>
                    <p className="mt-1 text-sm text-gray-600">
                      Administered {new Date(vaccination.administeredDate).toLocaleDateString()}
                    </p>
                    <div className="mt-3">
                      <ZkpVaccinationProof
                        vaccinationId={vaccination.id}
                        vaccineName={vaccination.vaccineName}
                        existingProof={proof}
                        proofStatusUnavailable={proofLoading || Boolean(proofError)}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {proofError && (
            <p role="alert" className="mt-3 text-sm text-amber-800">
              {proofError}
            </p>
          )}
        </section>

        {/* Sharing Section */}
        <div className={styles.section}>
          <PetSharingSummary petId={pet.id} />
        </div>

        {/* QR Code Section */}
        <div className={styles.section}>
          <div className="flex items-center justify-between mb-4">
            <h2 className={styles.sectionTitle}>QR Tag</h2>
            <button
              onClick={() => router.push(`/qrcode?petId=${pet.id}`)}
              className="flex items-center gap-2 text-sm bg-gray-900 text-white px-4 py-2 rounded-full hover:bg-gray-700 transition-all"
            >
              <QrCode size={14} /> Manage QR Codes
            </button>
          </div>
          <EmergencyQR petId={pet.id} petName={pet.name} />
        </div>

        {/* Pet Identity Card Section */}
        <div className={styles.section}>
          <div className="flex items-center justify-between mb-4">
            <h2 className={styles.sectionTitle}>Identity Card</h2>
            <button
              onClick={handlePrintCard}
              className="flex items-center gap-2 text-sm bg-gray-900 text-white px-4 py-2 rounded-full hover:bg-gray-700 transition-all"
            >
              <Printer size={14} /> Print / Download Card
            </button>
          </div>
          <div ref={cardRef} className="pet-identity-card-print">
            <PetIdentityCard
              pet={{
                id: pet.id,
                name: pet.name,
                species: capitalize(pet.species),
                breed: pet.breed,
                photoUrl: primaryPhoto?.photoUrl || primaryPhoto?.thumbnailUrl || null,
                microchipNumber: pet.microchipNumber,
              }}
              format="credit-card"
            />
          </div>
          <style jsx global>{`
            @media print {
              body * {
                visibility: hidden;
              }
              .pet-identity-card-print,
              .pet-identity-card-print * {
                visibility: visible;
              }
              .pet-identity-card-print {
                position: absolute;
                top: 0;
                left: 0;
              }
              @page {
                size: auto;
                margin: 8mm;
              }
            }
          `}</style>
        </div>

        {/* Pet Photos Section */}
        <div className={styles.section}>
          <PetPhotosManager petId={pet.id} />
        </div>

        {/* Pet Documents Section */}
        <div className={styles.section}>
          <PetDocumentsManager petId={pet.id} />
        </div>

        {/* Pet Details Section */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Details</h2>
          <div className={styles.detailGrid}>
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>Gender</span>
              <span className={styles.detailValue}>{capitalize(pet.gender)}</span>
            </div>
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>Date of Birth</span>
              <span className={styles.detailValue}>{formatDate(pet.dateOfBirth)}</span>
            </div>
            {pet.weight != null && (
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Weight</span>
                <span className={styles.detailValue}>{pet.weight} kg</span>
              </div>
            )}
            {pet.color && (
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Color</span>
                <span className={styles.detailValue}>{pet.color}</span>
              </div>
            )}
            {pet.microchipNumber && (
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Microchip</span>
                <span className={styles.detailValue}>{pet.microchipNumber}</span>
              </div>
            )}
            {pet.specialNeeds && (
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Special Needs</span>
                <span className={styles.detailValue}>{pet.specialNeeds}</span>
              </div>
            )}
          </div>
          <div className="mt-8 border-t border-gray-200 pt-6">
            <h3 className="text-lg font-semibold text-gray-900">Insurance details</h3>
            {insuranceExpiryDays !== null && insuranceExpiryDays <= 30 && (
              <p role="alert" className="mt-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                {insuranceExpiryDays < 0
                  ? 'This insurance policy has expired.'
                  : `This insurance policy expires in ${insuranceExpiryDays} day${insuranceExpiryDays === 1 ? '' : 's'}.`}
              </p>
            )}
            <form onSubmit={handleInsuranceSave} className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium text-gray-700">
                Provider
                <input
                  value={insuranceForm.provider ?? ''}
                  onChange={(event) =>
                    setInsuranceForm((form) => ({ ...form, provider: event.target.value }))
                  }
                  className="mt-1 block w-full rounded-lg border border-gray-300 p-2"
                />
              </label>
              <label className="text-sm font-medium text-gray-700">
                Policy number
                <input
                  value={insuranceForm.policyNumber ?? ''}
                  onChange={(event) =>
                    setInsuranceForm((form) => ({ ...form, policyNumber: event.target.value }))
                  }
                  className="mt-1 block w-full rounded-lg border border-gray-300 p-2"
                />
              </label>
              <label className="text-sm font-medium text-gray-700">
                Expiry date
                <input
                  type="date"
                  value={insuranceForm.expiryDate ?? ''}
                  onChange={(event) =>
                    setInsuranceForm((form) => ({ ...form, expiryDate: event.target.value }))
                  }
                  className="mt-1 block w-full rounded-lg border border-gray-300 p-2"
                />
              </label>
              <label className="text-sm font-medium text-gray-700 sm:col-span-2">
                Coverage summary
                <textarea
                  value={insuranceForm.coverageSummary ?? ''}
                  onChange={(event) =>
                    setInsuranceForm((form) => ({ ...form, coverageSummary: event.target.value }))
                  }
                  rows={3}
                  className="mt-1 block w-full rounded-lg border border-gray-300 p-2"
                />
              </label>
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={isSavingInsurance}
                  className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {isSavingInsurance ? 'Saving…' : 'Save insurance details'}
                </button>
                {insuranceMessage && (
                  <p role="status" className="mt-2 text-sm text-gray-700">{insuranceMessage}</p>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

function capitalize(value: string): string {
  if (!value) return '';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatDate(value: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

function getAge(dateOfBirth: string): string | null {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let years = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) {
    years--;
  }
  if (years < 1) {
    const months = Math.max(
      0,
      (now.getFullYear() - dob.getFullYear()) * 12 + (now.getMonth() - dob.getMonth())
    );
    return `${months} mo`;
  }
  return `${years} year${years === 1 ? '' : 's'} old`;
}

function getDaysUntil(date: string): number | null {
  const expiryDate = new Date(`${date}T00:00:00`);
  if (Number.isNaN(expiryDate.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((expiryDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}

function capitalize(value: string): string {
  if (!value) return '';
  return value.charAt(0).toUpperCase() + value.slice(1);
}
