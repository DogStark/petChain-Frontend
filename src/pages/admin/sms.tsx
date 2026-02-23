import React from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { SMSDashboard } from '../../components/Admin/SMSDashboard';
import styles from '../../styles/pages/PreferencesPage.module.css';

export default function AdminSMSPage() {
  const router = useRouter();

  return (
    <>
      <Head>
        <title>SMS Dashboard | PetChain Admin</title>
      </Head>
      <div className={styles.container}>
        <SMSDashboard />
      </div>
    </>
  );
}
