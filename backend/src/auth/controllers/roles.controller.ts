import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Param,
} from '@nestjs/common';

import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';

import { RolesService } from '../services/roles.service';
import { AssignRoleDto, RemoveRoleDto } from '../dto/role.dto';

import { RoleName } from '../constants/roles.enum';
import { User } from '../../modules/users/entities/user.entity';

@Controller('roles')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  /*
   |--------------------------------------------------------------------------
   | ASSIGN ROLE (ADMIN ONLY)
   |--------------------------------------------------------------------------
   */
  @Post('assign')
  @Roles(RoleName.Admin)
  async assignRole(
    @Body() dto: AssignRoleDto,
    @CurrentUser() admin: User,
  ) {
    return this.rolesService.assignRole(dto, admin.id);
  }

  /*
   |--------------------------------------------------------------------------
   | REMOVE ROLE (ADMIN ONLY)
   |--------------------------------------------------------------------------
   */
  @Post('remove')
  @Roles(RoleName.Admin)
  async removeRole(
    @Body() dto: RemoveRoleDto,
    @CurrentUser() admin: User,
  ) {
    return this.rolesService.removeRole(dto, admin.id);
  }

  /*
   |--------------------------------------------------------------------------
   | VIEW USER ROLES (ADMIN ONLY)
   |--------------------------------------------------------------------------
   */
  @Get('user/:userId')
  @Roles(RoleName.Admin)
  async getUserRoles(@Param('userId') userId: string) {
    return this.rolesService.getUserRoles(userId);
  }
}