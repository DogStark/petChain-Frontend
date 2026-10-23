import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import type { Cache } from 'cache-manager';
import { Parser } from 'json2csv';
import { User } from '../users/entities/user.entity';
import { Pet } from '../pets/entities/pet.entity';
import { Vaccination } from '../vaccinations/entities/vaccination.entity';
import { Appointment } from '../appointments/entities/appointment.entity';
import {
  AnalyticsGroupBy,
  AnalyticsMetric,
  AnalyticsQueryDto,
  ExportFormat,
} from './dto/analytics-query.dto';
import {
  MedicalRecord,
  RecordType,
} from '../medical-records/entities/medical-record.entity';
import {
  ActivityType,
  UserActivityLog,
} from '../users/entities/user-activity-log.entity';

type SummaryRow = {
  section: string;
  metric: string;
  value: string | number;
};

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Pet)
    private readonly petRepository: Repository<Pet>,
    @InjectRepository(Vaccination)
    private readonly vaccinationRepository: Repository<Vaccination>,
    @InjectRepository(Appointment)
    private readonly appointmentRepository: Repository<Appointment>,
    @InjectRepository(MedicalRecord)
    private readonly medicalRecordRepository: Repository<MedicalRecord>,
    @InjectRepository(UserActivityLog)
    private readonly userActivityLogRepository: Repository<UserActivityLog>,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  private getDateRange(query: AnalyticsQueryDto) {
    const endDate = query.endDate ? new Date(query.endDate) : new Date();
    const startDate = query.startDate
      ? new Date(query.startDate)
      : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    return { startDate, endDate };
  }

  private getGroupBy(query: AnalyticsQueryDto): AnalyticsGroupBy {
    return query.groupBy || AnalyticsGroupBy.DAY;
  }

  private shouldBypassCache(query: AnalyticsQueryDto): boolean {
    return query.fresh === 'true';
  }

  private buildCacheKey(scope: string, query: AnalyticsQueryDto): string {
    const normalized = {
      endDate: query.endDate || null,
      fresh: query.fresh || null,
      groupBy: query.groupBy || AnalyticsGroupBy.DAY,
      metrics: query.metrics || null,
      petId: query.petId || null,
      reportName: query.reportName || null,
      startDate: query.startDate || null,
    };

    return `analytics:${scope}:${JSON.stringify(normalized)}`;
  }

  private async getCachedResult<T>(
    scope: string,
    query: AnalyticsQueryDto,
    producer: () => Promise<T>,
  ): Promise<T> {
    if (!this.shouldBypassCache(query)) {
      const cached = await this.cacheManager.get<T>(
        this.buildCacheKey(scope, query),
      );
      if (cached) {
        return cached;
      }
    }

    const result = await producer();
    await this.cacheManager.set(
      this.buildCacheKey(scope, query),
      result,
      5 * 60 * 1000,
    );
    return result;
  }

  private groupDate(
    date: Date | null | undefined,
    groupBy: AnalyticsGroupBy,
  ): string {
    if (!date) {
      return 'unknown';
    }

    const normalized = new Date(date);
    const year = normalized.getUTCFullYear();
    const month = `${normalized.getUTCMonth() + 1}`.padStart(2, '0');
    const day = `${normalized.getUTCDate()}`.padStart(2, '0');

    if (groupBy === AnalyticsGroupBy.MONTH) {
      return `${year}-${month}`;
    }

    if (groupBy === AnalyticsGroupBy.WEEK) {
      const start = new Date(
        Date.UTC(year, normalized.getUTCMonth(), normalized.getUTCDate()),
      );
      const dayOfWeek = start.getUTCDay();
      const offset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      start.setUTCDate(start.getUTCDate() + offset);
      return start.toISOString().slice(0, 10);
    }

    return `${year}-${month}-${day}`;
  }

  private parseMetrics(query: AnalyticsQueryDto): AnalyticsMetric[] {
    const requested =
      query.metrics
        ?.split(',')
        .map((metric) => metric.trim())
        .filter(Boolean) || [];

    const allowed = new Set(Object.values(AnalyticsMetric));
    const metrics = requested.filter((metric): metric is AnalyticsMetric =>
      allowed.has(metric as AnalyticsMetric),
    );

    return metrics.length > 0
      ? metrics
      : [
          AnalyticsMetric.PET_HEALTH,
          AnalyticsMetric.VACCINATION_COMPLIANCE,
          AnalyticsMetric.SYSTEM_USAGE,
        ];
  }

  private toChartSeries(
    grouped: Record<string, number>,
    dataKey: string,
    label: string,
  ) {
    return Object.entries(grouped)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([bucket, value]) => ({
        bucket,
        [dataKey]: value,
        label,
      }));
  }

  private flattenReportRows(report: {
    sections: Record<string, any>;
  }): SummaryRow[] {
    const rows: SummaryRow[] = [];

    Object.entries(report.sections).forEach(([section, payload]) => {
      if (payload.summary && typeof payload.summary === 'object') {
        Object.entries(payload.summary).forEach(([metric, value]) => {
          if (typeof value !== 'object') {
            rows.push({ section, metric, value: value as string | number });
          }
        });
      }

      if (Array.isArray(payload.visualization?.trend)) {
        payload.visualization.trend.forEach((point: Record<string, any>) => {
          Object.entries(point).forEach(([metric, value]) => {
            if (metric !== 'bucket') {
              rows.push({
                section,
                metric: `${metric}:${point.bucket}`,
                value: typeof value === 'number' ? value : String(value),
              });
            }
          });
        });
      }
    });

    return rows;
  }

  async getUserMetrics(query: AnalyticsQueryDto) {
    return this.getCachedResult('users', query, async () => {
      const { startDate, endDate } = this.getDateRange(query);

      const [totalUsers, activeUsers, newUsers, verifiedUsers] =
        await Promise.all([
          this.userRepository.count(),
          this.userRepository.count({ where: { isActive: true } }),
          this.userRepository.count({
            where: { createdAt: Between(startDate, endDate) },
          }),
          this.userRepository.count({ where: { emailVerified: true } }),
        ]);

      return {
        summary: {
          totalUsers,
          activeUsers,
          newUsers,
          verifiedUsers,
        },
        visualization: {
          cards: [
            { label: 'Total users', value: totalUsers },
            { label: 'Active users', value: activeUsers },
            { label: 'New users', value: newUsers },
            { label: 'Verified users', value: verifiedUsers },
          ],
        },
        startDate,
        endDate,
      };
    });
  }

  async getPetRegistrationTrends(query: AnalyticsQueryDto) {
    return this.getCachedResult('pet-registrations', query, async () => {
      const { startDate, endDate } = this.getDateRange(query);
      const pets = await this.petRepository.find({
        where: { createdAt: Between(startDate, endDate) },
      });
      const totalPets = await this.petRepository.count();
      const grouped = pets.reduce(
        (acc, pet) => {
          const bucket = this.groupDate(pet.createdAt, this.getGroupBy(query));
          acc[bucket] = (acc[bucket] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );

      const bySpecies = pets.reduce(
        (acc, pet) => {
          acc[pet.species] = (acc[pet.species] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );

      return {
        summary: {
          totalPets,
          newPets: pets.length,
          activePets: pets.filter((pet) => pet.isActive).length,
        },
        visualization: {
          trend: this.toChartSeries(
            grouped,
            'registrations',
            'Pet registrations',
          ),
          speciesDistribution: Object.entries(bySpecies).map(
            ([species, count]) => ({
              species,
              count,
            }),
          ),
        },
        startDate,
        endDate,
      };
    });
  }

  async getPetHealthTrends(query: AnalyticsQueryDto) {
    return this.getCachedResult('pet-health', query, async () => {
      const { startDate, endDate } = this.getDateRange(query);
      const where: Record<string, any> = {
        visitDate: Between(startDate, endDate),
      };

      if (query.petId) {
        where.petId = query.petId;
      }

      const records = await this.medicalRecordRepository.find({ where });
      const totalPets = new Set(records.map((record) => record.petId)).size;
      const verifiedRecords = records.filter(
        (record) => record.verified,
      ).length;

      const trend = records.reduce(
        (acc, record) => {
          const bucket = this.groupDate(
            record.visitDate,
            this.getGroupBy(query),
          );
          acc[bucket] = (acc[bucket] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );

      const byType = records.reduce(
        (acc, record) => {
          acc[record.recordType] = (acc[record.recordType] || 0) + 1;
          return acc;
        },
        {} as Record<RecordType, number>,
      );

      const diagnoses = records.reduce(
        (acc, record) => {
          const diagnosis = record.diagnosis?.trim() || 'Unspecified';
          acc[diagnosis] = (acc[diagnosis] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );

      return {
        summary: {
          totalRecords: records.length,
          totalPets,
          verifiedRecords,
          criticalEvents:
            (byType[RecordType.EMERGENCY] || 0) +
            (byType[RecordType.SURGERY] || 0),
        },
        breakdown: {
          byRecordType: byType,
          topDiagnoses: Object.entries(diagnoses)
            .sort(([, left], [, right]) => right - left)
            .slice(0, 5)
            .map(([diagnosis, count]) => ({ diagnosis, count })),
        },
        visualization: {
          trend: this.toChartSeries(trend, 'records', 'Health records'),
          recordTypeDistribution: Object.entries(byType).map(
            ([recordType, count]) => ({
              recordType,
              count,
            }),
          ),
        },
        startDate,
        endDate,
      };
    });
  }

  async getVaccinationCompliance(query: AnalyticsQueryDto) {
    return this.getCachedResult('vaccination-compliance', query, async () => {
      const { startDate, endDate } = this.getDateRange(query);
      const vaccinations = await this.vaccinationRepository.find(
        query.petId ? { where: { petId: query.petId } } : undefined,
      );
      const now = new Date();
      const dueSoonCutoff = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const administered = vaccinations.filter((vaccination) => {
        return (
          vaccination.administeredDate >= startDate &&
          vaccination.administeredDate <= endDate
        );
      });

      const groupedByStatus = vaccinations.reduce(
        (acc, vaccination) => {
          if (
            !vaccination.nextDueDate ||
            vaccination.nextDueDate >= dueSoonCutoff
          ) {
            acc.compliant += 1;
          } else if (vaccination.nextDueDate < now) {
            acc.overdue += 1;
          } else {
            acc.dueSoon += 1;
          }
          return acc;
        },
        { compliant: 0, dueSoon: 0, overdue: 0 },
      );

      const groupedByVaccine = vaccinations.reduce(
        (acc, vaccination) => {
          const name = vaccination.vaccineName || 'Unknown';
          acc[name] = (acc[name] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );

      return {
        summary: {
          totalVaccinations: vaccinations.length,
          administeredInRange: administered.length,
          ...groupedByStatus,
        },
        breakdown: {
          byVaccine: groupedByVaccine,
        },
        startDate,
        endDate,
      };
    });
  }
}
