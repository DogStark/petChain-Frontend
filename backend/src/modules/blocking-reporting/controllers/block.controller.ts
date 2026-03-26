import {
    Controller,
    Post,
    Body,
    UseGuards,
    Delete,
    Param,
    Get,
    Query,
} from '@nestjs/common';
import { BlockService } from '../services/block.service';
import { CreateBlockDto } from '../dto/create-block.dto';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';

@Controller('blocks')
@UseGuards(JwtAuthGuard)
export class BlockController {
    constructor(private readonly blockService: BlockService) { }

    @Post()
    async createBlock(
        @CurrentUser('id') userId: string,
        @Body() createBlockDto: CreateBlockDto,
    ) {
        return this.blockService.createBlock(userId, createBlockDto);
    }

    @Delete(':blockedUserId')
    async unblockUser(
        @CurrentUser('id') userId: string,
        @Param('blockedUserId') blockedUserId: string,
    ) {
        return this.blockService.unblockUser(userId, blockedUserId);
    }

    @Get()
    async getBlockedUsers(
        @CurrentUser('id') userId: string,
        @Query('limit') limit: number = 10,
        @Query('page') page: number = 1,
    ) {
        return this.blockService.getBlockedUsers(userId, limit, page);
    }
}
