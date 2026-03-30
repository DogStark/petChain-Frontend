import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { isConnected, requestAccess, signTransaction } from "./utils/wallet-bridge";
import { Horizon, Networks, TransactionBuilder, Operation, Asset, BASE_FEE } from '@stellar/stellar-sdk';
import { ResponsiveNavigation } from './components/ResponsiveNavigation';
import { SkipLinks } from './components/SkipLinks';
import { OfflineBanner } from './components/OfflineBanner';
import { OfflineStatusIndicator } from './components/OfflineStatusIndicator';
import { OfflineErrorBoundary } from './components/OfflineErrorBoundary';
import { handleOfflineError, getOfflineErrorMessage } from './utils/offlineApi';
import { getCurrentNetworkConfig } from './utils/network-config';
import { announceToScreenReader, generateId, setupKeyboardNavigation, setupFocusVisible } from './utils/accessibility';
import { SchedulingService } from './services/schedulingService';
import { NotificationService } from './services/notificationService';
import About from './pages/About';
import Contact from './pages/Contact';
import Rate from './pages/Rate';
import ScheduledPayments from './pages/ScheduledPayments';
import { WalletBalance } from './components/WalletBalance';
import { useWalletBalance } from './hooks/useWalletBalance';
import { useFeeEstimation } from './hooks/useFeeEstimation';

