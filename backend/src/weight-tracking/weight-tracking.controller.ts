import {
    Controller,
    Get,
    Post,
    Delete,
    Body,
    Param,
    Query,
    ParseUUIDPipe,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiParam,
    ApiQuery,
    ApiResponse,
} from '@nestjs/swagger';
import { WeightTrackingService } from './weight-tracking.service';
import { CreateWeightEntryDto } from './dto/create-weight-entry.dto';
import { WeightUnit } from './entities/weight-entry.entity';

@ApiTags('Weight Tracking')
@Controller('pets/:petId/weight')
export class WeightTrackingController {
    constructor(private readonly weightTrackingService: WeightTrackingService) {}

    /**
     * POST /pets/:petId/weight
     * Add a new weight entry for a pet.
     */
    @Post()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Add a weight entry for a pet' })
    @ApiParam({ name: 'petId', description: 'UUID of the pet' })
    @ApiResponse({ status: 201, description: 'Weight entry created successfully.' })
    async addWeightEntry(
        @Param('petId', ParseUUIDPipe) petId: string,
        @Body() dto: CreateWeightEntryDto,
    ) {
        return this.weightTrackingService.addWeightEntry(petId, dto);
    }

    /**
     * GET /pets/:petId/weight
     * Retrieve full weight history for a pet (chronological, graph-ready).
     */
    @Get()
    @ApiOperation({ summary: 'Get weight history for a pet' })
    @ApiParam({ name: 'petId', description: 'UUID of the pet' })
    @ApiResponse({ status: 200, description: 'Weight history returned.' })
    async getWeightHistory(
        @Param('petId', ParseUUIDPipe) petId: string,
    ) {
        return this.weightTrackingService.getWeightHistory(petId);
    }

    /**
   * GET /pets/:petId/weight/trends
   * Get weight trend analysis with alerts for significant changes.
   */
    @Get('trends')
    @ApiOperation({ summary: 'Get weight trends and alerts for a pet' })
    @ApiParam({ name: 'petId', description: 'UUID of the pet' })
    @ApiQuery({ name: 'days', required: false, description: 'Period in days (default: 30)' })
    @ApiResponse({ status: 200, description: 'Trend data returned.' })
    async getWeightTrends(
        @Param('petId', ParseUUIDPipe) petId: string,
        @Query('days') days?: string,
    ) {
        const periodDays = days ? parseInt(days, 10) : 30;
        return this.weightTrackingService.getWeightTrends(petId, periodDays);
    }

    /**
     * GET /pets/:petId/weight/ideal?breed=labrador&unit=kg
     * Return ideal weight range for a given breed.
     */
    @Get('ideal')
    @ApiOperation({ summary: 'Get ideal weight range by breed' })
    @ApiParam({ name: 'petId', description: 'UUID of the pet' })
    @ApiQuery({ name: 'breed', required: true, description: 'Breed name' })
    @ApiQuery({ name: 'unit', required: false, enum: WeightUnit })
    async getIdealWeight(
        @Param('petId', ParseUUIDPipe) _petId: string,
        @Query('breed') breed: string,
        @Query('unit') unit: WeightUnit = WeightUnit.KG,
    ) {
        return this.weightTrackingService.getIdealWeightRange(breed, unit);
    }

    /**
     * DELETE /pets/:petId/weight/:id
     * Delete a specific weight entry.
     */
    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Delete a weight entry' })
    @ApiParam({ name: 'petId', description: 'UUID of the pet' })
    @ApiParam({ name: 'id', description: 'UUID of the weight entry' })
    @ApiResponse({ status: 204, description: 'Weight entry deleted.' })
    async deleteWeightEntry(
        @Param('petId', ParseUUIDPipe) petId: string,
        @Param('id', ParseUUIDPipe) id: string,
    ): Promise<void> {
        return this.weightTrackingService.deleteWeightEntry(petId, id);
    }
}