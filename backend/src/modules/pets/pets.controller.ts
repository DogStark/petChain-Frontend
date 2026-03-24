import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PetsService } from './pets.service';
import { LostPetsService } from '../lost-pets/lost-pets.service';
import { CreatePetDto } from './dto/create-pet.dto';
import { UpdatePetDto } from './dto/update-pet.dto';
import { QueryPetsDto } from './dto/query-pets.dto';
import { SharePetDto } from './dto/share-pet.dto';
import { TransferPetOwnershipDto } from './dto/transfer-pet-ownership.dto';
import { ReportLostPetDto } from '../lost-pets/dto/report-lost-pet.dto';
import { ReportFoundPetDto } from '../lost-pets/dto/report-found-pet.dto';
import { UpdateLostMessageDto } from '../lost-pets/dto/update-lost-message.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@Controller('pets')
@UseGuards(JwtAuthGuard)
export class PetsController {
  constructor(
    private readonly petsService: PetsService,
    private readonly lostPetsService: LostPetsService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreatePetDto, @CurrentUser() user: User) {
    return this.petsService.create(user.id, dto);
  }

  @Get()
  findMyPets(@CurrentUser() user: User, @Query() query: QueryPetsDto) {
    return this.petsService.findAllForOwner(user.id, query);
  }

  @Get('shared/me')
  findSharedWithMe(@CurrentUser() user: User, @Query() query: QueryPetsDto) {
    return this.petsService.findSharedWithUser(user.id, query);
  }

  @Post(':id/share')
  @HttpCode(HttpStatus.CREATED)
  sharePet(
    @Param('id') id: string,
    @Body() dto: SharePetDto,
    @CurrentUser() user: User,
  ) {
    return this.petsService.sharePetWithFamily(id, user.id, dto);
  }

  @Get(':id/shares')
  listPetShares(@Param('id') id: string, @CurrentUser() user: User) {
    return this.petsService.listPetShares(id, user.id);
  }

  @Delete(':id/share/:sharedWithUserId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unsharePet(
    @Param('id') id: string,
    @Param('sharedWithUserId') sharedWithUserId: string,
    @CurrentUser() user: User,
  ): Promise<void> {
    await this.petsService.unsharePetWithFamily(id, user.id, sharedWithUserId);
  }

  @Put(':id/transfer-ownership')
  transferOwnership(
    @Param('id') id: string,
    @Body() dto: TransferPetOwnershipDto,
    @CurrentUser() user: User,
  ) {
    return this.petsService.transferOwnership(id, user.id, dto.newOwnerId);
  }

  @Post(':id/restore')
  restorePet(@Param('id') id: string, @CurrentUser() user: User) {
    return this.petsService.restoreForUser(id, user.id);
  }

  @Post(':petId/report-lost')
  @HttpCode(HttpStatus.CREATED)
  reportLost(
    @Param('petId') petId: string,
    @Body() dto: ReportLostPetDto,
    @CurrentUser() user: User,
  ) {
    return this.lostPetsService.reportLost(petId, user.id, dto);
  }

  @Post(':petId/report-found')
  reportFound(
    @Param('petId') petId: string,
    @Body() dto: ReportFoundPetDto,
    @CurrentUser() user: User,
  ) {
    return this.lostPetsService.reportFound(petId, user.id, dto);
  }

  @Put(':petId/lost-message')
  updateLostMessage(
    @Param('petId') petId: string,
    @Body() dto: UpdateLostMessageDto,
    @CurrentUser() user: User,
  ) {
    return this.lostPetsService.updateLostMessage(petId, user.id, dto);
  }

  @Get(':id/health-summary')
  async getHealthSummary(@Param('id') id: string, @CurrentUser() user: User) {
    const pet = await this.petsService.findOneForUser(id, user.id);
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

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: User) {
    return this.petsService.findOneForUser(id, user.id);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() updatePetDto: UpdatePetDto,
    @CurrentUser() user: User,
  ) {
    return this.petsService.updateForUser(id, user.id, updatePetDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string, @CurrentUser() user: User): Promise<void> {
    await this.petsService.softDeleteForUser(id, user.id);
  }
}
