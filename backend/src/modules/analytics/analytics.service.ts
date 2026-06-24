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

      const trend = administered.reduce(
        (acc, vaccination) => {
          const bucket = this.groupDate(
            vaccination.administeredDate,
            this.getGroupBy(query),
          );
          acc[bucket] = (acc[bucket] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );

      const complianceRate =
        vaccinations.length > 0
          ? (groupedByStatus.compliant / vaccinations.length) * 100
          : 100;

      return {
        summary: {
          totalVaccinations: vaccinations.length,
          administeredInRange: administered.length,
          upcomingDue: groupedByStatus.dueSoon,
          overdue: groupedByStatus.overdue,
          complianceRate: Math.round(complianceRate * 100) / 100,
        },
        breakdown: {
          byStatus: groupedByStatus,
          byVaccine: Object.entries(groupedByVaccine).map(
            ([vaccineName, count]) => ({
              vaccineName,
              count,
            }),
          ),
        },
        visualization: {
          trend: this.toChartSeries(trend, 'administered', 'Vaccinations'),
          complianceDistribution: Object.entries(groupedByStatus).map(
            ([status, count]) => ({
              status,
              count,
            }),
          ),
        },
        startDate,
        endDate,
      };
    });
  }

  async getAppointmentStatistics(query: AnalyticsQueryDto) {
    return this.getCachedResult('appointments', query, async () => {
      const { startDate, endDate } = this.getDateRange(query);

      const appointments = await this.appointmentRepository.find({
        where: { createdAt: Between(startDate, endDate) },
      });

      const statusCounts = appointments.reduce(
        (acc, apt) => {
          acc[apt.status] = (acc[apt.status] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );

      return {
        summary: {
          total: appointments.length,
          completed: statusCounts.completed || 0,
          scheduled: statusCounts.scheduled || 0,
          cancelled: statusCounts.cancelled || 0,
        },
        breakdown: {
          byStatus: statusCounts,
        },
        visualization: {
          statusDistribution: Object.entries(statusCounts).map(
            ([status, count]) => ({
              status,
              count,
            }),
          ),
        },
        startDate,
        endDate,
      };
    });
  }

  async getSystemUsageAnalytics(query: AnalyticsQueryDto) {
    return this.getCachedResult('system-usage', query, async () => {
      const { startDate, endDate } = this.getDateRange(query);
      const logs = await this.userActivityLogRepository.find({
        where: { createdAt: Between(startDate, endDate) },
      });
      const activeUsers = new Set(logs.map((log) => log.userId)).size;
      const activityCounts = logs.reduce(
        (acc, log) => {
          acc[log.activityType] = (acc[log.activityType] || 0) + 1;
          return acc;
        },
        {} as Record<ActivityType, number>,
      );
      const trend = logs.reduce(
        (acc, log) => {
          const bucket = this.groupDate(log.createdAt, this.getGroupBy(query));
          acc[bucket] = (acc[bucket] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );
      const suspiciousActivityCount = logs.filter(
        (log) => log.isSuspicious,
      ).length;
      const exportRequests = activityCounts[ActivityType.DATA_EXPORT] || 0;
      const appointmentVolume = await this.appointmentRepository.count({
        where: { createdAt: Between(startDate, endDate) },
      });

      return {
        summary: {
          totalEvents: logs.length,
          activeUsers,
          suspiciousActivityCount,
          exportRequests,
          appointmentVolume,
        },
        breakdown: {
          byActivityType: Object.entries(activityCounts).map(
            ([activityType, count]) => ({
              activityType,
              count,
            }),
          ),
        },
        visualization: {
          trend: this.toChartSeries(trend, 'events', 'System usage'),
          activityDistribution: Object.entries(activityCounts).map(
            ([activityType, count]) => ({
              activityType,
              count,
            }),
          ),
        },
        startDate,
        endDate,
      };
    });
  }

  async getGeographicDistribution(query: AnalyticsQueryDto) {
    return this.getCachedResult('geographic-distribution', query, async () => {
      const users = await this.userRepository.find();
      const distribution = users.reduce(
        (acc, user) => {
          const location = user.country || user.city || 'Unknown';
          acc[location] = (acc[location] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );

      return {
        summary: {
          totalLocations: Object.keys(distribution).length,
          usersWithLocation: users.filter((user) => user.country || user.city)
            .length,
        },
        visualization: {
          distribution: Object.entries(distribution).map(
            ([location, count]) => ({
              location,
              count,
            }),
          ),
        },
      };
    });
  }

  async generateCustomReport(query: AnalyticsQueryDto) {
    return this.getCachedResult('custom-report', query, async () => {
      const metrics = this.parseMetrics(query);
      const sections: Record<string, unknown> = {};

      for (const metric of metrics) {
        if (metric === AnalyticsMetric.PET_HEALTH) {
          sections.petHealth = await this.getPetHealthTrends(query);
        }
        if (metric === AnalyticsMetric.VACCINATION_COMPLIANCE) {
          sections.vaccinationCompliance =
            await this.getVaccinationCompliance(query);
        }
        if (metric === AnalyticsMetric.SYSTEM_USAGE) {
          sections.systemUsage = await this.getSystemUsageAnalytics(query);
        }
        if (metric === AnalyticsMetric.USER_OVERVIEW) {
          sections.users = await this.getUserMetrics(query);
        }
        if (metric === AnalyticsMetric.PET_REGISTRATIONS) {
          sections.petRegistrations =
            await this.getPetRegistrationTrends(query);
        }
        if (metric === AnalyticsMetric.APPOINTMENT_OVERVIEW) {
          sections.appointments = await this.getAppointmentStatistics(query);
        }
      }

      const { startDate, endDate } = this.getDateRange(query);

      return {
        reportName: query.reportName || 'analytics-report',
        generatedAt: new Date().toISOString(),
        metrics,
        dateRange: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
        sections,
        visualization: {
          cards: Object.entries(sections).flatMap(([section, payload]) => {
            const summary = (payload as Record<string, any>).summary || {};
            return Object.entries(summary)
              .filter(([, value]) => typeof value !== 'object')
              .slice(0, 2)
              .map(([label, value]) => ({
                section,
                label,
                value,
              }));
          }),
        },
      };
    });
  }

  async exportReport(query: AnalyticsQueryDto) {
    const report = await this.generateCustomReport(query);
    const baseFilename = `${query.reportName || 'analytics-report'}-${Date.now()}`;

    if ((query.format || ExportFormat.JSON) === ExportFormat.CSV) {
      const parser = new Parser<SummaryRow>({
        fields: ['section', 'metric', 'value'],
      });

      return {
        filename: `${baseFilename}.csv`,
        contentType: 'text/csv',
        body: parser.parse(this.flattenReportRows(report)),
      };
    }

    return {
      filename: `${baseFilename}.json`,
      contentType: 'application/json',
      body: report,
    };
  }

  async getDashboardOverview(query: AnalyticsQueryDto) {
    const [
      userMetrics,
      petTrends,
      petHealth,
      vaccinationCompliance,
      appointmentStats,
      systemUsage,
      geoDistribution,
    ] = await Promise.all([
      this.getUserMetrics(query),
      this.getPetRegistrationTrends(query),
      this.getPetHealthTrends(query),
      this.getVaccinationCompliance(query),
      this.getAppointmentStatistics(query),
      this.getSystemUsageAnalytics(query),
      this.getGeographicDistribution(query),
    ]);

    return {
      users: userMetrics,
      pets: petTrends,
      petHealth,
      vaccinations: vaccinationCompliance,
      appointments: appointmentStats,
      systemUsage,
      geographic: geoDistribution,
    };
  }
}
