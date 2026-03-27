import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ApiKeyService } from '../services/api-key.service';
import { CreateApiKeyDto, UpdateApiKeyDto } from '../dto/api-key.dto';

interface AuthenticatedRequest extends ExpressRequest {
  user?: { id: string };
}

@Controller('api-keys')
@UseGuards(JwtAuthGuard)
export class ApiKeyController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  @Post()
  async create(
    @Body() dto: CreateApiKeyDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { apiKey, plaintext } = await this.apiKeyService.create(
      dto,
      req.user?.id,
    );
    // Return plaintext only on creation — never stored in plain form
    return {
      id: apiKey.id,
      name: apiKey.name,
      scopes: apiKey.scopes,
      expiresAt: apiKey.expiresAt,
      createdAt: apiKey.createdAt,
      key: plaintext, // shown once
    };
  }

  @Get()
  findAll(@Request() req: AuthenticatedRequest) {
    return this.apiKeyService.findAll(req.user?.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.apiKeyService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateApiKeyDto) {
    return this.apiKeyService.update(id, dto);
  }

  @Patch(':id/revoke')
  @HttpCode(HttpStatus.NO_CONTENT)
  revoke(@Param('id') id: string) {
    return this.apiKeyService.revoke(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@Param('id') id: string) {
    return this.apiKeyService.delete(id);
  }
}
