import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class RegisterDeviceTokenDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsString()
  @IsOptional()
  platform?: string;
}
