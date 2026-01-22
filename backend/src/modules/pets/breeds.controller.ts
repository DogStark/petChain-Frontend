import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { BreedsService } from './breeds.service';
import { CreateBreedDto } from './dto/create-breed.dto';
import { UpdateBreedDto } from './dto/update-breed.dto';
import { Breed } from './entities/breed.entity';
import { PetSpecies } from './entities/pet.entity';

@Controller('breeds')
export class BreedsController {
  constructor(private readonly breedsService: BreedsService) {}

  /**
   * Create a new breed
   * POST /breeds
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createBreedDto: CreateBreedDto): Promise<Breed> {
    return await this.breedsService.create(createBreedDto);
  }

  /**
   * Get all breeds (optionally filtered by species)
   * GET /breeds
   */
  @Get()
  async findAll(@Query('species') species?: PetSpecies): Promise<Breed[]> {
    if (species) {
      return await this.breedsService.findBySpecies(species);
    }
    return await this.breedsService.findAll();
  }

  /**
   * Get a single breed by ID with vaccination schedules
   * GET /breeds/:id
   */
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Breed> {
    return await this.breedsService.findOne(id);
  }

  /**
   * Update a breed
   * PATCH /breeds/:id
   */
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateBreedDto: UpdateBreedDto,
  ): Promise<Breed> {
    return await this.breedsService.update(id, updateBreedDto);
  }

  /**
   * Delete a breed
   * DELETE /breeds/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    return await this.breedsService.remove(id);
  }
}
