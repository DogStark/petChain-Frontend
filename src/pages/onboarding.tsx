import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { OnboardingFlow } from '../components/Onboarding/OnboardingFlow';
import {
  userAPI,
  OnboardingStatus,
  OnboardingAnalytics,
  OnboardingStepId,
} from '../lib/api/userAPI';
import styles from '../styles/pages/OnboardingPage.module.css';

const DEFAULT_STATUS: OnboardingStatus = {
  userId: '',
  isCompleted: false,
  isSkipped: false,
  currentStep: 'welcome',
  completedSteps: [],
  skippedSteps: [],
  progressPercent: 0,
  steps: [],
  startedAt: new Date().toISOString(),
};

const is404 = (err: any) => err?.response?.status === 404;

export default function OnboardingPage() {
  const router = useRouter();
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [analytics, setAnalytics] = useState<OnboardingAnalytics | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [onboardingStatus, onboardingAnalytics] = await Promise.allSettled([
          userAPI.getOnboardingStatus(),
          userAPI.getOnboardingAnalytics(),
        ]);

        if (onboardingStatus.status === 'fulfilled') {
          const s = onboardingStatus.value;
          if (s.isCompleted || s.isSkipped) {
            router.replace('/');
            return;
          }
          setStatus(s);
        } else if (is404(onboardingStatus.reason)) {
          // Backend not yet implemented — use local default
          setStatus(DEFAULT_STATUS);
        } else {
          throw onboardingStatus.reason;
        }

        if (onboardingAnalytics.status === 'fulfilled') {
          setAnalytics(onboardingAnalytics.value);
        }
        // 404 on analytics is fine — panel simply won't render
      } catch (err: any) {
        if (err?.response?.status === 401) {
          router.replace('/login');
          return;
        }
        setError(err?.message || 'Failed to load onboarding.');
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [router]);

  const handleCompleteStep = async (stepId: OnboardingStepId): Promise<OnboardingStatus> => {
    try {
      const updated = await userAPI.completeOnboardingStep(stepId);
      setStatus(updated);
      return updated;
    } catch (err: any) {
      if (is404(err)) {
        // Backend not yet implemented — update state locally
        const updated: OnboardingStatus = {
          ...(status ?? DEFAULT_STATUS),
          completedSteps: [...(status?.completedSteps ?? []), stepId],
          progressPercent: Math.round(
            (((status?.completedSteps.length ?? 0) + 1) / 5) * 100,
          ),
        };
        setStatus(updated);
        return updated;
      }
      throw err;
    }
  };

  const handleSkip = async () => {
    try {
      await userAPI.skipOnboarding();
    } catch (err: any) {
      if (!is404(err)) throw err;
      // 404 — backend not ready, skip locally
    }
    router.replace('/');
  };

  const handleFinish = () => {
    router.replace('/');
  };

  if (isLoading) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}>Loading onboarding…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.page}>
        <div className={styles.errorBox}>
          <p>{error}</p>
          <button className={styles.retryBtn} onClick={() => router.reload()}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.brand}>
        <span className={styles.brandName}>PetChain</span>
      </div>

      {status && (
        <OnboardingFlow
          status={status}
          analytics={analytics}
          onCompleteStep={handleCompleteStep}
          onSkip={handleSkip}
          onFinish={handleFinish}
        />
      )}
    </div>
  );
}
