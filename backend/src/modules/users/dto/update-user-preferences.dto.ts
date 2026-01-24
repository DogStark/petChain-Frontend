import { IsOptional, IsBoolean, IsString } from 'class-validator';

export class UpdateUserPreferencesDto {
  @IsOptional()
  @IsBoolean()
  emailNotifications?: boolean;

  @IsOptional()
  @IsBoolean()
  smsNotifications?: boolean;

  @IsOptional()
  @IsBoolean()
  pushNotifications?: boolean;

  @IsOptional()
  @IsBoolean()
  dataShareConsent?: boolean;

  @IsOptional()
  @IsBoolean()
  profilePublic?: boolean;

  @IsOptional()
  @IsString()
  preferredLanguage?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsBoolean()
  marketingEmails?: boolean;

  @IsOptional()
  @IsBoolean()
  activityEmails?: boolean;

  @IsOptional()
  privacySettings?: {
    showEmail?: boolean;
    showPhone?: boolean;
    showActivity?: boolean;
  };
}
