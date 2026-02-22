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
import { AllergiesService } from './allergies.service';
import { CreateAllergyDto } from './dto/create-allergy.dto';
import { UpdateAllergyDto } from './dto/update-allergy.dto';

@Controller('allergies')
export class AllergiesController {
  constructor(private readonly allergiesService: AllergiesService) {}

  @Post()
  create(@Body() createAllergyDto: CreateAllergyDto) {
    return this.allergiesService.create(createAllergyDto);
  }

  @Get()
  findAll(@Query('petId') petId?: string) {
    return this.allergiesService.findAll(petId);
  }

  @Get('pet/:petId')
  findByPet(@Param('petId') petId: string) {
    return this.allergiesService.findByPet(petId);
  }

  @Get('pet/:petId/vet-alerts')
  findAllergiesWithVetAlert(@Param('petId') petId: string) {
    return this.allergiesService.findAllergiesWithVetAlert(petId);
  }

  @Get('pet/:petId/severe')
  findSevereAllergies(@Param('petId') petId: string) {
    return this.allergiesService.findSevereAllergies(petId);
  }

  @Get('pet/:petId/summary')
  getAllergySummary(@Param('petId') petId: string) {
    return this.allergiesService.getAllergySummary(petId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.allergiesService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateAllergyDto: UpdateAllergyDto) {
    return this.allergiesService.update(id, updateAllergyDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.allergiesService.remove(id);
  }
}
