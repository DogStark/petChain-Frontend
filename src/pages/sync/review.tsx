/**
 * /sync/review — Offline sync review page (issue #1142)
 *
 * Shows queued offline changes and conflicts before replay. Accessible and
 * protected; requires an active session.
 */

import React, { useCallback } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import ProtectedRoute from '@/components/ProtectedRoute';
import SyncReviewScreen from '@/components/SyncReviewScreen';
import { useOffline } from '@/hooks/useOffline';
import { useAuth } from '@/contexts/AuthContext';

function SyncReviewContent() {
  const router = useRouter();
  const { triggerSync } = useOffline();
  const { user, tokens } = useAuth();

  const handleConfirmSync = useCallback(async () => {
    // Trigger full queue replay and navigate to a stable page when done.
    await triggerSync();
    void router.replace('/');
  }, [triggerSync, router]);

  const handleDismiss = useCallback(() => {
    // Go back or fall back to home.
    if (window.history.length > 1) {
      router.back();
    } else {
      void router.replace('/');
    }
  }, [router]);

  return (
    <>
      <Head>
        <title>Review queued changes — PetChain</title>
        {/* This page shows user-specific offline data; prevent indexing. */}
        <meta name="robots" content="noindex,nofollow,noarchive" />
        <meta name="referrer" content="no-referrer" />
      </Head>

      <div className="min-h-screen bg-gray-50">
        {/* Slim navigation bar */}
        <nav
          className="border-b border-gray-200 bg-white px-4 py-3"
          aria-label="Sync review navigation"
        >
          <Link
            href="/"
            className="text-sm font-medium text-blue-700 hover:text-blue-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            ← PetChain
          </Link>
        </nav>

        <SyncReviewScreen
          onConfirmSync={handleConfirmSync}
          onDismiss={handleDismiss}
        />
      </div>
    </>
  );
}

export default function SyncReviewPage() {
  return (
    <ProtectedRoute>
      <SyncReviewContent />
    </ProtectedRoute>
  );
}
