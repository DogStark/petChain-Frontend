import { IsPhoneNumber, IsString, Length } from 'class-validator';

export class SendPhoneOtpDto {
  @IsPhoneNumber()
  phone: string;
}

export class VerifyPhoneOtpDto {
  @IsString()
  @Length(6, 6)
  otp: string;
}
