import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { VetsService } from './vets.service';
import { CreateVetDto } from './dto/create-vet.dto';
import { UpdateVetDto } from './dto/update-vet.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RoleName } from '../../auth/constants/roles.enum';

@Controller('vets')
export class VetsController {
  constructor(private readonly vetsService: VetsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.Admin, RoleName.VetStaff)
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.Admin, RoleName.VetStaff)
  update(@Param('id') id: string, @Body() updateVetDto: UpdateVetDto) {
    return this.vetsService.update(id, updateVetDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.Admin)
  remove(@Param('id') id: string) {
    return this.vetsService.remove(id);
  }
}
