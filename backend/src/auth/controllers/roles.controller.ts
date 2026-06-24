import {
  Controller,
  Post,
  Delete,
  Get,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Param,
} from '@nestjs/common';
import { RolesService } from '../services/roles.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { RoleName } from '../constants/roles.enum';
import { AssignRoleDto, RemoveRoleDto } from '../dto/role.dto';
import { CurrentUser } from '../decorators/current-user.decorator';
import { User } from '../../modules/users/entities/user.entity';

/**
 * Controller for administrators to manage user roles within the system.
 */
@Controller('roles')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Post('assign')
  @Roles(RoleName.Admin)
  @HttpCode(HttpStatus.CREATED)
  async assignRole(@Body() dto: AssignRoleDto, @CurrentUser() admin: User) {
    return this.rolesService.assignRole(dto, admin.id);
  }

  @Post('remove')
  @Roles(RoleName.Admin)
  @HttpCode(HttpStatus.OK)
  async removeRole(@Body() dto: RemoveRoleDto, @CurrentUser() admin: User) {
    return this.rolesService.removeRole(dto, admin.id);
  }

  @Get('user/:userId')
  @Roles(RoleName.Admin)
  @HttpCode(HttpStatus.OK)
  async getUserRoles(@Param('userId') userId: string) {
    return this.rolesService.getUserRoles(userId);
  }
}
