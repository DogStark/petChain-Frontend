import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '../contexts/AuthContext';
import TwoFactorVerify from '../components/Settings/TwoFactorVerify';
import { TouchInput, TouchButton } from '../components/TouchUI';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show2FA, setShow2FA] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { login, loginWith2FA, recoverWith2FA } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Prevent double-submit
    if (isLoading) return;
    setIsLoading(true);
    setError('');

    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err) {
      if (err instanceof Error && err.message === '2FA_REQUIRED') {
        setShow2FA(true);
      } else {
        const msg = err instanceof Error ? err.message : 'Login failed';
        setError(msg === 'Invalid credentials' ? 'Invalid email or password. Please try again.' : msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handle2FAVerify = async (token: string) => {
    await loginWith2FA(email, password, token);
    router.push('/dashboard');
  };

  const handle2FARecover = async (backupCode: string) => {
    await recoverWith2FA(email, password, backupCode);
    router.push('/dashboard');
  };

  if (show2FA) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
        <TwoFactorVerify
          email={email}
          password={password}
          onVerify={handle2FAVerify}
          onRecover={handle2FARecover}
          onCancel={() => setShow2FA(false)}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 px-4 py-12">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <Image src="/PETCHAIN.jpeg" alt="PetChain" width={64} height={64} className="rounded-2xl shadow-md" />
          <h1 className="text-2xl font-bold text-gray-900">Sign in to PetChain</h1>
          <p className="text-sm text-gray-500">
            No account?{' '}
            <Link href="/register" className="font-semibold text-blue-600 hover:text-blue-700">
              Create one
            </Link>
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5"
        >
          <TouchInput
            label="Email address"
            fieldType="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            autoFocus
          />

          <TouchInput
            label="Password"
            fieldType="password"
            showPasswordToggle
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />

          {error && (
            <div role="alert" className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-start gap-2">
              <svg className="w-4 h-4 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2a10 10 0 100 20A10 10 0 0012 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
              </svg>
              {error}
            </div>
          )}

          <div className="flex justify-end">
            <Link href="/forgot-password" className="text-sm text-blue-600 hover:text-blue-700 font-medium min-h-[44px] flex items-center">
              Forgot password?
            </Link>
          </div>

          <TouchButton type="submit" fullWidth loading={isLoading} haptic="medium" size="lg">
            Sign in
          </TouchButton>
        </form>
      </div>
    </div>
  );
}
