import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';

import { WeightTrackingService } from './weight-tracking.service';
import { WeightTrackingController } from './weight-tracking.controller';
import { WeightEntry, WeightUnit } from './entities/weight-entry.entity';
import { CreateWeightEntryDto } from './dto/create-weight-entry.dto';

// ─── Mock factory ────────────────────────────────────────────────────────────

const mockEntry = (overrides: Partial<WeightEntry> = {}): WeightEntry => ({
    id: 'entry-uuid-1',
    petId: 'pet-uuid-1',
    weight: 12.5,
    unit: WeightUnit.KG,
    date: '2025-01-01',
    notes: 'Initial weigh-in',
    createdAt: new Date('2025-01-01T10:00:00Z'),
    pet: undefined as any,
    ...overrides,
});

const mockRepo = () => ({
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
});

// ─── Service Tests ────────────────────────────────────────────────────────────

describe('WeightTrackingService', () => {
    let service: WeightTrackingService;
    let repo: jest.Mocked<Repository<WeightEntry>>;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
        providers: [
            WeightTrackingService,
            { provide: getRepositoryToken(WeightEntry), useFactory: mockRepo },
        ],
        }).compile();

        service = module.get<WeightTrackingService>(WeightTrackingService);
        repo = module.get(getRepositoryToken(WeightEntry));
    });

  // ── addWeightEntry ──────────────────────────────────────────────────────────

    describe('addWeightEntry()', () => {
        it('should create and save a weight entry', async () => {
        const dto: CreateWeightEntryDto = {
            weight: 12.5,
            unit: WeightUnit.KG,
            date: '2025-01-01',
            notes: 'Test',
        };
        const entry = mockEntry();
        repo.create.mockReturnValue(entry);
        repo.save.mockResolvedValue(entry);

        const result = await service.addWeightEntry('pet-uuid-1', dto);

        expect(repo.create).toHaveBeenCalledWith({ ...dto, petId: 'pet-uuid-1' });
        expect(repo.save).toHaveBeenCalledWith(entry);
        expect(result).toEqual(entry);
        });
    });

  // ── getWeightHistory ────────────────────────────────────────────────────────

    describe('getWeightHistory()', () => {
        it('should return entries in chronological order with graph data', async () => {
        const entries = [
            mockEntry({ date: '2025-01-01', weight: 12.0 }),
            mockEntry({ id: 'entry-uuid-2', date: '2025-02-01', weight: 13.0 }),
        ];
        repo.find.mockResolvedValue(entries);

        const result = await service.getWeightHistory('pet-uuid-1');

        expect(result.totalEntries).toBe(2);
        expect(result.graphData).toHaveLength(2);
        expect(result.graphData[0]).toMatchObject({ date: '2025-01-01', weight: 12.0 });
        });

        it('should return empty history when no entries exist', async () => {
        repo.find.mockResolvedValue([]);
        const result = await service.getWeightHistory('pet-uuid-1');
        expect(result.totalEntries).toBe(0);
        expect(result.entries).toHaveLength(0);
        });
    });

  // ── deleteWeightEntry ───────────────────────────────────────────────────────

    describe('deleteWeightEntry()', () => {
        it('should delete an existing entry', async () => {
        const entry = mockEntry();
        repo.findOne.mockResolvedValue(entry);
        repo.remove.mockResolvedValue(entry);

        await service.deleteWeightEntry('pet-uuid-1', 'entry-uuid-1');

        expect(repo.remove).toHaveBeenCalledWith(entry);
        });

        it('should throw NotFoundException when entry does not exist', async () => {
        repo.findOne.mockResolvedValue(null);

        await expect(
            service.deleteWeightEntry('pet-uuid-1', 'non-existent'),
        ).rejects.toThrow(NotFoundException);
        });
    });

    // ── getWeightTrends ─────────────────────────────────────────────────────────

    describe('getWeightTrends()', () => {
        it('should detect gaining trend', async () => {
        const now = new Date();
        const recent = new Date(now);
        recent.setDate(now.getDate() - 5);

        repo.find.mockResolvedValue([
            mockEntry({ date: recent.toISOString().split('T')[0], weight: 10.0 }),
            mockEntry({ id: 'e2', date: now.toISOString().split('T')[0], weight: 12.0 }),
        ]);

        const result = await service.getWeightTrends('pet-uuid-1', 30);
        expect(result.direction).toBe('gaining');
        expect(result.changePercent).toBeGreaterThan(0);
        });

        it('should detect losing trend', async () => {
        const now = new Date();
        const recent = new Date(now);
        recent.setDate(now.getDate() - 5);

        repo.find.mockResolvedValue([
            mockEntry({ date: recent.toISOString().split('T')[0], weight: 12.0 }),
            mockEntry({ id: 'e2', date: now.toISOString().split('T')[0], weight: 10.0 }),
        ]);

        const result = await service.getWeightTrends('pet-uuid-1', 30);
        expect(result.direction).toBe('losing');
        });

        it('should detect stable trend', async () => {
        const now = new Date();
        const recent = new Date(now);
        recent.setDate(now.getDate() - 5);

        repo.find.mockResolvedValue([
            mockEntry({ date: recent.toISOString().split('T')[0], weight: 12.0 }),
            mockEntry({ id: 'e2', date: now.toISOString().split('T')[0], weight: 12.1 }),
        ]);

        const result = await service.getWeightTrends('pet-uuid-1', 30);
        expect(result.direction).toBe('stable');
        });

        it('should trigger alert when weight change > 10% in 30 days', async () => {
        const now = new Date();
        const recent = new Date(now);
        recent.setDate(now.getDate() - 10);

        repo.find.mockResolvedValue([
            mockEntry({ date: recent.toISOString().split('T')[0], weight: 10.0 }),
            mockEntry({ id: 'e2', date: now.toISOString().split('T')[0], weight: 11.5 }),
        ]);

        const result = await service.getWeightTrends('pet-uuid-1', 30);
        expect(result.alert).toBe(true);
        expect(result.alertMessage).toBeDefined();
        });

        it('should NOT alert when weight change is within 10%', async () => {
        const now = new Date();
        const recent = new Date(now);
        recent.setDate(now.getDate() - 10);

        repo.find.mockResolvedValue([
            mockEntry({ date: recent.toISOString().split('T')[0], weight: 10.0 }),
            mockEntry({ id: 'e2', date: now.toISOString().split('T')[0], weight: 10.5 }),
        ]);

        const result = await service.getWeightTrends('pet-uuid-1', 30);
        expect(result.alert).toBe(false);
        });

        it('should throw BadRequestException when fewer than 2 entries', async () => {
        repo.find.mockResolvedValue([mockEntry()]);

        await expect(
            service.getWeightTrends('pet-uuid-1', 30),
        ).rejects.toThrow(BadRequestException);
        });

        it('should convert lbs to kg for comparison', async () => {
        const now = new Date();
        const recent = new Date(now);
        recent.setDate(now.getDate() - 5);

        repo.find.mockResolvedValue([
            mockEntry({ date: recent.toISOString().split('T')[0], weight: 22.0, unit: WeightUnit.LBS }),
            mockEntry({ id: 'e2', date: now.toISOString().split('T')[0], weight: 26.5, unit: WeightUnit.LBS }),
        ]);

        const result = await service.getWeightTrends('pet-uuid-1', 30);
        expect(result.direction).toBe('gaining');
        expect(result.unit).toBe(WeightUnit.LBS);
        });
    });

    // ── getIdealWeightRange ─────────────────────────────────────────────────────

    describe('getIdealWeightRange()', () => {
        it('should return range for known breed in kg', () => {
        const range = service.getIdealWeightRange('labrador', WeightUnit.KG);
        expect(range.min).toBeGreaterThan(0);
        expect(range.max).toBeGreaterThan(range.min);
        expect(range.unit).toBe(WeightUnit.KG);
        });

        it('should return range in lbs when requested', () => {
        const rangeKg = service.getIdealWeightRange('labrador', WeightUnit.KG);
        const rangeLbs = service.getIdealWeightRange('labrador', WeightUnit.LBS);
        expect(rangeLbs.min).toBeCloseTo(rangeKg.min * 2.20462, 0);
        });

        it('should return default range for unknown breed', () => {
        const range = service.getIdealWeightRange('unknownbreed', WeightUnit.KG);
        expect(range.min).toBe(5.0);
        expect(range.max).toBe(30.0);
        });
    });
});

