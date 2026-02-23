import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { ProfileEditForm } from '../components/Profile/ProfileEditForm';
import { EmergencyContactForm } from '../components/Profile/EmergencyContactForm';
import { EmergencyQR } from '../components/Profile/EmergencyQR';
import { userAPI, UserProfile } from '../lib/api/userAPI';
import { petAPI } from '../lib/api/petAPI';
import { PetEmergencyInfo } from '../types/pet';
import styles from '../styles/pages/ProfilePage.module.css';

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [emergencyInfo, setEmergencyInfo] = useState<PetEmergencyInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [profile, emergency] = await Promise.all([
          userAPI.getCurrentProfile(),
          petAPI.getPetEmergencyInfo('pet-001'), // Hardcoded for demo/onboarding
        ]);
        setUser(profile);
        setEmergencyInfo(emergency);
      } catch (err: any) {
        setError(err.message || 'Failed to load profile data');
        // Redirect to login if unauthorized
        if (err.response?.status === 401) {
          router.push('/login');
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [router]);

  const handleProfileSubmit = async (data: any) => {
    try {
      setIsLoading(true);
      const updated = await userAPI.updateProfile(data);
      setUser(updated);
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmergencySave = async (data: PetEmergencyInfo) => {
    try {
      setIsLoading(true);
      const updated = await petAPI.updatePetEmergencyInfo('pet-001', data);
      setEmergencyInfo(updated);
    } catch (err: any) {
      setError(err.message || 'Failed to save emergency contacts');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAvatarUpload = async (file: File) => {
    try {
      setIsLoading(true);
      const result = await userAPI.uploadAvatar(file);
      setUser(result.user);
    } catch (err: any) {
      setError(err.message || 'Failed to upload avatar');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && !user) {
    return <div className={styles.loading}>Loading profile...</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>User Profile</h1>
        <p>Manage your personal information and profile</p>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {user && (
            <ProfileEditForm
              user={user}
              onSubmit={handleProfileSubmit}
              onAvatarUpload={handleAvatarUpload}
              isLoading={isLoading}
            />
          )}

          <EmergencyContactForm
            initialData={emergencyInfo || undefined}
            onSave={handleEmergencySave}
            isLoading={isLoading}
          />
        </div>

        <div className="lg:col-span-1">
          <div className="sticky top-24">
            <EmergencyQR petId="pet-001" petName="Max" />
          </div>
        </div>
      </div>
    </div>
  );
}
