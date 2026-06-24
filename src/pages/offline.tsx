import { useEffect, useState } from 'react';
import Head from 'next/head';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/router';

export default function OfflinePage() {
  const router = useRouter();
  const [isRetrying, setIsRetrying] = useState(false);

  // Auto-redirect when connection is restored
  useEffect(() => {
    const handleOnline = () => {
      router.replace('/');
    };

    window.addEventListener('online', handleOnline);
    // If already online (e.g. navigated here directly), redirect immediately
    if (navigator.onLine) {
      router.replace('/');
    }

    return () => window.removeEventListener('online', handleOnline);
  }, [router]);

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      const res = await fetch('/', { method: 'HEAD', cache: 'no-store' });
      if (res.ok) {
        router.replace('/');
        return;
      }
    } catch {
      // still offline
    }
    setIsRetrying(false);
  };

  return (
    <>
      <Head>
        <title>Offline - PetChain</title>
      </Head>
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-blue-50 to-green-50 flex flex-col items-center justify-center px-4 text-center">
        <Image
          src="/PETCHAIN.jpeg"
          alt="PetChain"
          width={80}
          height={80}
          className="rounded-2xl shadow-lg mb-6"
        />
        <h1 className="text-3xl font-bold text-blue-700 mb-3">You&apos;re offline</h1>
        <p className="text-gray-600 max-w-sm mb-2">
          No internet connection detected. Some features may be unavailable, but your cached pet
          records are still accessible.
        </p>
        <p className="text-sm text-gray-400 mb-8">
          You&apos;ll be redirected automatically when your connection is restored.
        </p>

        <div className="w-full max-w-xs bg-white/70 rounded-2xl p-4 mb-8 text-left shadow-sm border border-white/60">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Available offline
          </p>
          <ul className="space-y-1 text-sm text-gray-700">
            <li>✓ Cached pet profiles</li>
            <li>✓ Saved medical records</li>
            <li>✓ Emergency contact info</li>
          </ul>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href="/pets"
            className="px-6 py-3 bg-blue-600 text-white rounded-full font-semibold hover:bg-blue-700 transition-colors"
          >
            View Cached Pets
          </Link>
          <button
            onClick={handleRetry}
            disabled={isRetrying}
            className="px-6 py-3 border border-blue-600 text-blue-600 rounded-full font-semibold hover:bg-blue-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isRetrying ? 'Checking…' : 'Retry Connection'}
          </button>
        </div>
      </div>
    </>
  );
}
