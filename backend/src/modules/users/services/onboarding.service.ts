import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  UserOnboarding,
  OnboardingStepId,
  ONBOARDING_STEPS,
} from '../entities/user-onboarding.entity';
import {
  OnboardingStatusDto,
  OnboardingAnalyticsDto,
  OnboardingStepDetailDto,
} from '../dto/onboarding.dto';

const STEP_TITLES: Record<OnboardingStepId, string> = {
  welcome: 'Welcome',
  profile_setup: 'Profile Setup',
  add_pet: 'Add Your Pet',
  notifications: 'Notifications',
  explore: 'Explore',
};

@Injectable()
export class OnboardingService {
  constructor(
    @InjectRepository(UserOnboarding)
    private readonly repo: Repository<UserOnboarding>,
  ) {}

  private toDto(record: UserOnboarding): OnboardingStatusDto {
    const steps: OnboardingStepDetailDto[] = ONBOARDING_STEPS.map((id) => ({
      id,
      title: STEP_TITLES[id],
      completed: record.completedSteps.includes(id),
      skipped: record.skippedSteps.includes(id),
    }));

    const progressPercent = Math.round(
      (record.completedSteps.length / ONBOARDING_STEPS.length) * 100,
    );

    return {
      userId: record.userId,
      isCompleted: record.isCompleted,
      isSkipped: record.isSkipped,
      currentStep: record.currentStep as OnboardingStepId,
      completedSteps: record.completedSteps,
      skippedSteps: record.skippedSteps,
      progressPercent,
      steps,
      startedAt: record.startedAt,
      completedAt: record.completedAt,
    };
  }

  async getOrCreate(userId: string): Promise<OnboardingStatusDto> {
    let record = await this.repo.findOne({ where: { userId } });
    if (!record) {
      record = this.repo.create({
        userId,
        completedSteps: [],
        skippedSteps: [],
        currentStep: 'welcome',
      });
      record = await this.repo.save(record);
    }
    return this.toDto(record);
  }

  async completeStep(
    userId: string,
    stepId: OnboardingStepId,
  ): Promise<OnboardingStatusDto> {
    if (!ONBOARDING_STEPS.includes(stepId)) {
      throw new BadRequestException(`Invalid step: ${stepId}`);
    }

    let record = await this.repo.findOne({ where: { userId } });
    if (!record) {
      record = this.repo.create({
        userId,
        completedSteps: [],
        skippedSteps: [],
        currentStep: 'welcome',
      });
    }

    if (!record.completedSteps.includes(stepId)) {
      record.completedSteps = [...record.completedSteps, stepId];
    }

    // Advance currentStep to the next uncompleted step
    const nextStep = ONBOARDING_STEPS.find(
      (s) => !record!.completedSteps.includes(s),
    );

    if (!nextStep) {
      record.isCompleted = true;
      record.completedAt = new Date();
      record.currentStep = stepId;
    } else {
      record.currentStep = nextStep;
    }

    record = await this.repo.save(record);
    return this.toDto(record);
  }

  async skip(userId: string): Promise<void> {
    let record = await this.repo.findOne({ where: { userId } });
    if (!record) {
      record = this.repo.create({
        userId,
        completedSteps: [],
        skippedSteps: [],
        currentStep: 'welcome',
      });
    }
    record.isSkipped = true;
    await this.repo.save(record);
  }

  async getAnalytics(): Promise<OnboardingAnalyticsDto> {
    const totalStarted = await this.repo.count();

    if (totalStarted === 0) {
      return {
        totalStarted: 0,
        totalCompleted: 0,
        totalSkipped: 0,
        completionRate: 0,
        averageTimeToCompleteMs: 0,
        stepDropoffRates: {},
        mostSkippedStep: undefined,
      };
    }

    const totalCompleted = await this.repo.count({
      where: { isCompleted: true },
    });
    const totalSkipped = await this.repo.count({
      where: { isSkipped: true },
    });

    // Average completion time (ms)
    const avgResult = await this.repo
      .createQueryBuilder('o')
      .select(
        'AVG(EXTRACT(EPOCH FROM (o.completedAt - o.startedAt)) * 1000)',
        'avgMs',
      )
      .where('o.isCompleted = true AND o.completedAt IS NOT NULL')
      .getRawOne<{ avgMs: string | null }>();

    const averageTimeToCompleteMs = Math.round(
      Number(avgResult?.avgMs) || 0,
    );

    // Step dropoff rates: proportion of users who never completed each step
    const allRecords = await this.repo.find({
      select: ['completedSteps'],
    });

    const stepDropoffRates: Partial<Record<OnboardingStepId, number>> = {};
    for (const step of ONBOARDING_STEPS) {
      const completedCount = allRecords.filter((r) =>
        r.completedSteps.includes(step),
      ).length;
      stepDropoffRates[step] =
        totalStarted > 0
          ? Math.round(((totalStarted - completedCount) / totalStarted) * 100) / 100
          : 0;
    }

    const mostSkippedStep = (
      Object.entries(stepDropoffRates) as [OnboardingStepId, number][]
    ).sort(([, a], [, b]) => b - a)[0]?.[0];

    return {
      totalStarted,
      totalCompleted,
      totalSkipped,
      completionRate:
        totalStarted > 0
          ? Math.round((totalCompleted / totalStarted) * 100) / 100
          : 0,
      averageTimeToCompleteMs,
      stepDropoffRates,
      mostSkippedStep,
    };
  }
}
