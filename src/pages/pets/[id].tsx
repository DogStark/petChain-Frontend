import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { ArrowLeft, PawPrint } from 'lucide-react';
import { PetPhotosManager } from '@/components/PetPhotos';
import styles from '@/styles/pages/PetDetailPage.module.css';

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
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

export default function PetDetailPage() {
  const router = useRouter();
  const { id } = router.query;

  const [pet, setPet] = useState<Pet | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id || typeof id !== 'string') return;

    const fetchPet = async () => {
      try {
        setIsLoading(true);
        const token = localStorage.getItem('authToken');
        const res = await fetch(`${API_BASE_URL}/pets/${id}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        if (!res.ok) {
          throw new Error(
            res.status === 404 ? 'Pet not found' : 'Failed to load pet',
          );
        }

        const data = await res.json();
        setPet(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPet();
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

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <button className={styles.backButton} onClick={() => router.back()}>
          <ArrowLeft size={16} />
          Back
        </button>

        <div className={styles.petHeader}>
          {primaryPhoto ? (
            <img
              src={primaryPhoto.thumbnailUrl || primaryPhoto.photoUrl}
              alt={pet.name}
              className={styles.petAvatar}
            />
          ) : (
            <div className={styles.petAvatar}>
              <PawPrint size={32} />
            </div>
          )}
          <div className={styles.petInfo}>
            <h1>{pet.name}</h1>
            <div className={styles.petMeta}>
              <span className={styles.metaItem}>
                {capitalize(pet.species)}
              </span>
              {pet.breed && (
                <span className={styles.metaItem}>{pet.breed.name}</span>
              )}
              {age && <span className={styles.metaItem}>{age}</span>}
            </div>
          </div>
        </div>

        {/* Pet Photos Section */}
        <div className={styles.section}>
          <PetPhotosManager petId={pet.id} />
        </div>

        {/* Pet Details Section */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Details</h2>
          <div className={styles.detailGrid}>
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>Species</span>
              <span className={styles.detailValue}>
                {capitalize(pet.species)}
              </span>
            </div>
            {pet.breed && (
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Breed</span>
                <span className={styles.detailValue}>{pet.breed.name}</span>
              </div>
            )}
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>Gender</span>
              <span className={styles.detailValue}>
                {capitalize(pet.gender)}
              </span>
            </div>
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>Date of Birth</span>
              <span className={styles.detailValue}>
                {new Date(pet.dateOfBirth).toLocaleDateString()}
              </span>
            </div>
            {pet.weight && (
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
                <span className={styles.detailValue}>
                  {pet.microchipNumber}
                </span>
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

function capitalize(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function getAge(dateOfBirth: string): string | null {
  const dob = new Date(dateOfBirth);
  if (isNaN(dob.getTime())) return null;

  const now = new Date();
  let years = now.getFullYear() - dob.getFullYear();
  let months = now.getMonth() - dob.getMonth();

  if (months < 0 || (months === 0 && now.getDate() < dob.getDate())) {
    years--;
    months += 12;
  }

  if (years > 0) return `${years} yr${years !== 1 ? 's' : ''} old`;
  if (months > 0) return `${months} mo${months !== 1 ? 's' : ''} old`;
  return 'Newborn';
}
