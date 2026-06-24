import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { IsStrongPassword } from '../utils/password.util';

export class PasswordResetRequestDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;
}

export class PasswordResetConfirmDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsString()
  @IsNotEmpty()
  @IsStrongPassword()
  newPassword: string;
}
