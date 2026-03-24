import { IsString, IsNotEmpty, IsUUID, IsOptional } from 'class-validator';

export class AssignRoleDto {
  @IsUUID()
  @IsNotEmpty()
  userId: string;

  @IsUUID()
  @IsNotEmpty()
  roleId: string;

  @IsString()
  @IsOptional()
  reason?: string;
}

export class RemoveRoleDto {
  @IsUUID()
  @IsNotEmpty()
  userId: string;

  @IsUUID()
  @IsNotEmpty()
  roleId: string;

  @IsString()
  @IsOptional()
  reason?: string;
}
