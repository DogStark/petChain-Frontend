import { Test, TestingModule } from '@nestjs/testing';
import { BehaviorController } from './behavior.controller';
import { BehaviorService } from './behavior.service';
import { BehaviorCategory, BehaviorSeverity } from './entities/behavior-log.entity';

describe('BehaviorController', () => {
    let controller: BehaviorController;
    let service: BehaviorService;

    const mockBehaviorService = {
        create: jest.fn(),
        findAll: jest.fn(),
        getTrends: jest.fn(),
        getAlerts: jest.fn(),
        update: jest.fn(),
        remove: jest.fn(),
        shareWithVet: jest.fn(),
        exportReport: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [BehaviorController],
            providers: [
                {
                    provide: BehaviorService,
                    useValue: mockBehaviorService,
                },
            ],
        }).compile();

        controller = module.get<BehaviorController>(BehaviorController);
        service = module.get<BehaviorService>(BehaviorService);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('create', () => {
        it('should call service.create', async () => {
            const petId = 'pet-id';
            const dto = {
                category: BehaviorCategory.ANXIETY,
                severity: BehaviorSeverity.LOW,
                description: 'Test',
                date: new Date().toISOString(),
            };
            await controller.create(petId, dto as any);
            expect(mockBehaviorService.create).toHaveBeenCalledWith(petId, dto);
        });
    });

    describe('findAll', () => {
        it('should call service.findAll', async () => {
            const petId = 'pet-id';
            const filter = { category: BehaviorCategory.ANXIETY };
            await controller.findAll(petId, filter as any);
            expect(mockBehaviorService.findAll).toHaveBeenCalledWith(petId, filter);
        });
    });

    describe('getTrends', () => {
        it('should call service.getTrends', async () => {
            const petId = 'pet-id';
            await controller.getTrends(petId);
            expect(mockBehaviorService.getTrends).toHaveBeenCalledWith(petId);
        });
    });

    describe('shareWithVet', () => {
        it('should call service.shareWithVet', async () => {
            const id = 'log-id';
            await controller.shareWithVet(id, true);
            expect(mockBehaviorService.shareWithVet).toHaveBeenCalledWith(id, true);
        });
    });
});
