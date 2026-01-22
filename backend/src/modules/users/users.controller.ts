import {
  Controller,
  Get,
  Query,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
  Header,
  StreamableFile,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { SearchUsersDto } from './dto/search-users.dto';
import { User } from './entities/user.entity';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

   /**
   * Create a new user
   * POST /users
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createUserDto: CreateUserDto): Promise<User> {
    return await this.usersService.create(createUserDto);
  }

  /**
   * Get all users
   * GET /users
   */
  @Get()
  async findAll(): Promise<User[]> {
    return await this.usersService.findAll();
  }

  /**
   * Search users with filters, sorting, and pagination
   * GET /users/search?q=john&role=admin&status=active&sort=createdAt_desc
   * ⚠️ MUST come before @Get(':id')
   */
  @Get('search')
  async searchUsers(@Query() query: SearchUsersDto) {
    return await this.usersService.searchUsers(query);
  }

  /**
   * Export search results to CSV
   * GET /users/export?q=john&role=admin
   * ⚠️ MUST come before @Get(':id')
   */
  @Get('export')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="users-export.csv"')
  async exportUsers(@Query() query: SearchUsersDto): Promise<StreamableFile> {
    const csv = await this.usersService.exportUsers(query);
    const buffer = Buffer.from(csv, 'utf-8');
    return new StreamableFile(buffer);
  }

  /**
   * Get a single user by ID
   * GET /users/:id
   * ⚠️ MUST come after specific routes like /search and /export
   */
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<User> {
    return await this.usersService.findOne(id);
  }

  /**
   * Update a user
   * PATCH /users/:id
   */
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<User> {
    return await this.usersService.update(id, updateUserDto);
  }

  /**
   * Delete a user
   * DELETE /users/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    return await this.usersService.remove(id);
  }
}

