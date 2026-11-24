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
  return `${years} yr`;
}
