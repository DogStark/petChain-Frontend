import {
  Injectable,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Block } from '../entities/block.entity';
import { CreateBlockDto } from '../dto/create-block.dto';
import { AuditService } from '../../audit/audit.service';
import { AuditAction } from '../../audit/entities/audit-log.entity';

@Injectable()
export class BlockService {
  constructor(
    @InjectRepository(Block)
    private readonly blockRepository: Repository<Block>,
    private readonly auditService: AuditService,
  ) {}

  async createBlock(
    blockerId: string,
    createBlockDto: CreateBlockDto,
  ): Promise<Block> {
    const { blockedUserId } = createBlockDto;

    // Validate that blocker and blocked user are different (reject self-blocking)
    if (blockerId === blockedUserId) {
      throw new BadRequestException('Users cannot block themselves');
    }

    // Check for existing block record (idempotent operation)
    const existingBlock = await this.blockRepository.findOne({
      where: {
        blocker: blockerId,
        blockedUser: blockedUserId,
      },
    });

    if (existingBlock) {
      // Return existing block record for idempotent operation
      return existingBlock;
    }

    // Create block record with timestamp
    const block = this.blockRepository.create({
      blocker: blockerId,
      blockedUser: blockedUserId,
    });

    const savedBlock = await this.blockRepository.save(block);

    // Call audit service to log block action
    await this.auditService.log(
      blockerId,
      'Block',
      savedBlock.id,
      AuditAction.CREATE,
    );

    // Return created block record
    return savedBlock;
  }

  async unblockUser(blockerId: string, blockedUserId: string): Promise<void> {
    const block = await this.blockRepository.findOne({
      where: { blocker: blockerId, blockedUser: blockedUserId },
    });

    if (!block) {
      throw new BadRequestException('Block record not found');
    }

    await this.blockRepository.remove(block);

    await this.auditService.log(
      blockerId,
      'Unblock',
      block.id,
      AuditAction.DELETE,
    );
  }

  async getBlockedUsers(
    blockerId: string,
    limit: number = 10,
    page: number = 1,
  ): Promise<{ data: Block[]; total: number; page: number; limit: number }> {
    const skip = (page - 1) * limit;

    const [data, total] = await this.blockRepository.findAndCount({
      where: { blocker: blockerId },
      relations: ['blockedUserEntity'],
      skip,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    // Strip sensitive info from blocked user entity
    data.forEach((block) => {
      if (block.blockedUserEntity) {
        delete block.blockedUserEntity.password;
        delete block.blockedUserEntity.passwordResetToken;
        delete block.blockedUserEntity.emailVerificationToken;
      }
    });

    return {
      data,
      total,
      page,
      limit,
    };
  }

  async isBlocked(userId1: string, userId2: string): Promise<boolean> {
    const block = await this.blockRepository.findOne({
      where: [
        { blocker: userId1, blockedUser: userId2 },
        { blocker: userId2, blockedUser: userId1 },
      ],
    });

    return !!block;
  }
}
