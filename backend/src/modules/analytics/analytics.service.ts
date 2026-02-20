import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Pet } from '../pets/entities/pet.entity';
import { Vaccination } from '../vaccinations/entities/vaccination.entity';
import { Appointment } from '../appointments/entities/appointment.entity';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Pet)
    private petRepository: Repository<Pet>,
    @InjectRepository(Vaccination)
    private vaccinationRepository: Repository<Vaccination>,
    @InjectRepository(Appointment)
    private appointmentRepository: Repository<Appointment>,
  ) {}

  private getDateRange(query: AnalyticsQueryDto) {
    const endDate = query.endDate ? new Date(query.endDate) : new Date();
    const startDate = query.startDate
      ? new Date(query.startDate)
      : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    return { startDate, endDate };
  }

  async getUserMetrics(query: AnalyticsQueryDto) {
    const { startDate, endDate } = this.getDateRange(query);

    const [totalUsers, activeUsers, newUsers] = await Promise.all([
      this.userRepository.count(),
      this.userRepository.count({ where: { isActive: true } }),
      this.userRepository.count({
        where: { createdAt: Between(startDate, endDate) },
      }),
    ]);

    return { totalUsers, activeUsers, newUsers, startDate, endDate };
  }

  async getPetRegistrationTrends(query: AnalyticsQueryDto) {
    const { startDate, endDate } = this.getDateRange(query);

    const pets = await this.petRepository
      .createQueryBuilder('pet')
      .select('DATE(pet.createdAt)', 'date')
      .addSelect('COUNT(*)', 'count')
      .where('pet.createdAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .groupBy('DATE(pet.createdAt)')
      .orderBy('date', 'ASC')
      .getRawMany();

    const totalPets = await this.petRepository.count();
    const newPets = await this.petRepository.count({
      where: { createdAt: Between(startDate, endDate) },
    });

    return { trends: pets, totalPets, newPets, startDate, endDate };
  }

  async getVaccinationCompliance(query: AnalyticsQueryDto) {
    const { startDate, endDate } = this.getDateRange(query);

    const totalVaccinations = await this.vaccinationRepository.count();
    const upcomingDue = await this.vaccinationRepository
      .createQueryBuilder('vaccination')
      .where('vaccination.nextDueDate BETWEEN :now AND :futureDate', {
        now: new Date(),
        futureDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      })
      .getCount();

    const overdue = await this.vaccinationRepository
      .createQueryBuilder('vaccination')
      .where('vaccination.nextDueDate < :now', { now: new Date() })
      .getCount();

    const administered = await this.vaccinationRepository.count({
      where: { administeredDate: Between(startDate, endDate) },
    });

    const complianceRate =
      totalVaccinations > 0
        ? ((totalVaccinations - overdue) / totalVaccinations) * 100
        : 100;

    return {
      totalVaccinations,
      upcomingDue,
      overdue,
      administered,
      complianceRate: Math.round(complianceRate * 100) / 100,
      startDate,
      endDate,
    };
  }

  async getAppointmentStatistics(query: AnalyticsQueryDto) {
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
      total: appointments.length,
      byStatus: statusCounts,
      startDate,
      endDate,
    };
  }

  async getGeographicDistribution(query: AnalyticsQueryDto) {
    const users = await this.userRepository
      .createQueryBuilder('user')
      .select('COUNT(*)', 'count')
      .groupBy('user.id')
      .getRawMany();

    return {
      totalLocations: users.length,
      distribution: users,
      note: 'Geographic data requires location field in user entity',
    };
  }

  async getDashboardOverview(query: AnalyticsQueryDto) {
    const [
      userMetrics,
      petTrends,
      vaccinationCompliance,
      appointmentStats,
      geoDistribution,
    ] = await Promise.all([
      this.getUserMetrics(query),
      this.getPetRegistrationTrends(query),
      this.getVaccinationCompliance(query),
      this.getAppointmentStatistics(query),
      this.getGeographicDistribution(query),
    ]);

    return {
      users: userMetrics,
      pets: petTrends,
      vaccinations: vaccinationCompliance,
      appointments: appointmentStats,
      geographic: geoDistribution,
    };
  }
}
