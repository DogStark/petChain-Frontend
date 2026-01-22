import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { VaccinationsService } from './vaccinations.service';
import { CreateVaccinationDto } from './dto/create-vaccination.dto';
import { UpdateVaccinationDto } from './dto/update-vaccination.dto';

@Controller('vaccinations')
export class VaccinationsController {
  constructor(private readonly vaccinationsService: VaccinationsService) {}

  @Post()
  create(@Body() createVaccinationDto: CreateVaccinationDto) {
    return this.vaccinationsService.create(createVaccinationDto);
  }

  @Get()
  findAll(@Query('petId') petId?: string) {
    return this.vaccinationsService.findAll(petId);
  }

  @Get('reminders')
  getReminders(@Query('days') days?: number) {
    return this.vaccinationsService.getUpcomingReminders(days ? +days : 30);
  }

  @Get('overdue')
  getOverdue(@Query('petId') petId?: string) {
    return this.vaccinationsService.getOverdueVaccinations(petId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.vaccinationsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateVaccinationDto: UpdateVaccinationDto,
  ) {
    return this.vaccinationsService.update(id, updateVaccinationDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.vaccinationsService.remove(id);
  }
}
