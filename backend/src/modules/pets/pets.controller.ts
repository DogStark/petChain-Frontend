import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
<<<<<<< HEAD
=======
  HttpCode,
  HttpStatus,
>>>>>>> 2740dfc9f1ae7475a6ba260b78e15df3336d9c8b
  Query,
} from '@nestjs/common';
import { PetsService } from './pets.service';
import { CreatePetDto } from './dto/create-pet.dto';
import { UpdatePetDto } from './dto/update-pet.dto';
<<<<<<< HEAD
=======
import { Pet } from './entities/pet.entity';
>>>>>>> 2740dfc9f1ae7475a6ba260b78e15df3336d9c8b

@Controller('pets')
export class PetsController {
  constructor(private readonly petsService: PetsService) {}

<<<<<<< HEAD
  @Post()
  create(@Body() createPetDto: CreatePetDto) {
    return this.petsService.create(createPetDto);
  }

  @Get()
  findAll(@Query('ownerId') ownerId?: string) {
    return this.petsService.findAll(ownerId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.petsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updatePetDto: UpdatePetDto) {
    return this.petsService.update(id, updatePetDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.petsService.remove(id);
=======
  /**
   * Create a new pet
   * POST /pets
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createPetDto: CreatePetDto): Promise<Pet> {
    return await this.petsService.create(createPetDto);
  }

  /**
   * Get all pets
   * GET /pets
   */
  @Get()
  async findAll(@Query('ownerId') ownerId?: string): Promise<Pet[]> {
    if (ownerId) {
      return await this.petsService.findByOwner(ownerId);
    }
    return await this.petsService.findAll();
  }

  /**
   * Get a single pet by ID
   * GET /pets/:id
   */
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Pet> {
    return await this.petsService.findOne(id);
  }

  /**
   * Update a pet
   * PATCH /pets/:id
   */
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updatePetDto: UpdatePetDto,
  ): Promise<Pet> {
    return await this.petsService.update(id, updatePetDto);
  }

  /**
   * Delete a pet
   * DELETE /pets/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    return await this.petsService.remove(id);
>>>>>>> 2740dfc9f1ae7475a6ba260b78e15df3336d9c8b
  }
}
