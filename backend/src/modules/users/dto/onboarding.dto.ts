import { OnboardingStepId } from '../entities/user-onboarding.entity';

export class OnboardingStatusDto {
  userId: string;
  isCompleted: boolean;
  isSkipped: boolean;
  currentStep: OnboardingStepId;
  completedSteps: OnboardingStepId[];
  skippedSteps: OnboardingStepId[];
  progressPercent: number;
  steps: OnboardingStepDetailDto[];
  startedAt: Date;
  completedAt: Date | null;
}

export class OnboardingStepDetailDto {
  id: OnboardingStepId;
  title: string;
  completed: boolean;
  skipped: boolean;
  completedAt?: Date;
}

export class OnboardingAnalyticsDto {
  totalStarted: number;
  totalCompleted: number;
  totalSkipped: number;
  completionRate: number;
  averageTimeToCompleteMs: number;
  stepDropoffRates: Partial<Record<OnboardingStepId, number>>;
  mostSkippedStep?: OnboardingStepId;
}
