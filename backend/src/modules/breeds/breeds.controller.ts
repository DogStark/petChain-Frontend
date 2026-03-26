import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { BreedsService } from './breeds.service';
import { CreateBreedDto } from './dto/create-breed.dto';
import { UpdateBreedDto } from './dto/update-breed.dto';
import { SearchBreedsDto } from './dto/search-breeds.dto';
import { SpeciesType } from './entities/breed.entity';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@Controller('breeds')
export class BreedsController {
  constructor(private readonly breedsService: BreedsService) {}

  /**
   * Create a new breed (Admin only)
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createBreedDto: CreateBreedDto) {
    return await this.breedsService.create(createBreedDto);
  }

  /**
   * Get all breeds with search and filtering
   */
  @Get()
  async findAll(@Query() searchDto: SearchBreedsDto) {
    return await this.breedsService.findAll(searchDto);
  }

  /**
   * Get breed statistics
   */
  @Get('statistics')
  async getStatistics() {
    return await this.breedsService.getStatistics();
  }

  /**
   * Get popular breeds
   */
  @Get('popular')
  async getPopularBreeds(
    @Query('species') species?: SpeciesType,
    @Query('limit') limit: number = 10,
  ) {
    return await this.breedsService.getPopularBreeds(species, limit);
  }

  /**
   * Search breeds by name
   */
  @Get('search')
  async searchByName(@Query('name') name: string) {
    if (!name) {
      return [];
    }
    return await this.breedsService.searchByName(name);
  }

  /**
   * Get breeds by species (dogs or cats)
   */
  @Get('species/:species')
  async findBySpecies(@Param('species') species: SpeciesType) {
    return await this.breedsService.findBySpecies(species);
  }

  /**
   * Get single breed by ID
   */
  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.breedsService.findOne(id);
  }

  /**
   * Update breed (Admin only)
   */
  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateBreedDto: UpdateBreedDto,
  ) {
    return await this.breedsService.update(id, updateBreedDto);
  }

  /**
   * Delete breed (Admin only)
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return await this.breedsService.remove(id);
  }
}