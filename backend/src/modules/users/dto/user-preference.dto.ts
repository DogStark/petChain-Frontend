export class UserPreferenceDto {
  id: string;
  userId: string;
  emailNotifications: boolean;
  smsNotifications: boolean;
  pushNotifications: boolean;
  dataShareConsent: boolean;
  profilePublic: boolean;
  preferredLanguage?: string;
  timezone?: string;
  marketingEmails: boolean;
  activityEmails: boolean;
  privacySettings?: {
    showEmail?: boolean;
    showPhone?: boolean;
    showActivity?: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}
