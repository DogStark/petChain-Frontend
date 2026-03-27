import React, { useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import {
  LayoutDashboard,
  Plus,
  Send,
  Shield,
  Download,
  RotateCcw,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useWallet } from '../hooks/useWallet';
import WalletDashboard from '../components/Wallet/WalletDashboard';
import WalletSetup from '../components/Wallet/WalletSetup';
import WalletBackup from '../components/Wallet/WalletBackup';
import MultiSigSetup from '../components/Wallet/MultiSigSetup';
import TransactionSigning from '../components/Wallet/TransactionSigning';
import WalletRecovery from '../components/Wallet/WalletRecovery';

export const dynamic = 'force-dynamic';

type Tab = 'overview' | 'setup' | 'send' | 'multisig' | 'backup' | 'recovery';

interface NavItem {
  id: Tab;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const NAV: NavItem[] = [
  {
    id: 'overview',
    label: 'Overview',
    icon: <LayoutDashboard size={18} />,
    description: 'Balances & address',
  },
  { id: 'setup', label: 'Add Wallet', icon: <Plus size={18} />, description: 'Create or import' },
  { id: 'send', label: 'Send', icon: <Send size={18} />, description: 'Sign & broadcast' },
  {
    id: 'multisig',
    label: 'Multi-Sig',
    icon: <Shield size={18} />,
    description: 'Co-signer config',
  },
  {
    id: 'backup',
    label: 'Backup',
    icon: <Download size={18} />,
    description: 'Export encrypted backup',
  },
  {
    id: 'recovery',
    label: 'Recovery',
    icon: <RotateCcw size={18} />,
    description: 'Restore from backup',
  },
];

const IS_TESTNET = process.env.NEXT_PUBLIC_STELLAR_NETWORK !== 'public';

export default function WalletPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const {
    wallets,
    selectedWallet,
    selectedWalletId,
    accountData,
    feeEstimate,
    loading,
    balanceLoading,
    error,
    setSelectedWalletId,
    clearError,
    createWallet,
    importWallet,
    deleteWallet,
    refreshBalance,
    sendPayment,
    setupMultiSig,
    removeSigner,
    exportBackup,
    importBackup,
    fundTestnet,
  } = useWallet();

  // Redirect to login if unauthenticated
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

  const balances = accountData?.balances ?? [];

  return (
    <>
      <Head>
        <title>Wallet — PetChain</title>
      </Head>

      <div className="min-h-screen bg-gray-50">
        {/* Page Header */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
            <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
              <span>PetChain</span>
              <ChevronRight size={14} />
              <span className="text-gray-700 font-medium">Wallet</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Wallet Management</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Custodial Stellar wallets — your keys, encrypted on your device.
              {IS_TESTNET && (
                <span className="ml-2 text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">
                  Testnet
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Sidebar Navigation */}
            <aside className="lg:w-56 flex-shrink-0">
              <nav className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                {NAV.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      clearError();
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-gray-100 last:border-0 ${
                      activeTab === item.id
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <span className={activeTab === item.id ? 'text-blue-600' : 'text-gray-400'}>
                      {item.icon}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-tight">{item.label}</p>
                      <p className="text-xs text-gray-400 truncate">{item.description}</p>
                    </div>
                  </button>
                ))}
              </nav>

              {/* Wallet count badge */}
              {wallets.length > 0 && (
                <div className="mt-3 bg-white rounded-xl border border-gray-200 px-4 py-3 text-xs text-gray-500">
                  <span className="font-semibold text-gray-800">{wallets.length}</span> wallet
                  {wallets.length !== 1 ? 's' : ''} on this device
                  {wallets.filter((w) => !w.backupVerified).length > 0 && (
                    <p className="text-yellow-600 mt-1">
                      ⚠ {wallets.filter((w) => !w.backupVerified).length} without backup
                    </p>
                  )}
                </div>
              )}
            </aside>

            {/* Main Content */}
            <main className="flex-1 min-w-0">
              {activeTab === 'overview' && (
                <WalletDashboard
                  wallets={wallets}
                  selectedWallet={selectedWallet}
                  accountData={accountData}
                  balanceLoading={balanceLoading}
                  selectedWalletId={selectedWalletId}
                  onSelectWallet={setSelectedWalletId}
                  onRefreshBalance={refreshBalance}
                  onFundTestnet={fundTestnet}
                  onAddWallet={() => setActiveTab('setup')}
                  onDeleteWallet={deleteWallet}
                  isTestnet={IS_TESTNET}
                  loading={loading}
                />
              )}

              {activeTab === 'setup' && (
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Add a Wallet</h2>
                  <WalletSetup
                    onCreateWallet={async (label, pin) => {
                      await createWallet(label, pin);
                      setActiveTab('overview');
                    }}
                    onImportWallet={async (secretKey, label, pin) => {
                      await importWallet(secretKey, label, pin);
                      setActiveTab('overview');
                    }}
                    loading={loading}
                    error={error}
                    onClearError={clearError}
                  />
                </div>
              )}

              {activeTab === 'send' && (
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Send Payment</h2>
                  <TransactionSigning
                    wallet={selectedWallet}
                    balances={balances}
                    feeEstimate={feeEstimate}
                    onSendPayment={sendPayment}
                    onRefreshFee={async () => {
                      const { walletService } = await import('../lib/wallet/walletService');
                      return walletService.estimateFee();
                    }}
                    loading={loading}
                    error={error}
                    onClearError={clearError}
                    isTestnet={IS_TESTNET}
                  />
                </div>
              )}

              {activeTab === 'multisig' && (
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">
                    Multi-Signature Setup
                  </h2>
                  <MultiSigSetup
                    wallet={selectedWallet}
                    accountData={accountData}
                    onSetupMultiSig={setupMultiSig}
                    onRemoveSigner={removeSigner}
                    loading={loading}
                    error={error}
                    onClearError={clearError}
                  />
                </div>
              )}

              {activeTab === 'backup' && (
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Wallet Backup</h2>
                  <WalletBackup wallet={selectedWallet} onExportBackup={exportBackup} />
                </div>
              )}

              {activeTab === 'recovery' && (
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Restore from Backup</h2>
                  <WalletRecovery
                    onImportBackup={async (backup, pin) => {
                      const wallet = await importBackup(backup, pin);
                      setActiveTab('overview');
                      return wallet;
                    }}
                    loading={loading}
                    error={error}
                    onClearError={clearError}
                  />
                </div>
              )}
            </main>
          </div>
        </div>
      </div>
    </>
  );
}
