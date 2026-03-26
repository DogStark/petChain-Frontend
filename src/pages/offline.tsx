import Head from 'next/head';
import Image from 'next/image';
import Link from 'next/link';

export default function OfflinePage() {
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
        <p className="text-gray-600 max-w-sm mb-8">
          No internet connection detected. Some features may be unavailable, but your cached pet
          records are still accessible.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href="/pets"
            className="px-6 py-3 bg-blue-600 text-white rounded-full font-semibold hover:bg-blue-700 transition-colors"
          >
            View Cached Pets
          </Link>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 border border-blue-600 text-blue-600 rounded-full font-semibold hover:bg-blue-50 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    </>
  );
}
