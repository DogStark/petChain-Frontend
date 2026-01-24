import { IsOptional, IsString, IsBoolean, IsDateString, IsInt, Min, Max, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class SearchUsersDto {
  @IsOptional()
  @IsString()
  q?: string; // Full-text search across name, email, etc.

  @IsOptional()
  @IsString()
  role?: string; // Filter by role (admin, user, etc.)

  @IsOptional()
  @IsString()
  @IsIn(['active', 'inactive', 'all'])
  status?: string; // Activity status filter

  @IsOptional()
  @IsDateString()
  from?: string; // Registration date from

  @IsOptional()
  @IsDateString()
  to?: string; // Registration date to

  @IsOptional()
  @IsString()
  @IsIn([
    'createdAt_asc',
    'createdAt_desc',
    'name_asc',
    'name_desc',
    'email_asc',
    'email_desc',
    'lastActive_asc',
    'lastActive_desc',
  ])
  sort?: string; // Sort criteria

  @IsOptional()
  @IsString()
  cursor?: string; // Cursor for pagination

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100) // Prevent abuse
  limit?: number; // Results per page
}

