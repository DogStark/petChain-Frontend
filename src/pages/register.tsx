import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Image from 'next/image';
import { GetServerSideProps } from 'next';
import { useAuth } from '../contexts/AuthContext';
import PasswordStrengthMeter from '../components/PasswordStrengthMeter';
import { validatePassword, isPasswordReused, savePasswordToHistory } from '../utils/passwordPolicy';
import { TouchInput, TouchButton } from '../components/TouchUI';

export const dynamic = 'force-dynamic';

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    phone: '',
  });
  const [errors, setErrors] = useState<Partial<typeof formData>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const { register } = useAuth();
  const router = useRouter();

  const set = (field: keyof typeof formData) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
    // Clear field error on change
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const validate = (): boolean => {
    const next: Partial<typeof formData> = {};

    if (!formData.firstName.trim()) next.firstName = 'First name is required';
    if (!formData.lastName.trim()) next.lastName = 'Last name is required';
    if (!formData.email.trim()) next.email = 'Email is required';
    if (!/^\+?[1-9]\d{7,14}$/.test(formData.phone.replace(/\s+/g, ''))) {
      next.phone = 'Enter a valid phone number in international format';
    }

    const { valid, errors: pwErrors } = validatePassword(formData.password);
    if (!valid) next.password = pwErrors[0];
    else if (isPasswordReused(formData.password)) next.password = 'This password was used recently';

    if (formData.password !== formData.confirmPassword) {
      next.confirmPassword = 'Passwords do not match';
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    setSubmitError('');
    if (!validate()) return;

    setIsLoading(true);
    try {
      await register(
        formData.email,
        formData.password,
        formData.firstName,
        formData.lastName,
        formData.phone
      );
      savePasswordToHistory(formData.password);
      router.push(`/verify-account?email=${encodeURIComponent(formData.email)}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 px-4 py-12">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <Image
            src="/PETCHAIN.jpeg"
            alt="PetChain"
            width={64}
            height={64}
            className="rounded-2xl shadow-md"
          />
          <h1 className="text-2xl font-bold text-gray-900">Create your account</h1>
          <p className="text-sm text-gray-500">
            Already have one?{' '}
            <Link href="/login" className="font-semibold text-blue-600 hover:text-blue-700">
              Sign in
            </Link>
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5"
        >
          <div className="grid grid-cols-2 gap-3">
            <TouchInput
              label="First name"
              fieldType="text"
              autoComplete="given-name"
              value={formData.firstName}
              onChange={set('firstName')}
              placeholder="Jane"
              required
              error={errors.firstName}
            />
            <TouchInput
              label="Last name"
              fieldType="text"
              autoComplete="family-name"
              value={formData.lastName}
              onChange={set('lastName')}
              placeholder="Doe"
              required
              error={errors.lastName}
            />
          </div>

          <TouchInput
            label="Email address"
            fieldType="email"
            value={formData.email}
            onChange={set('email')}
            placeholder="you@example.com"
            required
            error={errors.email}
          />

          <TouchInput
            label="Phone number"
            fieldType="phone"
            value={formData.phone}
            onChange={set('phone')}
            placeholder="+1 555 123 4567"
            required
            hint="SMS-capable number for verification"
            error={errors.phone}
          />

          <div className="space-y-1.5">
            <TouchInput
              label="Password"
              fieldType="new-password"
              showPasswordToggle
              value={formData.password}
              onChange={set('password')}
              placeholder="••••••••"
              required
              error={errors.password}
            />
            <PasswordStrengthMeter password={formData.password} />
          </div>

          <TouchInput
            label="Confirm password"
            fieldType="new-password"
            showPasswordToggle
            value={formData.confirmPassword}
            onChange={set('confirmPassword')}
            placeholder="••••••••"
            required
            error={errors.confirmPassword}
          />

          {submitError && (
            <div
              role="alert"
              className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"
            >
              {submitError}
            </div>
          )}

          <TouchButton type="submit" fullWidth loading={isLoading} haptic="medium" size="lg">
            Create account
          </TouchButton>
        </form>
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async () => {
  return {
    props: {},
  };
};
