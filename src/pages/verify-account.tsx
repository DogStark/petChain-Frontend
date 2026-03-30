import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';
import { GetServerSideProps } from 'next';

export const dynamic = 'force-dynamic';

export default function VerifyAccountPage() {
  const router = useRouter();
  const initialEmail = useMemo(() => {
    const value = router.query.email;
    return typeof value === 'string' ? value : '';
  }, [router.query.email]);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [emailVerified, setEmailVerified] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResendingEmail, setIsResendingEmail] = useState(false);
  const [isResendingPhone, setIsResendingPhone] = useState(false);
  const { verifyPhone, resendEmailVerification, resendPhoneVerification } = useAuth();

  useEffect(() => {
    setEmail(initialEmail);
  }, [initialEmail]);

  useEffect(() => {
    if (router.query.emailVerified === '1') {
      setEmailVerified(true);
    }
  }, [router.query.emailVerified]);

  const handleVerifyPhone = async (event: FormEvent) => {
    event.preventDefault();
    if (!email) {
      setError('We could not determine which account to verify.');
      return;
    }

    setIsSubmitting(true);
    setError('');
    setMessage('');

    try {
      const result = await verifyPhone(email, code);
      setPhoneVerified(result.phoneVerified);
      setEmailVerified(result.emailVerified);
      setMessage(result.message);
      if (result.isVerified) {
        router.push('/login?verified=1');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Phone verification failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendEmail = async () => {
    if (!email) {
      setError('Enter registration again to request a new email link.');
      return;
    }

    setIsResendingEmail(true);
    setError('');
    setMessage('');
    try {
      await resendEmailVerification(email);
      setMessage('A fresh email verification link has been sent.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to resend email verification');
    } finally {
      setIsResendingEmail(false);
    }
  };

  const handleResendPhone = async () => {
    if (!email) {
      setError('Enter registration again to request a new phone code.');
      return;
    }

    setIsResendingPhone(true);
    setError('');
    setMessage('');
    try {
      await resendPhoneVerification(email);
      setMessage('A new SMS verification code has been sent.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to resend phone verification');
    } finally {
      setIsResendingPhone(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-extrabold text-gray-900">Verify your account</h1>
          <p className="mt-2 text-sm text-gray-600">
            Finish email and phone verification to unlock your new PetChain account.
          </p>
          <div className="mt-4 text-left">
            <label htmlFor="accountEmail" className="block text-sm font-medium text-gray-700">
              Account email
            </label>
            <input
              id="accountEmail"
              name="accountEmail"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="you@example.com"
            />
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Email verification</span>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${emailVerified ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}
            >
              {emailVerified ? 'Verified' : 'Pending'}
            </span>
          </div>
          <p className="text-sm text-gray-600">
            Use the link sent to your inbox. It expires in 24 hours.
          </p>
          <button
            type="button"
            onClick={handleResendEmail}
            disabled={isResendingEmail}
            className="w-full rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isResendingEmail ? 'Resending email...' : 'Resend email link'}
          </button>
        </div>

        <form
          onSubmit={handleVerifyPhone}
          className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm space-y-4"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Phone verification</span>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${phoneVerified ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}
            >
              {phoneVerified ? 'Verified' : 'Pending'}
            </span>
          </div>
          <p className="text-sm text-gray-600">
            Enter the 6-digit code from the SMS we sent. Codes expire in 24 hours.
          </p>
          <div>
            <label htmlFor="code" className="block text-sm font-medium text-gray-700">
              SMS verification code
            </label>
            <input
              id="code"
              name="code"
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="123456"
              required
            />
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Verifying phone...' : 'Verify phone'}
          </button>
          <button
            type="button"
            onClick={handleResendPhone}
            disabled={isResendingPhone}
            className="w-full rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isResendingPhone ? 'Resending code...' : 'Resend SMS code'}
          </button>
        </form>

        {message && (
          <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {message}
          </div>
        )}

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="text-center text-sm text-gray-600">
          <Link href="/login" className="font-medium text-blue-600 hover:text-blue-500">
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async () => {
  return {
    props: {},
  };
};
