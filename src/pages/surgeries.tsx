import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { surgeryAPI, Surgery, CreateSurgeryDto } from '../lib/api/surgeryAPI';
import { petAPI } from '../lib/api/petAPI';
import { SurgeryForm } from '../components/Surgery/SurgeryForm';
import { SurgeryList } from '../components/Surgery/SurgeryList';
import styles from '../styles/pages/SurgeriesPage.module.css';
import { GetServerSideProps } from 'next';

export const dynamic = 'force-dynamic';

export default function SurgeriesPage() {
  const router = useRouter();
  const { petId } = router.query;
  const [surgeries, setSurgeries] = useState<Surgery[]>([]);
  const [selectedSurgery, setSelectedSurgery] = useState<Surgery | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [petDateOfBirth, setPetDateOfBirth] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (petId) {
      loadSurgeries();
      loadPetDateOfBirth();
    }
  }, [petId]);

  const loadSurgeries = async () => {
    try {
      const data = await surgeryAPI.findAll(petId as string);
      setSurgeries(data);
    } catch (error) {
      console.error('Failed to load surgeries:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPetDateOfBirth = async () => {
    try {
      const pet = await petAPI.getPet(petId as string);
      setPetDateOfBirth(pet.dateOfBirth);
    } catch {
      // Pet data unavailable — birth date ordering validation will be skipped
    }
  };

  const handleCreate = async (data: CreateSurgeryDto, photos?: File[]) => {
    await surgeryAPI.create(data, photos);
    setShowForm(false);
    loadSurgeries();
  };

  const handleUpdate = async (data: CreateSurgeryDto, photos?: File[]) => {
    if (selectedSurgery) {
      await surgeryAPI.update(selectedSurgery.id, data, photos);
      setSelectedSurgery(null);
      loadSurgeries();
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this surgery record?')) {
      await surgeryAPI.remove(id);
      loadSurgeries();
    }
  };

  if (loading) return <div className={styles.loading}>Loading...</div>;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Surgery Records</h1>
        <button onClick={() => setShowForm(true)}>Add Surgery</button>
      </div>

      {showForm && (
        <SurgeryForm
          petId={petId as string}
          petDateOfBirth={petDateOfBirth}
          onSubmit={handleCreate}
          onCancel={() => setShowForm(false)}
        />
      )}

      {selectedSurgery && (
        <SurgeryForm
          surgery={selectedSurgery}
          petId={petId as string}
          petDateOfBirth={petDateOfBirth}
          onSubmit={handleUpdate}
          onCancel={() => setSelectedSurgery(null)}
        />
      )}

      <SurgeryList surgeries={surgeries} onSelect={setSelectedSurgery} onDelete={handleDelete} />
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async () => {
  return {
    props: {},
  };
};
