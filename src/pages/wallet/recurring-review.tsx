/**
 * /wallet/recurring-review — Dedicated route for reviewing upcoming recurring Stellar payment intents
 * before a transaction is signed.
 */

import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { ChevronRight, ArrowLeft, Wallet } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useWallet } from '@/hooks/useWallet';
import { isTestnetNetwork } from '@/lib/blockchain/network';
import RecurringPaymentReview from '@/components/Wallet/RecurringPaymentReview';

export default function RecurringPaymentReviewPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { selectedWallet, wallets } = useWallet();

  const isTestnet = isTestnetNetwork();

  React.useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  if (authLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Review Recurring Stellar Payments — PetChain</title>
        <meta name="robots" content="noindex,nofollow,noarchive" />
      </Head>

      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
            <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
              <Link href="/wallet" className="hover:text-gray-600 flex items-center gap-1">
                <ArrowLeft size={14} aria-hidden="true" />
                <span>Wallet</span>
              </Link>
              <ChevronRight size={14} />
              <span className="text-gray-700 font-medium">Recurring Payment Review</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Recurring Payment Review</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Inspect upcoming recurring payment intents, next execution time, spending cap, and cancellation status before signing.
            </p>
          </div>
        </div>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {!selectedWallet && wallets.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center max-w-lg mx-auto">
              <Wallet size={40} className="mx-auto text-gray-400 mb-3" aria-hidden="true" />
              <h2 className="text-lg font-bold text-gray-900">No Wallet Connected</h2>
              <p className="text-sm text-gray-500 mt-1 mb-4">
                Please create or import a Stellar wallet before reviewing recurring payment schedules.
              </p>
              <Link
                href="/wallet"
                className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                Go to Wallet Setup
              </Link>
            </div>
          ) : (
            <RecurringPaymentReview
              sourcePublicKey={selectedWallet?.publicKey || (wallets[0]?.publicKey ?? '')}
              onProceedToSign={(intent) => {
                void router.push('/wallet?tab=send');
              }}
              onClose={() => {
                void router.push('/wallet');
              }}
              isTestnet={isTestnet}
            />
          )}
        </main>
      </div>
    </>
  );
}
