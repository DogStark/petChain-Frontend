import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Put,
  Delete,
  HttpCode,
  HttpStatus,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PetsService } from './pets.service';
import { LostPetsService } from '../lost-pets/lost-pets.service';
import { CreatePetDto } from './dto/create-pet.dto';
import { UpdatePetDto } from './dto/update-pet.dto';
import { Pet } from './entities/pet.entity';
import { ReportLostPetDto } from '../lost-pets/dto/report-lost-pet.dto';
import { ReportFoundPetDto } from '../lost-pets/dto/report-found-pet.dto';
import { UpdateLostMessageDto } from '../lost-pets/dto/update-lost-message.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@Controller('pets')
export class PetsController {
  constructor(
    private readonly petsService: PetsService,
    private readonly lostPetsService: LostPetsService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createPetDto: CreatePetDto): Promise<Pet> {
    return this.petsService.create(createPetDto);
  }

  @Get()
  findAll(@Query('ownerId') ownerId?: string): Promise<Pet[]> {
    return this.petsService.findAll(ownerId);
  }

  @Post(':petId/report-lost')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  reportLost(
    @Param('petId') petId: string,
    @Body() dto: ReportLostPetDto,
    @CurrentUser() user: User,
  ) {
    return this.lostPetsService.reportLost(petId, user.id, dto);
  }

  @Post(':petId/report-found')
  @UseGuards(JwtAuthGuard)
  reportFound(
    @Param('petId') petId: string,
    @Body() dto: ReportFoundPetDto,
    @CurrentUser() user: User,
  ) {
    return this.lostPetsService.reportFound(petId, user.id, dto);
  }

  @Put(':petId/lost-message')
  @UseGuards(JwtAuthGuard)
  updateLostMessage(
    @Param('petId') petId: string,
    @Body() dto: UpdateLostMessageDto,
    @CurrentUser() user: User,
  ) {
    return this.lostPetsService.updateLostMessage(petId, user.id, dto);
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
