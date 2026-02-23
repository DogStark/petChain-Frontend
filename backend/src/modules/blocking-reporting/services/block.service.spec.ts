import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BadRequestException } from '@nestjs/common';
import { BlockService } from './block.service';
import { Block } from '../entities/block.entity';
import { AuditService } from '../../audit/audit.service';
import { AuditAction } from '../../audit/entities/audit-log.entity';

describe('BlockService', () => {
  let service: BlockService;
  let blockRepository: Repository<Block>;
  let auditService: AuditService;

  const mockBlockRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
    findAndCount: jest.fn(),
  };

  const mockAuditService = {
    log: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlockService,
        {
          provide: getRepositoryToken(Block),
          useValue: mockBlockRepository,
        },
        {
          provide: AuditService,
          useValue: mockAuditService,
        },
      ],
    }).compile();

    service = module.get<BlockService>(BlockService);
    blockRepository = module.get<Repository<Block>>(getRepositoryToken(Block));
    auditService = module.get<AuditService>(AuditService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createBlock', () => {
    const blockerId = 'blocker-uuid';
    const blockedUserId = 'blocked-uuid';
    const createBlockDto = { blockedUserId };

    it('should reject self-blocking', async () => {
      const selfBlockDto = { blockedUserId: blockerId };

      await expect(
        service.createBlock(blockerId, selfBlockDto),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.createBlock(blockerId, selfBlockDto),
      ).rejects.toThrow('Users cannot block themselves');
    });

    it('should return existing block if already exists (idempotent)', async () => {
      const existingBlock = {
        id: 'block-uuid',
        blocker: blockerId,
        blockedUser: blockedUserId,
        createdAt: new Date(),
      };

      mockBlockRepository.findOne.mockResolvedValue(existingBlock);

      const result = await service.createBlock(blockerId, createBlockDto);

      expect(result).toEqual(existingBlock);
      expect(mockBlockRepository.findOne).toHaveBeenCalledWith({
        where: {
          blocker: blockerId,
          blockedUser: blockedUserId,
        },
      });
      expect(mockBlockRepository.create).not.toHaveBeenCalled();
      expect(mockBlockRepository.save).not.toHaveBeenCalled();
      expect(mockAuditService.log).not.toHaveBeenCalled();
    });

    it('should create new block record with timestamp', async () => {
      const newBlock = {
        blocker: blockerId,
        blockedUser: blockedUserId,
      };

      const savedBlock = {
        id: 'new-block-uuid',
        ...newBlock,
        createdAt: new Date(),
      };

      mockBlockRepository.findOne.mockResolvedValue(null);
      mockBlockRepository.create.mockReturnValue(newBlock);
      mockBlockRepository.save.mockResolvedValue(savedBlock);

      const result = await service.createBlock(blockerId, createBlockDto);

      expect(result).toEqual(savedBlock);
      expect(mockBlockRepository.create).toHaveBeenCalledWith({
        blocker: blockerId,
        blockedUser: blockedUserId,
      });
      expect(mockBlockRepository.save).toHaveBeenCalledWith(newBlock);
    });

    it('should call audit service to log block action', async () => {
      const newBlock = {
        blocker: blockerId,
        blockedUser: blockedUserId,
      };

      const savedBlock = {
        id: 'new-block-uuid',
        ...newBlock,
        createdAt: new Date(),
      };

      mockBlockRepository.findOne.mockResolvedValue(null);
      mockBlockRepository.create.mockReturnValue(newBlock);
      mockBlockRepository.save.mockResolvedValue(savedBlock);

      await service.createBlock(blockerId, createBlockDto);

      expect(mockAuditService.log).toHaveBeenCalledWith(
        blockerId,
        'Block',
        savedBlock.id,
        AuditAction.CREATE,
      );
    });

    it('should validate different users', async () => {
      const differentBlockerId = 'different-blocker-uuid';
      const newBlock = {
        blocker: differentBlockerId,
        blockedUser: blockedUserId,
      };

      const savedBlock = {
        id: 'new-block-uuid',
        ...newBlock,
        createdAt: new Date(),
      };

      mockBlockRepository.findOne.mockResolvedValue(null);
      mockBlockRepository.create.mockReturnValue(newBlock);
      mockBlockRepository.save.mockResolvedValue(savedBlock);

      const result = await service.createBlock(
        differentBlockerId,
        createBlockDto,
      );

      expect(result).toEqual(savedBlock);
      expect(result.blocker).not.toEqual(result.blockedUser);
    });
  });

  describe('unblockUser', () => {
    const blockerId = 'blocker-uuid';
    const blockedUserId = 'blocked-uuid';

    it('should successfully unblock a user', async () => {
      const existingBlock = { id: 'block-uuid', blocker: blockerId, blockedUser: blockedUserId };
      mockBlockRepository.findOne.mockResolvedValue(existingBlock);

      await service.unblockUser(blockerId, blockedUserId);

      expect(mockBlockRepository.findOne).toHaveBeenCalledWith({
        where: { blocker: blockerId, blockedUser: blockedUserId },
      });
      expect(mockBlockRepository.remove).toHaveBeenCalledWith(existingBlock);
      expect(mockAuditService.log).toHaveBeenCalledWith(
        blockerId,
        'Unblock',
        existingBlock.id,
        AuditAction.DELETE,
      );
    });

    it('should throw BadRequestException if block record not found', async () => {
      mockBlockRepository.findOne.mockResolvedValue(null);

      await expect(service.unblockUser(blockerId, blockedUserId)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockBlockRepository.remove).not.toHaveBeenCalled();
      expect(mockAuditService.log).not.toHaveBeenCalled();
    });
  });

  describe('getBlockedUsers', () => {
    const blockerId = 'blocker-uuid';

    it('should return a list of blocked users', async () => {
      const mockedData = [
        {
          id: 'block-1',
          blocker: blockerId,
          blockedUser: 'user-1',
          blockedUserEntity: { id: 'user-1', password: 'pwd', firstName: 'John' },
        },
      ];
      mockBlockRepository.findAndCount.mockResolvedValue([mockedData, 1]);

      const result = await service.getBlockedUsers(blockerId, 10, 1);

      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.data[0].blockedUserEntity).not.toHaveProperty('password');
      expect(result.data[0].blockedUserEntity).toHaveProperty('firstName', 'John');
      expect(mockBlockRepository.findAndCount).toHaveBeenCalledWith({
        where: { blocker: blockerId },
        relations: ['blockedUserEntity'],
        skip: 0,
        take: 10,
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('isBlocked', () => {
    const userId1 = 'user-1';
    const userId2 = 'user-2';

    it('should return true if blocked', async () => {
      mockBlockRepository.findOne.mockResolvedValue({ id: 'block-id' });
      const result = await service.isBlocked(userId1, userId2);
      expect(result).toBe(true);
    });

    it('should return false if not blocked', async () => {
      mockBlockRepository.findOne.mockResolvedValue(null);
      const result = await service.isBlocked(userId1, userId2);
      expect(result).toBe(false);
    });
  });
});
