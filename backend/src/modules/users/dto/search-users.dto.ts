import {
  IsOptional,
  IsString,
  IsDateString,
  IsInt,
  Min,
  Max,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { RoleName } from '../../../auth/constants/roles.enum';

export class SearchUsersDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsIn(Object.values(RoleName))
  role?: string;

  @IsOptional()
  @IsIn(['active', 'inactive', 'deactivated', 'deleted', 'all'])
  status?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsIn([
    'createdAt_asc',
    'createdAt_desc',
    'name_asc',
    'name_desc',
    'firstName_asc',
    'firstName_desc',
    'lastName_asc',
    'lastName_desc',
    'email_asc',
    'email_desc',
    'lastActive_asc',
    'lastActive_desc',
  ])
  sort?: string;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
