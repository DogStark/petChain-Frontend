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
} from '@nestjs/common';
import { MedicationService } from './services/medication.service';
import { CreateMedicationDto } from './dto/create-medication.dto';
import { UpdateMedicationDto } from './dto/update-medication.dto';
import { MedicationType } from './entities/medication.entity';

@Controller('medications')
export class MedicationsController {
  constructor(private readonly medicationService: MedicationService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createMedicationDto: CreateMedicationDto) {
    return this.medicationService.create(createMedicationDto);
  }

  @Get()
  findAll(@Query('isActive') isActive?: boolean) {
    return this.medicationService.findAll(isActive);
  }

  @Get('search')
  search(@Query('query') query: string) {
    return this.medicationService.search(query);
  }

  @Get('type/:type')
  findByType(@Param('type') type: MedicationType) {
    return this.medicationService.findByType(type);
  }

  @Get('types')
  getAllTypes() {
    return this.medicationService.getAllMedicationTypes();
  }

  @Get('count')
  count(@Query('isActive') isActive?: boolean) {
    return this.medicationService.count(isActive);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.medicationService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateMedicationDto: UpdateMedicationDto,
  ) {
    return this.medicationService.update(id, updateMedicationDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.medicationService.remove(id);
  }

  @Patch(':id/deactivate')
  deactivate(@Param('id') id: string) {
    return this.medicationService.deactivate(id);
  }

  @Patch(':id/activate')
  activate(@Param('id') id: string) {
    return this.medicationService.activate(id);
  }
}
