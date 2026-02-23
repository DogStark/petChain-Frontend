import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BehaviorLog, BehaviorSeverity } from './entities/behavior-log.entity';
import { CreateBehaviorLogDto } from './dto/create-behavior-log.dto';
import { BehaviorFilterDto } from './dto/behavior-filter.dto';

@Injectable()
export class BehaviorService {
    constructor(
        @InjectRepository(BehaviorLog)
        private behaviorLogRepository: Repository<BehaviorLog>,
    ) { }

    async create(petId: string, createBehaviorLogDto: CreateBehaviorLogDto): Promise<BehaviorLog> {
        const behaviorLog = this.behaviorLogRepository.create({
            ...createBehaviorLogDto,
            petId,
        });
        return await this.behaviorLogRepository.save(behaviorLog);
    }

    async findAll(petId: string, filter: BehaviorFilterDto): Promise<BehaviorLog[]> {
        const { category, severity, startDate, endDate, search } = filter;

        const queryBuilder = this.behaviorLogRepository.createQueryBuilder('log');
        queryBuilder.where('log.petId = :petId', { petId });

        if (category) {
            queryBuilder.andWhere('log.category = :category', { category });
        }

        if (severity) {
            queryBuilder.andWhere('log.severity = :severity', { severity });
        }

        if (startDate && endDate) {
            queryBuilder.andWhere('log.date BETWEEN :startDate AND :endDate', {
                startDate: new Date(startDate),
                endDate: new Date(endDate),
            });
        }

        if (search) {
            queryBuilder.andWhere('log.description ILIKE :search', { search: `%${search}%` });
        }

        queryBuilder.orderBy('log.date', 'DESC');

        return await queryBuilder.getMany();
    }

    async findOne(id: string): Promise<BehaviorLog> {
        const log = await this.behaviorLogRepository.findOne({ where: { id } });
        if (!log) {
            throw new NotFoundException(`Behavior log with ID ${id} not found`);
        }
        return log;
    }

    async update(id: string, updateDto: Partial<CreateBehaviorLogDto>): Promise<BehaviorLog> {
        const log = await this.findOne(id);

        if (updateDto.date) {
            (updateDto as any).date = new Date(updateDto.date);
        }

        Object.assign(log, updateDto);
        return await this.behaviorLogRepository.save(log);
    }

    async remove(id: string): Promise<void> {
        const log = await this.findOne(id);
        await this.behaviorLogRepository.remove(log);
    }

    async getTrends(petId: string) {
        const logs = await this.behaviorLogRepository.find({
            where: { petId },
            order: { date: 'ASC' },
        });

        if (logs.length === 0) {
            return {
                totalLogs: 0,
                categoryFrequency: {},
                mostCommonTrigger: null,
                concerningPatterns: [],
            };
        }

        const frequency = logs.reduce((acc, log) => {
            acc[log.category] = (acc[log.category] || 0) + 1;
            return acc;
        }, {});

        const triggers = logs.map(l => l.triggers).filter(t => !!t);
        const mostCommonTrigger = triggers.length > 0 ? this.findMostCommon(triggers) : null;

        return {
            totalLogs: logs.length,
            categoryFrequency: frequency,
            mostCommonTrigger,
            concerningPatterns: this.detectConcerningPatterns(logs),
        };
    }

    async getAlerts(petId: string) {
        const logs = await this.behaviorLogRepository.find({
            where: { petId },
            order: { date: 'DESC' },
        });

        return this.detectConcerningPatterns(logs);
    }

    async exportReport(petId: string) {
        const logs = await this.behaviorLogRepository.find({
            where: { petId },
            order: { date: 'DESC' },
        });

        // Simplest way to "Export" without version-specific json2csv headaches in this environment
        return logs.map(log => ({
            Date: log.date,
            Category: log.category,
            Severity: log.severity,
            Description: log.description,
            Triggers: log.triggers || 'N/A',
            Location: log.location || 'N/A',
            Duration: log.duration || 'N/A',
            SharedWithVet: log.sharedWithVet ? 'Yes' : 'No',
        }));
    }

    async shareWithVet(id: string, shared: boolean): Promise<BehaviorLog> {
        const log = await this.findOne(id);
        log.sharedWithVet = shared;
        return await this.behaviorLogRepository.save(log);
    }

    private findMostCommon(items: string[]): string {
        const counts = items.reduce((acc, item) => {
            acc[item] = (acc[item] || 0) + 1;
            return acc;
        }, {});
        return Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
    }

    private detectConcerningPatterns(logs: BehaviorLog[]) {
        const alerts: any[] = [];

        // Pattern 1: High/Critical severity in the last 7 days
        const recentHighSeverity = logs.filter(l =>
            (l.severity === BehaviorSeverity.HIGH || l.severity === BehaviorSeverity.CRITICAL) &&
            (new Date().getTime() - new Date(l.date).getTime()) < 7 * 24 * 60 * 60 * 1000
        );

        if (recentHighSeverity.length > 0) {
            alerts.push({
                type: 'HIGH_SEVERITY',
                severity: 'CRITICAL',
                message: `Detected ${recentHighSeverity.length} high/critical behavior incidents recently.`,
                count: recentHighSeverity.length,
            });
        }

        // Pattern 2: Frequency of aggression
        const aggressionLogs = logs.filter(l => l.category === 'Aggression');
        if (aggressionLogs.length >= 3) {
            alerts.push({
                type: 'FREQUENT_AGGRESSION',
                severity: 'HIGH',
                message: 'Multiple aggression incidents recorded. Consult a professional.',
                count: aggressionLogs.length,
            });
        }

        return alerts;
    }
}
