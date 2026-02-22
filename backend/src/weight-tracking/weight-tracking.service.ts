import {
    Injectable,
    NotFoundException,
    BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { WeightEntry, WeightUnit } from './entities/weight-entry.entity';
import { CreateWeightEntryDto } from './dto/create-weight-entry.dto';

export type TrendDirection = 'gaining' | 'losing' | 'stable';

export interface WeightTrend {
    direction: TrendDirection;
    changePercent: number;
    changeAmount: number;
    unit: WeightUnit;
    periodDays: number;
    alert: boolean;
    alertMessage?: string;
}

export interface WeightHistory {
    entries: WeightEntry[];
    totalEntries: number;
    graphData: { date: string; weight: number; unit: WeightUnit }[];
}

/** Ideal weight ranges in kg by breed keyword (simplified reference data) */
const BREED_WEIGHT_RANGES: Record<string, { min: number; max: number }> = {
    chihuahua:    { min: 1.5, max: 3.0 },
    poodle:       { min: 3.0, max: 8.0 },
    labrador:     { min: 25.0, max: 36.0 },
    golden:       { min: 25.0, max: 34.0 },
    bulldog:      { min: 18.0, max: 25.0 },
    beagle:       { min: 9.0,  max: 14.0 },
    husky:        { min: 16.0, max: 27.0 },
    german:       { min: 22.0, max: 40.0 },
    yorkshire:    { min: 1.8, max: 3.2 },
    pomeranian:   { min: 1.8, max: 3.5 },
    default:      { min: 5.0, max: 30.0 },
};

@Injectable()
export class WeightTrackingService {
    constructor(
        @InjectRepository(WeightEntry)
        private readonly weightRepository: Repository<WeightEntry>,
    ) {}

    // ─── Helpers ────────────────────────────────────────────────────────────────

    private toKg(weight: number, unit: WeightUnit): number {
        return unit === WeightUnit.LBS ? weight * 0.453592 : weight;
    }

    private fromKg(weightKg: number, unit: WeightUnit): number {
        return unit === WeightUnit.LBS ? weightKg / 0.453592 : weightKg;
    }

    private getBreedRange(breed?: string): { min: number; max: number } {
        if (!breed) return BREED_WEIGHT_RANGES.default;
        const key = Object.keys(BREED_WEIGHT_RANGES).find((k) =>
        breed.toLowerCase().includes(k),
        );
        return BREED_WEIGHT_RANGES[key ?? 'default'];
    }

    // ─── CRUD ────────────────────────────────────────────────────────────────────

    async addWeightEntry(
        petId: string,
        dto: CreateWeightEntryDto,
    ): Promise<WeightEntry> {
        const entry = this.weightRepository.create({ ...dto, petId });
        return this.weightRepository.save(entry);
    }

    async getWeightHistory(petId: string): Promise<WeightHistory> {
        const entries = await this.weightRepository.find({
            where: { petId },
            order: { date: 'ASC', createdAt: 'ASC' },
        });

        const graphData = entries.map((e) => ({
            date: e.date,
            weight: Number(e.weight),
            unit: e.unit,
        }));

        return { entries, totalEntries: entries.length, graphData };
    }

    async deleteWeightEntry(petId: string, id: string): Promise<void> {
        const entry = await this.weightRepository.findOne({ where: { id, petId } });
        if (!entry) {
            throw new NotFoundException(`Weight entry ${id} not found for pet ${petId}`);
        }
        await this.weightRepository.remove(entry);
    }

    // ─── Trends ──────────────────────────────────────────────────────────────────

    async getWeightTrends(petId: string, periodDays = 30): Promise<WeightTrend> {
        const entries = await this.weightRepository.find({
            where: { petId },
            order: { date: 'ASC', createdAt: 'ASC' },
        });

        if (entries.length < 2) {
            throw new BadRequestException(
                'At least 2 weight entries are required to calculate trends.',
            );
        }

        // Filter entries within the period
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - periodDays);
        const recent = entries.filter((e) => new Date(e.date) >= cutoff);
        const relevant = recent.length >= 2 ? recent : entries.slice(-2);

        const oldest = relevant[0];
        const latest = relevant[relevant.length - 1];

        const oldestKg = this.toKg(Number(oldest.weight), oldest.unit);
        const latestKg = this.toKg(Number(latest.weight), latest.unit);

        const changeKg = latestKg - oldestKg;
        const changePercent = (changeKg / oldestKg) * 100;

        let direction: TrendDirection = 'stable';
        if (changePercent > 2) direction = 'gaining';
        else if (changePercent < -2) direction = 'losing';

        const ALERT_THRESHOLD = 10; // percent
        const alert = Math.abs(changePercent) > ALERT_THRESHOLD;
        const alertMessage = alert
        ? `⚠️ Significant weight ${direction === 'gaining' ? 'gain' : 'loss'} of ` +
            `${Math.abs(changePercent).toFixed(1)}% detected in the last ${periodDays} days. ` +
            `Please consult your vet.`
        : undefined;

        return {
            direction,
            changePercent: parseFloat(changePercent.toFixed(2)),
            changeAmount: parseFloat(
                this.fromKg(Math.abs(changeKg), latest.unit).toFixed(2),
            ),
            unit: latest.unit,
            periodDays,
            alert,
            alertMessage,
        };
    }

    // ─── Ideal Weight ─────────────────────────────────────────────────────────────

    getIdealWeightRange(
        breed: string,
        unit: WeightUnit = WeightUnit.KG,
    ): { min: number; max: number; unit: WeightUnit } {
        const rangeKg = this.getBreedRange(breed);
        return {
            min: parseFloat(this.fromKg(rangeKg.min, unit).toFixed(2)),
            max: parseFloat(this.fromKg(rangeKg.max, unit).toFixed(2)),
            unit,
        };
    }
}