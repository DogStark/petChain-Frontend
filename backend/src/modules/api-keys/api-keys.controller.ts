import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiKeysService } from './api-keys.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RoleName } from '../../auth/constants/roles.enum';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

class CreateApiKeyDto {
  @IsString()
  @IsNotEmpty()
  label: string;

  @IsOptional()
  @Type(() => Date)
  expiresAt?: Date | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  rateLimitWindowSec?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  rateLimitMax?: number;
}

@Controller('api-keys')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Get()
  @Roles(RoleName.Veterinarian, RoleName.Admin)
  async list(@CurrentUser() user: User) {
    return this.apiKeysService.listMyKeys(user.id);
  }

  @Post()
  @Roles(RoleName.Veterinarian, RoleName.Admin)
  @HttpCode(HttpStatus.CREATED)
  async create(@CurrentUser() user: User, @Body() dto: CreateApiKeyDto) {
    const { apiKey, plaintextKey } = await this.apiKeysService.createKey({
      userId: user.id,
      label: dto.label,
      expiresAt: dto.expiresAt ?? null,
      rateLimitMax: dto.rateLimitMax,
      rateLimitWindowSec: dto.rateLimitWindowSec,
    });
    return {
      id: apiKey.id,
      label: apiKey.label,
      prefix: apiKey.prefix,
      lastFour: apiKey.lastFour,
      expiresAt: apiKey.expiresAt,
      rateLimitMax: apiKey.rateLimitMax,
      rateLimitWindowSec: apiKey.rateLimitWindowSec,
      usageCount: apiKey.usageCount,
      lastUsedAt: apiKey.lastUsedAt,
      createdAt: apiKey.createdAt,
      plaintextKey,
    };
  }

  @Post(':id/revoke')
  @Roles(RoleName.Veterinarian, RoleName.Admin)
  @HttpCode(HttpStatus.NO_CONTENT)
  async revoke(@Param('id') id: string, @CurrentUser() user: User) {
    try {
      await this.apiKeysService.revokeKey(id, user.id);
      return;
    } catch {
      await this.apiKeysService.adminRevokeKey(id, user.id);
      return;
    }
  }
}
