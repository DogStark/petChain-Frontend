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
import { AssignRoleDto, RemoveRoleDto } from '../dto/roles.dto';
import { CurrentUser } from '../decorators/current-user.decorator';
import { User } from '../../modules/users/entities/user.entity';

/**
 * Controller for administrators to manage user roles within the PBAC/RBAC system.
 */
@Controller('roles')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @Roles(RoleName.Admin)
  @HttpCode(HttpStatus.OK)
  async getAllRoles() {
    return this.rolesService.getAllRoles();
  }

  @Post('assign')
  @Roles(RoleName.Admin)
  @HttpCode(HttpStatus.CREATED)
  async assignRole(
    @Body() assignRoleDto: AssignRoleDto,
    @CurrentUser() admin: User,
  ) {
    return this.rolesService.assignRole(
      assignRoleDto.userId,
      assignRoleDto.roleId,
      admin.id,
      assignRoleDto.reason,
    );
  }

  @Delete('remove')
  @Roles(RoleName.Admin)
  @HttpCode(HttpStatus.OK)
  async removeRole(
    @Body() removeRoleDto: RemoveRoleDto,
    @CurrentUser() admin: User,
  ) {
    await this.rolesService.removeRole(
      removeRoleDto.userId,
      removeRoleDto.roleId,
      admin.id,
      removeRoleDto.reason,
    );
    return { message: 'Role successfully removed' };
  }

  @Get('user/:userId')
  @Roles(RoleName.Admin)
  @HttpCode(HttpStatus.OK)
  async getUserRoles(@Param('userId') userId: string) {
    return this.rolesService.getUserRoles(userId);
  }
}
