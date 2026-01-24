import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { ProfileEditForm } from '../components/Profile/ProfileEditForm';
import { userAPI, UserProfile } from '../lib/api/userAPI';
import styles from '../styles/pages/ProfilePage.module.css';

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const profile = await userAPI.getCurrentProfile();
        setUser(profile);
      } catch (err: any) {
        setError(err.message || 'Failed to load profile');
        // Redirect to login if unauthorized
        if (err.response?.status === 401) {
          router.push('/login');
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadProfile();
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

      {user && (
        <ProfileEditForm
          user={user}
          onSubmit={handleProfileSubmit}
          onAvatarUpload={handleAvatarUpload}
          isLoading={isLoading}
        />
      )}
    </div>
  );
}
