import React, { useState } from 'react';
import {
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  X,
  Sparkles,
  User,
  PawPrint,
  Bell,
  Compass,
  BarChart2,
  Search,
  Shield,
} from 'lucide-react';
import { OnboardingStatus, OnboardingStepId, OnboardingAnalytics } from '../../lib/api/userAPI';
import styles from './OnboardingFlow.module.css';

interface OnboardingFlowProps {
  status: OnboardingStatus;
  analytics?: OnboardingAnalytics;
  onCompleteStep: (stepId: OnboardingStepId) => Promise<OnboardingStatus>;
  onSkip: () => Promise<void>;
  onFinish: () => void;
}

const STEPS: { id: OnboardingStepId; label: string }[] = [
  { id: 'welcome', label: 'Welcome' },
  { id: 'profile_setup', label: 'Profile' },
  { id: 'add_pet', label: 'Your Pet' },
  { id: 'notifications', label: 'Alerts' },
  { id: 'explore', label: 'Explore' },
];

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({
  status,
  analytics,
  onCompleteStep,
  onSkip,
  onFinish,
}) => {
  const initialIndex = Math.max(
    0,
    STEPS.findIndex((s) => s.id === status.currentStep),
  );
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [completedSteps, setCompletedSteps] = useState<OnboardingStepId[]>(
    status.completedSteps,
  );
  const [completing, setCompleting] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);

  const currentStep = STEPS[currentIndex];
  const isLastStep = currentIndex === STEPS.length - 1;
  const progressPercent = Math.round((completedSteps.length / STEPS.length) * 100);

  const handleNext = async () => {
    setError(null);
    setCompleting(true);
    try {
      const updated = await onCompleteStep(currentStep.id);
      setCompletedSteps(updated.completedSteps);
      if (isLastStep) {
        setFinished(true);
      } else {
        setCurrentIndex((i) => i + 1);
      }
    } catch {
      setError('Failed to save progress. Please try again.');
    } finally {
      setCompleting(false);
    }
  };

  const handleBack = () => {
    if (currentIndex > 0) setCurrentIndex((i) => i - 1);
  };

  const handleSkip = async () => {
    setSkipping(true);
    setError(null);
    try {
      await onSkip();
    } catch {
      setError('Failed to skip. Please try again.');
      setSkipping(false);
    }
  };

  if (finished) {
    return (
      <div className={styles.container}>
        <div className={styles.completionScreen}>
          <div className={styles.completionIcon}>
            <CheckCircle size={56} color="#10b981" />
          </div>
          <h2 className={styles.completionTitle}>You&apos;re all set!</h2>
          <p className={styles.completionSubtitle}>
            Welcome to PetChain. Your pet&apos;s health records are now secured on the blockchain.
          </p>

          {analytics && (
            <div className={styles.analyticsPanel}>
              <h3 className={styles.analyticsPanelTitle}>
                <BarChart2 size={16} /> Onboarding Insights
              </h3>
              <div className={styles.analyticsGrid}>
                <div className={styles.analyticsStat}>
                  <span className={styles.analyticsValue}>{analytics.totalCompleted}</span>
                  <span className={styles.analyticsLabel}>Completed</span>
                </div>
                <div className={styles.analyticsStat}>
                  <span className={styles.analyticsValue}>
                    {Math.round(analytics.completionRate * 100)}%
                  </span>
                  <span className={styles.analyticsLabel}>Completion rate</span>
                </div>
                <div className={styles.analyticsStat}>
                  <span className={styles.analyticsValue}>
                    {Math.round(analytics.averageTimeToCompleteMs / 60000)}m
                  </span>
                  <span className={styles.analyticsLabel}>Avg. time</span>
                </div>
                <div className={styles.analyticsStat}>
                  <span className={styles.analyticsValue}>{analytics.totalSkipped}</span>
                  <span className={styles.analyticsLabel}>Skipped setup</span>
                </div>
              </div>
            </div>
          )}

          <button className={styles.finishBtn} onClick={onFinish}>
            Go to Dashboard <ArrowRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <button
        className={styles.skipBtn}
        onClick={handleSkip}
        disabled={skipping || completing}
        aria-label="Skip onboarding setup"
      >
        <X size={14} />
        {skipping ? 'Skipping…' : 'Skip setup'}
      </button>

      {/* Step indicators */}
      <div className={styles.progressSection}>
        <div className={styles.stepIndicators}>
          {STEPS.map((step, idx) => {
            const isDone = completedSteps.includes(step.id);
            const isActive = idx === currentIndex;
            return (
              <React.Fragment key={step.id}>
                <div
                  className={[
                    styles.stepDot,
                    isActive ? styles.stepDotActive : '',
                    isDone ? styles.stepDotDone : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  aria-label={`Step ${idx + 1}: ${step.label}`}
                >
                  {isDone ? <CheckCircle size={14} /> : idx + 1}
                </div>
                {idx < STEPS.length - 1 && (
                  <div
                    className={[
                      styles.stepConnector,
                      idx < currentIndex ? styles.stepConnectorDone : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
        <div className={styles.progressBar} role="progressbar" aria-valuenow={progressPercent}>
          <div className={styles.progressFill} style={{ width: `${progressPercent}%` }} />
        </div>
        <p className={styles.progressText}>
          Step {currentIndex + 1} of {STEPS.length} &mdash;{' '}
          <strong>{STEPS[currentIndex].label}</strong>
        </p>
      </div>

      {/* Step content */}
      <div className={styles.stepContent}>
        {currentStep.id === 'welcome' && <WelcomeStep />}
        {currentStep.id === 'profile_setup' && <ProfileSetupStep />}
        {currentStep.id === 'add_pet' && <AddPetStep />}
        {currentStep.id === 'notifications' && <NotificationsStep />}
        {currentStep.id === 'explore' && <ExploreStep />}
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {/* Navigation */}
      <div className={styles.navigation}>
        <button
          className={styles.backBtn}
          onClick={handleBack}
          disabled={currentIndex === 0 || completing}
          aria-label="Go to previous step"
        >
          <ArrowLeft size={16} /> Back
        </button>
        <button
          className={styles.nextBtn}
          onClick={handleNext}
          disabled={completing}
          aria-label={isLastStep ? 'Finish onboarding' : 'Continue to next step'}
        >
          {completing ? 'Saving…' : isLastStep ? 'Finish' : 'Continue'}
          {!completing && <ArrowRight size={16} />}
        </button>
      </div>
    </div>
  );
};

/* ── Step content components ─────────────────────────────── */

function WelcomeStep() {
  return (
    <div className={styles.stepBody}>
      <div className={styles.stepIconWrap} style={{ background: '#eff6ff' }}>
        <Sparkles size={32} color="#2563eb" />
      </div>
      <h2 className={styles.stepTitle}>Welcome to PetChain</h2>
      <p className={styles.stepDescription}>
        Secure your pet&apos;s medical records on the blockchain. Let&apos;s get you set up in
        just a few steps.
      </p>
      <div className={styles.featureList}>
        <FeatureItem icon={<Shield size={18} color="#2563eb" />} text="Tamper-proof health records" />
        <FeatureItem icon={<Search size={18} color="#2563eb" />} text="Find vets &amp; emergency services" />
        <FeatureItem icon={<BarChart2 size={18} color="#2563eb" />} text="Track vaccination compliance" />
      </div>
    </div>
  );
}

function ProfileSetupStep() {
  return (
    <div className={styles.stepBody}>
      <div className={styles.stepIconWrap} style={{ background: '#f0fdf4' }}>
        <User size={32} color="#16a34a" />
      </div>
      <h2 className={styles.stepTitle}>Complete Your Profile</h2>
      <p className={styles.stepDescription}>
        Add your name, phone number, and a profile photo so vets can identify you quickly.
      </p>
      <a href="/profile" className={styles.ctaLink}>
        Go to Profile <ArrowRight size={14} />
      </a>
    </div>
  );
}

function AddPetStep() {
  return (
    <div className={styles.stepBody}>
      <div className={styles.stepIconWrap} style={{ background: '#fdf4ff' }}>
        <PawPrint size={32} color="#9333ea" />
      </div>
      <h2 className={styles.stepTitle}>Register Your First Pet</h2>
      <p className={styles.stepDescription}>
        Add your pet&apos;s name, species, breed, and date of birth. Each pet gets a unique
        blockchain-backed QR tag.
      </p>
      <div className={styles.infoNote}>
        You can add and manage multiple pets any time from your dashboard.
      </div>
    </div>
  );
}

function NotificationsStep() {
  return (
    <div className={styles.stepBody}>
      <div className={styles.stepIconWrap} style={{ background: '#fffbeb' }}>
        <Bell size={32} color="#d97706" />
      </div>
      <h2 className={styles.stepTitle}>Stay Informed</h2>
      <p className={styles.stepDescription}>
        Get reminders for vaccinations, vet appointments, and health alerts via email, SMS, or
        push notifications.
      </p>
      <a href="/preferences" className={styles.ctaLink}>
        Set Preferences <ArrowRight size={14} />
      </a>
    </div>
  );
}

function ExploreStep() {
  return (
    <div className={styles.stepBody}>
      <div className={styles.stepIconWrap} style={{ background: '#fff1f2' }}>
        <Compass size={32} color="#e11d48" />
      </div>
      <h2 className={styles.stepTitle}>Explore PetChain</h2>
      <p className={styles.stepDescription}>
        You&apos;re ready! Here&apos;s what you can do next.
      </p>
      <div className={styles.featureList}>
        <FeatureItem icon={<Search size={18} color="#2563eb" />} text="Search pets, vets &amp; records" link="/search" />
        <FeatureItem icon={<BarChart2 size={18} color="#2563eb" />} text="View health analytics" link="/analytics" />
        <FeatureItem icon={<User size={18} color="#2563eb" />} text="Manage your account" link="/account-settings" />
      </div>
    </div>
  );
}

function FeatureItem({
  icon,
  text,
  link,
}: {
  icon: React.ReactNode;
  text: string;
  link?: string;
}) {
  const content = (
    <div className={styles.featureItem}>
      <span className={styles.featureIcon}>{icon}</span>
      <span className={styles.featureText} dangerouslySetInnerHTML={{ __html: text }} />
      {link && <ArrowRight size={12} className={styles.featureArrow} />}
    </div>
  );
  return link ? <a href={link} className={styles.featureLink}>{content}</a> : content;
}
