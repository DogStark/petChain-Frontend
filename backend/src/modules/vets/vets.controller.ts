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
import { VetsService } from './vets.service';
import { CreateVetDto } from './dto/create-vet.dto';
import { UpdateVetDto } from './dto/update-vet.dto';

@Controller('vets')
export class VetsController {
  constructor(private readonly vetsService: VetsService) {}

  @Post()
  create(@Body() createVetDto: CreateVetDto) {
    return this.vetsService.create(createVetDto);
  }

  @Get()
  findAll(@Query('search') search?: string) {
    return this.vetsService.findAll(search);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.vetsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateVetDto: UpdateVetDto) {
    return this.vetsService.update(id, updateVetDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.vetsService.remove(id);
  }
}
