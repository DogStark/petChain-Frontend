import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BehaviorService } from './behavior.service';
import { BehaviorLog, BehaviorCategory, BehaviorSeverity } from './entities/behavior-log.entity';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';

describe('BehaviorService', () => {
    let service: BehaviorService;
    let repository: Repository<BehaviorLog>;

    const mockRepository = {
        create: jest.fn(),
        save: jest.fn(),
        find: jest.fn(),
        findOne: jest.fn(),
        remove: jest.fn(),
        createQueryBuilder: jest.fn(() => ({
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            orderBy: jest.fn().mockReturnThis(),
            getMany: jest.fn(),
        })),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                BehaviorService,
                {
                    provide: getRepositoryToken(BehaviorLog),
                    useValue: mockRepository,
                },
            ],
        }).compile();

        service = module.get<BehaviorService>(BehaviorService);
        repository = module.get<Repository<BehaviorLog>>(getRepositoryToken(BehaviorLog));
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('create', () => {
        it('should create a behavior log', async () => {
            const petId = 'pet-id';
            const dto = {
                category: BehaviorCategory.ANXIETY,
                severity: BehaviorSeverity.MEDIUM,
                description: 'Pacing around',
                date: new Date().toISOString(),
            };
            const savedLog = { id: 'log-id', ...dto, petId };

            mockRepository.create.mockReturnValue(savedLog);
            mockRepository.save.mockResolvedValue(savedLog);

            const result = await service.create(petId, dto as any);
            expect(result).toEqual(savedLog);
            expect(mockRepository.create).toHaveBeenCalledWith({ ...dto, petId });
        });
    });

    describe('findAll', () => {
        it('should return behavior logs for a pet', async () => {
            const petId = 'pet-id';
            const logs = [{ id: '1', petId }, { id: '2', petId }];

            const qb = mockRepository.createQueryBuilder();
            (qb.getMany as jest.Mock).mockResolvedValue(logs);

            const result = await service.findAll(petId, {});
            expect(result).toEqual(logs);
        });
    });

    describe('findOne', () => {
        it('should return a log if found', async () => {
            const log = { id: '1' };
            mockRepository.findOne.mockResolvedValue(log);
            const result = await service.findOne('1');
            expect(result).toEqual(log);
        });

        it('should throw NotFoundException if not found', async () => {
            mockRepository.findOne.mockResolvedValue(null);
            await expect(service.findOne('1')).rejects.toThrow(NotFoundException);
        });
    });

    describe('getTrends', () => {
        it('should return trends for a pet', async () => {
            const petId = 'pet-id';
            const logs = [
                { category: BehaviorCategory.ANXIETY, date: new Date(), triggers: 'noise' },
                { category: BehaviorCategory.ANXIETY, date: new Date(), triggers: 'noise' },
                { category: BehaviorCategory.AGGRESSION, date: new Date(), triggers: 'stranger' },
            ];

            mockRepository.find.mockResolvedValue(logs);

            const result = await service.getTrends(petId);
            expect(result.totalLogs).toBe(3);
            expect(result.categoryFrequency[BehaviorCategory.ANXIETY]).toBe(2);
            expect(result.mostCommonTrigger).toBe('noise');
        });

        it('should return empty trends if no logs', async () => {
            mockRepository.find.mockResolvedValue([]);
            const result = await service.getTrends('pet-id');
            expect(result.totalLogs).toBe(0);
        });
    });

    describe('detectConcerningPatterns', () => {
        it('should alert for high severity recently', async () => {
            const logs = [
                {
                    category: BehaviorCategory.AGGRESSION,
                    severity: BehaviorSeverity.CRITICAL,
                    date: new Date(),
                    petId: 'pet-1'
                }
            ];
            // Accessing private method for testing
            const result = (service as any).detectConcerningPatterns(logs);
            expect(result.length).toBeGreaterThan(0);
            expect(result[0].type).toBe('HIGH_SEVERITY');
        });

        it('should alert for frequent aggression', async () => {
            const logs = [
                { category: BehaviorCategory.AGGRESSION, severity: BehaviorSeverity.LOW, date: new Date() },
                { category: BehaviorCategory.AGGRESSION, severity: BehaviorSeverity.LOW, date: new Date() },
                { category: BehaviorCategory.AGGRESSION, severity: BehaviorSeverity.LOW, date: new Date() },
            ];
            const result = (service as any).detectConcerningPatterns(logs);
            expect(result.some(r => r.type === 'FREQUENT_AGGRESSION')).toBeTruthy();
        });
    });
});
