import { Controller, Get, Query } from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchQueryDto } from './dto/search-query.dto';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

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
  async getPopularQueries(@Query('limit') limit?: number) {
    return await this.searchService.getPopularQueries(limit);
  }

  @Get('analytics')
  async getSearchAnalytics(@Query('days') days?: number) {
    return await this.searchService.getSearchAnalytics(days);
  }
}
