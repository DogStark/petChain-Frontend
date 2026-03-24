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
import { ConditionsService } from './conditions.service';
import { CreateConditionDto } from './dto/create-condition.dto';
import { UpdateConditionDto } from './dto/update-condition.dto';

@Controller('conditions')
export class ConditionsController {
  constructor(private readonly conditionsService: ConditionsService) {}

  @Post()
  create(@Body() createConditionDto: CreateConditionDto) {
    return this.conditionsService.create(createConditionDto);
  }

  @Get()
  findAll(@Query('petId') petId?: string) {
    return this.conditionsService.findAll(petId);
  }

  @Get('pet/:petId')
  findByPet(@Param('petId') petId: string) {
    return this.conditionsService.findByPet(petId);
  }

  @Get('pet/:petId/chronic')
  findChronicConditions(@Param('petId') petId: string) {
    return this.conditionsService.findChronicConditions(petId);
  }

  @Get('pet/:petId/active')
  findActiveConditions(@Param('petId') petId: string) {
    return this.conditionsService.findActiveConditions(petId);
  }

  @Get('pet/:petId/summary')
  getConditionSummary(@Param('petId') petId: string) {
    return this.conditionsService.getConditionSummary(petId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.conditionsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateConditionDto: UpdateConditionDto,
  ) {
    return this.conditionsService.update(id, updateConditionDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.conditionsService.remove(id);
  }
}
