import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { LostPetsService } from './lost-pets.service';
import { NearbyQueryDto } from './dto/nearby-query.dto';
import { UpdateUserLocationDto } from './dto/update-user-location.dto';
import { CreateSightingDto } from './dto/create-sighting.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@Controller('lost-pets')
export class LostPetsController {
  constructor(private readonly lostPetsService: LostPetsService) {}

  /**
   * GET /lost-pets - Get all lost pets (public)
   */
  @Get()
  findAll() {
    return this.lostPetsService.findAllLost();
  }

  /**
   * GET /lost-pets/nearby - Get lost pets near a location
   */
  @Get('nearby')
  findNearby(@Query() query: NearbyQueryDto) {
    return this.lostPetsService.findNearby(
      query.latitude,
      query.longitude,
      query.radiusKm,
    );
  }

  /**
   * PUT /lost-pets/my-location - Update user location for receiving lost pet alerts
   */
  @Put('my-location')
  @UseGuards(JwtAuthGuard)
  updateMyLocation(
    @Body() dto: UpdateUserLocationDto,
    @CurrentUser() user: User,
  ) {
    return this.lostPetsService.updateUserLocation(user.id, dto);
  }

  /**
   * POST /lost-pets/:id/sightings - Report a sighting for a lost pet
   */
  @Post(':id/sightings')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard)
  reportSighting(
    @Param('id') reportId: string,
    @Body() dto: CreateSightingDto,
    @CurrentUser() user: User,
  ) {
    return this.lostPetsService.createSighting(reportId, user.id, dto);
  }
}
