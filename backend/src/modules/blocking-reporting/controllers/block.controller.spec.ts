import { Test, TestingModule } from '@nestjs/testing';
import { BlockController } from './block.controller';
import { BlockService } from '../services/block.service';

describe('BlockController', () => {
    let controller: BlockController;
    let blockService: BlockService;

    const mockBlockService = {
        createBlock: jest.fn(),
        unblockUser: jest.fn(),
        getBlockedUsers: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [BlockController],
            providers: [
                {
                    provide: BlockService,
                    useValue: mockBlockService,
                },
            ],
        }).compile();

        controller = module.get<BlockController>(BlockController);
        blockService = module.get<BlockService>(BlockService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('createBlock', () => {
        it('should create a block', async () => {
            const dto = { blockedUserId: 'user-2' };
            mockBlockService.createBlock.mockResolvedValue({ id: 'block-1' });

            const result = await controller.createBlock('user-1', dto);
            expect(result).toEqual({ id: 'block-1' });
            expect(mockBlockService.createBlock).toHaveBeenCalledWith('user-1', dto);
        });
    });

    describe('unblockUser', () => {
        it('should unblock a user', async () => {
            mockBlockService.unblockUser.mockResolvedValue(undefined);

            const result = await controller.unblockUser('user-1', 'user-2');
            expect(result).toBeUndefined();
            expect(mockBlockService.unblockUser).toHaveBeenCalledWith('user-1', 'user-2');
        });
    });

    describe('getBlockedUsers', () => {
        it('should return paginated blocked users', async () => {
            mockBlockService.getBlockedUsers.mockResolvedValue({ data: [], total: 0 });

            const result = await controller.getBlockedUsers('user-1', 10, 1);
            expect(result).toEqual({ data: [], total: 0 });
            expect(mockBlockService.getBlockedUsers).toHaveBeenCalledWith('user-1', 10, 1);
        });
    });
});
