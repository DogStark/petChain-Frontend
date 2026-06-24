import {
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { SearchService } from './search.service';
import { IndexingService } from './indexing.service';
import { SearchQueryDto } from './dto/search-query.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@Controller('search')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class SearchController {
  constructor(
    private readonly searchService: SearchService,
    private readonly indexingService: IndexingService,
  ) {}

  @Get('pets')
  async searchPets(@Query() queryDto: SearchQueryDto) {
    return await this.searchService.searchPets(queryDto);
  }

  @Get('vets')
  async searchVets(@Query() queryDto: SearchQueryDto) {
    return await this.searchService.searchVets(queryDto);
  }

  @Get('medical-records')
  async searchMedicalRecords(@Query() queryDto: SearchQueryDto) {
    return await this.searchService.searchMedicalRecords(queryDto);
  }

  @Get('emergency-services')
  async searchEmergencyServices(@Query() queryDto: SearchQueryDto) {
    return await this.searchService.searchEmergencyServices(queryDto);
  }

  @Get('global')
  async globalSearch(@Query() queryDto: SearchQueryDto) {
    return await this.searchService.globalSearch(queryDto);
  }

  @Get('autocomplete')
  async autocomplete(
    @Query('query') query: string,
    @Query('type') type?: string,
  ) {
    return await this.searchService.autocomplete(query, type);
  }

  @Get('popular')
  async getPopularQueries(@Query('limit') limit?: string) {
    const parsedLimit = limit !== undefined ? parseInt(limit, 10) : undefined;
    return await this.searchService.getPopularQueries(parsedLimit);
  }

  @Get('analytics')
  async getSearchAnalytics(@Query('days') days?: string) {
    const parsedDays = days !== undefined ? parseInt(days, 10) : undefined;
    return await this.searchService.getSearchAnalytics(parsedDays);
  }

  @Post('reindex')
  @UseGuards(JwtAuthGuard)
  async reindex() {
    return await this.indexingService.reindexAll();
  }
}
