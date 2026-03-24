import TwoFactorSettings from '../components/Settings/TwoFactorSettings';

export default function TwoFactorPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-8">Two-Factor Authentication</h1>
        <TwoFactorSettings />
      </div>
    </div>
  );
}