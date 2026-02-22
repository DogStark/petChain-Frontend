import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    Put,
    Delete,
    Query,
    UseGuards,
    HttpStatus,
    HttpCode,
} from '@nestjs/common';
import { BehaviorService } from './behavior.service';
import { CreateBehaviorLogDto } from './dto/create-behavior-log.dto';
import { BehaviorFilterDto } from './dto/behavior-filter.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('pets/:petId/behavior')
@UseGuards(JwtAuthGuard)
export class BehaviorController {
    constructor(private readonly behaviorService: BehaviorService) { }

    @Post()
    @HttpCode(HttpStatus.CREATED)
    create(
        @Param('petId') petId: string,
        @Body() createBehaviorLogDto: CreateBehaviorLogDto,
    ) {
        return this.behaviorService.create(petId, createBehaviorLogDto);
    }

    @Get()
    findAll(
        @Param('petId') petId: string,
        @Query() filter: BehaviorFilterDto,
    ) {
        return this.behaviorService.findAll(petId, filter);
    }

    @Get('trends')
    getTrends(@Param('petId') petId: string) {
        return this.behaviorService.getTrends(petId);
    }

    @Get('alerts')
    getAlerts(@Param('petId') petId: string) {
        return this.behaviorService.getAlerts(petId);
    }

    @Get('export')
    exportReport(@Param('petId') petId: string) {
        return this.behaviorService.exportReport(petId);
    }

    @Put(':id')
    update(
        @Param('id') id: string,
        @Body() updateDto: Partial<CreateBehaviorLogDto>,
    ) {
        return this.behaviorService.update(id, updateDto);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    remove(@Param('id') id: string) {
        return this.behaviorService.remove(id);
    }

    @Post(':id/share')
    shareWithVet(
        @Param('id') id: string,
        @Body('shared') shared: boolean,
    ) {
        return this.behaviorService.shareWithVet(id, shared);
    }
}
