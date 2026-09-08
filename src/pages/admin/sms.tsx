import React from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { GetServerSideProps } from 'next';
import { SMSDashboard } from '../../components/Admin/SMSDashboard';
import ProtectedRoute from '../../components/ProtectedRoute';
import styles from '../../styles/pages/PreferencesPage.module.css';

export const dynamic = 'force-dynamic';

export default function AdminSMSPage() {
  const router = useRouter();

  return (
    <ProtectedRoute requireAdmin>
      <Head>
        <title>SMS Dashboard | PetChain Admin</title>
      </Head>
      <div className={styles.container}>
        <SMSDashboard />
      </div>
    </ProtectedRoute>
  );
}

export const getServerSideProps: GetServerSideProps = async () => {
  return {
    props: {},
  };
};