// ─── Controller Tests ─────────────────────────────────────────────────────────

describe('WeightTrackingController', () => {
    let controller: WeightTrackingController;
    let service: WeightTrackingService;

    const mockService = {
        addWeightEntry: jest.fn(),
        getWeightHistory: jest.fn(),
        getWeightTrends: jest.fn(),
        getIdealWeightRange: jest.fn(),
        deleteWeightEntry: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
        controllers: [WeightTrackingController],
        providers: [{ provide: WeightTrackingService, useValue: mockService }],
        }).compile();

        controller = module.get<WeightTrackingController>(WeightTrackingController);
        service = module.get<WeightTrackingService>(WeightTrackingService);
    });

    it('should call addWeightEntry on POST', async () => {
        const dto: CreateWeightEntryDto = { weight: 12.5, unit: WeightUnit.KG, date: '2025-01-01' };
        mockService.addWeightEntry.mockResolvedValue(mockEntry());

        await controller.addWeightEntry('pet-uuid-1', dto);
        expect(service.addWeightEntry).toHaveBeenCalledWith('pet-uuid-1', dto);
    });

    it('should call getWeightHistory on GET', async () => {
        mockService.getWeightHistory.mockResolvedValue({ entries: [], totalEntries: 0, graphData: [] });

        await controller.getWeightHistory('pet-uuid-1');
        expect(service.getWeightHistory).toHaveBeenCalledWith('pet-uuid-1');
    });

    it('should call getWeightTrends with default 30 days', async () => {
        mockService.getWeightTrends.mockResolvedValue({});
        await controller.getWeightTrends('pet-uuid-1');
        expect(service.getWeightTrends).toHaveBeenCalledWith('pet-uuid-1', 30);
    });

    it('should call getWeightTrends with custom period', async () => {
        mockService.getWeightTrends.mockResolvedValue({});
        await controller.getWeightTrends('pet-uuid-1', '60');
        expect(service.getWeightTrends).toHaveBeenCalledWith('pet-uuid-1', 60);
    });

    it('should call deleteWeightEntry on DELETE', async () => {
        mockService.deleteWeightEntry.mockResolvedValue(undefined);
        await controller.deleteWeightEntry('pet-uuid-1', 'entry-uuid-1');
        expect(service.deleteWeightEntry).toHaveBeenCalledWith('pet-uuid-1', 'entry-uuid-1');
    });
});