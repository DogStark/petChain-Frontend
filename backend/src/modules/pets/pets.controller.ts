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
import { PetsService } from './pets.service';
import { CreatePetDto } from './dto/create-pet.dto';
import { UpdatePetDto } from './dto/update-pet.dto';
import { Pet } from './entities/pet.entity';

@Controller('pets')
export class PetsController {
  constructor(private readonly petsService: PetsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createPetDto: CreatePetDto): Promise<Pet> {
    return this.petsService.create(createPetDto);
  }

  @Get()
  findAll(@Query('ownerId') ownerId?: string): Promise<Pet[]> {
    return this.petsService.findAll(ownerId);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<Pet> {
    return this.petsService.findOne(id);
  }

  @Get(':id/health-summary')
  async getHealthSummary(@Param('id') id: string) {
    const pet = await this.petsService.findOne(id);
    const age = this.petsService.calculateAge(pet.dateOfBirth);
    const lifeStage = this.petsService.getLifeStage(pet.dateOfBirth, pet.species);
    
    return {
      petId: id,
      name: pet.name,
      age,
      lifeStage,
      breedHealthIssues: pet.breed?.commonHealthIssues || [],
      insurancePolicy: pet.insurancePolicy,
    };
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updatePetDto: UpdatePetDto,
  ): Promise<Pet> {
    return this.petsService.update(id, updatePetDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string): Promise<void> {
    return this.petsService.remove(id);
  }
}
