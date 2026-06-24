import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class GoogleOAuthDto {
  @IsString()
  @IsNotEmpty()
  providerId: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsString()
  @IsOptional()
  avatarUrl?: string;

  @IsString()
  @IsOptional()
  accessToken?: string;

  @IsString()
  @IsOptional()
  refreshToken?: string;
}

export class AppleOAuthDto {
  @IsString()
  @IsNotEmpty()
  providerId: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsString()
  @IsNotEmpty()
  idToken: string;
}

export class OAuthCallbackDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsOptional()
  state?: string;
}
