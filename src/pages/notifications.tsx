import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { NotificationList } from '../components/Notifications/NotificationList';
import { userAPI } from '../lib/api/userAPI';
import Header from '../components/Header';
import styles from '../styles/pages/NotificationsPage.module.css';

export default function NotificationsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const userProfile = await userAPI.getCurrentProfile();
        setProfile(userProfile);
      } catch (err: any) {
        console.error('Failed to load profile', err);
        setError('Failed to authenticate');
        if (err.response?.status === 401) {
          router.push('/login');
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadProfile();
  }, [router]);

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loader}></div>
        <p>Loading your notifications...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Head>
        <title>Notifications | PetChain</title>
      </Head>

      <Header />

      <main className={styles.main}>
        {error ? (
          <div className={styles.errorContainer}>
            <p>{error}</p>
            <button onClick={() => router.push('/login')}>Go to Login</button>
          </div>
        ) : (
          profile && <NotificationList userId={profile.id} />
        )}
      </main>
    </div>
  );
}