function Home() {
  const { t } = useTranslation();
  const [meterId, setMeterId] = useState('');
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState('');

  const networkConfig = getCurrentNetworkConfig();
  const { isSufficientBalance, refreshBalance } = useWalletBalance();
  const { estimate: feeEstimate, estimateFee, isLoading: isEstimatingFee } = useFeeEstimation();

  // Generate unique IDs for accessibility
  const meterInputId = useRef(generateId('meter-input'));
  const amountInputId = useRef(generateId('amount-input'));
  const payButtonId = useRef(generateId('pay-button'));
  const statusId = useRef(generateId('status-message'));

  // Update fee estimation when amount changes
  useEffect(() => {
    if (amount && Number(amount) > 0) {
      estimateFee(amount);
    }
  }, [amount, estimateFee]);

  const handlePayment = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    console.log('Window freighter:', (window as any).freighter);
    console.log('Window freighterApi:', (window as any).freighterApi);
    const result = await isConnected();
    console.log('Wallet connected result:', result);
    if (!result.isConnected) {
      setStatus(t('payment.status.installWallet'));
      announceToScreenReader(t('payment.status.installWallet'));
      return;
    }

    const accessResult = await requestAccess();
    if (accessResult.error || !accessResult.address) {
      throw new Error(accessResult.error || 'Could not get wallet access.');
    }
    const pubKeyString = accessResult.address;

    try {
      if (!meterId.trim()) {
        setStatus(t('payment.status.enterMeter'));
        announceToScreenReader(t('payment.status.enterMeter'));
        const meterInput = document.getElementById(meterInputId.current);
        meterInput?.focus();
        return;
      }

      const parsedAmount = Number(amount);
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        setStatus(t('payment.status.enterValidAmount'));
        announceToScreenReader(t('payment.status.enterValidAmount'));
        const amountInput = document.getElementById(amountInputId.current);
        amountInput?.focus();
        return;
      }

      const amountU32 = Math.floor(parsedAmount);
      if (amountU32 !== parsedAmount) {
        setStatus(t('payment.status.wholeNumber'));
        announceToScreenReader(t('payment.status.wholeNumber'));
        const amountInput = document.getElementById(amountInputId.current);
        amountInput?.focus();
        return;
      }

      if (amountU32 > 0xffffffff) {
        setStatus(t('payment.status.amountTooLarge'));
        announceToScreenReader(t('payment.status.amountTooLarge'));
        const amountInput = document.getElementById(amountInputId.current);
        amountInput?.focus();
        return;
      }

      // Check if balance is sufficient
      if (!isSufficientBalance(amountU32)) {
        setStatus(t('payment.status.insufficientBalance'));
        announceToScreenReader(t('payment.status.insufficientBalance'));
        return;
      }

      // Ensure it's not null before proceeding
      let currentFeeEstimate = feeEstimate;
      if (!currentFeeEstimate) {
        setStatus(t('payment.status.estimatingFees'));
        announceToScreenReader(t('payment.status.estimatingFees'));
        currentFeeEstimate = await estimateFee(amountU32.toString());
        
        if (!currentFeeEstimate) {
          setStatus(t('payment.status.estimationFailed'));
          return;
        }
      }

      // Create and sign transaction
      const accessResult = await requestAccess();
      if (accessResult.error) {
        throw new Error(accessResult.error);
      }
      const pubKeyString = accessResult.address;

      // Using Horizon for simple payment. 
      const horizonUrl = networkConfig.rpcUrl.replace('soroban', 'horizon');
      const server = new Horizon.Server(horizonUrl);
      
      // FOR TESTS: Bypass loadAccount if mock is provided to avoid environmental string issues
      let account;
      if ((window as any).__MOCK_STELLAR_ACCOUNT__) {
        console.log('[App] Using mock stellar account');
        account = (window as any).__MOCK_STELLAR_ACCOUNT__(pubKeyString);
      } else {
        account = await server.loadAccount(pubKeyString);
      }

      // Build payment transaction
      let transaction;
      if ((window as any).__MOCK_STELLAR_TRANSACTION__) {
        console.log('[App] Using mock stellar transaction');
        transaction = (window as any).__MOCK_STELLAR_TRANSACTION__(account, amountU32);
      } else {
        transaction = new TransactionBuilder(account, {
          fee: BASE_FEE,
          networkPassphrase: networkConfig.networkPassphrase,
        })
          .addOperation(Operation.payment({
            destination: "GDOPTS553GBKXNF3X4YCQ7NPZUQ644QAN4SV7JEZHAVOVROAUQTSKEHO", // Valid mock destination account
            asset: Asset.native(),
            amount: amountU32.toString(),
          }))
          .setTimeout(30)
          .build();
      }
      console.log('[App] Transaction built successfully');

      // Sign the transaction with Freighter
      console.log('[App] Signing transaction...');
      const signedResponse = await signTransaction(transaction.toXDR());
      console.log('[App] Signed response received');
      const signedXdr = typeof signedResponse === 'string' ? signedResponse : (signedResponse as any).signedTxXdr;

      // Submit the transaction
      console.log('[App] Submitting transaction...');
      const result = await server.submitTransaction(signedXdr);
      console.log('Transaction result:', result);

      setStatus(t('payment.status.paymentSuccess', { id: (result as any).hash.slice(0, 10) }));
      announceToScreenReader(t('payment.status.paymentSuccess', { id: (result as any).hash.slice(0, 10) }));
      setMeterId('');
      setAmount('');

      // Refresh balance after successful transaction
      setTimeout(() => {
        refreshBalance();
      }, 2000);

    } catch (err: any) {
      console.error(err);

      // Handle offline errors specifically
      const errorInfo = handleOfflineError(err);
      if (errorInfo.isOffline) {
        setStatus(getOfflineErrorMessage(err, 'payment'));
        announceToScreenReader(getOfflineErrorMessage(err, 'payment'));
      } else {
        const errorMessage = t('payment.status.paymentFailed', { error: err?.message || 'Check console.' });
        setStatus(errorMessage);
        announceToScreenReader(errorMessage);
      }
    }
  };

  const getPaymentButtonState = () => {
    // Basic state check
    return { disabled: false, text: t('payment.form.payButton'), className: 'bg-sky-500 hover:bg-sky-400' };
  };

  const buttonState = getPaymentButtonState();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <SkipLinks />
      <OfflineBanner />

      <main id="main-content" role="main" aria-label="Payment form">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 sm:p-6 lg:p-8 shadow-xl shadow-black/20">
            <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight">{t('app.title')}</h1>
                <p className="mt-2 max-w-prose text-sm text-slate-300">
                  {t('app.tagline')}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <OfflineStatusIndicator variant="compact" />
                <div className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset shrink-0 ${networkConfig.networkPassphrase === Networks.PUBLIC
                  ? 'bg-orange-500/10 text-orange-300 ring-orange-500/20'
                  : 'bg-sky-500/10 text-sky-300 ring-sky-500/20'
                  }`} role="status" aria-live="polite">
                  {networkConfig.networkPassphrase === Networks.PUBLIC ? t('network.mainnet') : t('network.testnet')}
                </div>
              </div>
            </header>

            <WalletBalance className="mt-6" />

            {/* Fee Estimation Display */}
            {feeEstimate && (
              <section className="mt-6 rounded-xl border border-slate-800 bg-slate-950/40 p-4" aria-labelledby="fee-estimation">
                <h2 id="fee-estimation" className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {t('payment.feeEstimation.title')} {isEstimatingFee && t('payment.feeEstimation.calculating')}
                </h2>
                <div className="mt-2 space-y-2">
                  {isEstimatingFee ? (
                    <div className="text-sm text-slate-300">{t('payment.feeEstimation.calculatingFees')}</div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-slate-100">
                        {t('payment.feeEstimation.estimatedNetworkFee')}: {feeEstimate.totalFee} XLM
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}

            <form onSubmit={handlePayment} className="mt-8 space-y-6">
              <div className="space-y-4">
                <div className="relative">
                  <label htmlFor={meterInputId.current} className="block text-sm font-medium text-slate-400 mb-1.5 ml-1">
                    {t('payment.form.meterNumber')}
                  </label>
                  <input
                    id={meterInputId.current}
                    type="text"
                    value={meterId}
                    onChange={(e) => setMeterId(e.target.value)}
                    placeholder={t('payment.form.meterPlaceholder')}
                    className="h-12 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 text-slate-100 placeholder-slate-600 ring-sky-500/20 transition-all focus:border-sky-500/50 focus:outline-none focus:ring-4"
                    aria-required="true"
                    disabled={buttonState.disabled}
                    autoComplete="off"
                  />
                </div>

                <div className="relative">
                  <label htmlFor={amountInputId.current} className="block text-sm font-medium text-slate-400 mb-1.5 ml-1">
                    {t('payment.form.amount')} (XLM)
                  </label>
                  <input
                    id={amountInputId.current}
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="h-12 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 text-slate-100 placeholder-slate-600 ring-sky-500/20 transition-all focus:border-sky-500/50 focus:outline-none focus:ring-4"
                    aria-required="true"
                    disabled={buttonState.disabled}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <button
                  id={payButtonId.current}
                  type="submit"
                  disabled={buttonState.disabled}
                  data-testid="pay-button"
                  className={`relative h-14 w-full overflow-hidden rounded-xl px-6 font-semibold text-white transition-all active:scale-[0.98] disabled:opacity-50 ${buttonState.className}`}
                  aria-busy={buttonState.text === t('payment.form.processing')}
                >
                  <div className="flex items-center justify-center gap-2">
                    {buttonState.text === t('payment.form.processing') && (
                      <svg className="h-5 w-5 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    )}
                    <span>{buttonState.text}</span>
                  </div>
                </button>

                <div 
                  id={statusId.current}
                  role="status" 
                  aria-live="polite"
                  data-testid="payment-status"
                  className={`min-h-[1.5rem] px-1 text-center text-sm font-medium ${status.includes(t('payment.status.paymentSuccess').split('{')[0]) ? 'text-green-400' : 'text-amber-400'}`}
                >
                  {status}
                </div>
              </div>
            </form>
          </div>

          <footer className="mt-12 text-center text-xs text-slate-500">
            <p>© {new Date().getFullYear()} Wata-Board. {t('app.footer.tagline')}</p>
          </footer>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  const [offlineActions, setOfflineActions] = useState<any[]>([]);

  useEffect(() => {
    // Setup accessibility and global handlers
    setupKeyboardNavigation();
    setupFocusVisible();
    
    // Initialize services
    const schedulingService = SchedulingService.getInstance();
    const notificationService = NotificationService.getInstance();
    
    // Start background processes
    const processInterval = setInterval(() => {
      schedulingService.processScheduledPayments();
    }, 60000);

    return () => clearInterval(processInterval);
  }, []);

  return (
    <Router>
      <OfflineErrorBoundary>
        <div className="app-container min-h-screen bg-slate-950">
          <ResponsiveNavigation />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/rate" element={<Rate />} />
            <Route path="/schedules" element={<ScheduledPayments />} />
          </Routes>
        </div>
      </OfflineErrorBoundary>
    </Router>
  );
}