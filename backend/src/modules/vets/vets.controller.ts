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
import { VetsService } from './vets.service';
import { CreateVetDto } from './dto/create-vet.dto';
import { UpdateVetDto } from './dto/update-vet.dto';
import { Vet } from './entities/vet.entity';

@Controller('vets')
export class VetsController {
  constructor(private readonly vetsService: VetsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createVetDto: CreateVetDto): Promise<Vet> {
    return await this.vetsService.create(createVetDto);
  }

  @Get()
  async findAll(@Query('specialty') specialty?: string): Promise<Vet[]> {
    if (specialty) {
      return await this.vetsService.findBySpecialty(specialty);
    }
    return await this.vetsService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Vet> {
    return await this.vetsService.findOne(id);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateVetDto: UpdateVetDto,
  ): Promise<Vet> {
    return await this.vetsService.update(id, updateVetDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    return await this.vetsService.remove(id);
  }
}
