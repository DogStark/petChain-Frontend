import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserPreference } from '../entities/user-preference.entity';
import { UpdateUserPreferencesDto } from '../dto/update-user-preferences.dto';

@Injectable()
export class UserPreferenceService {
  constructor(
    @InjectRepository(UserPreference)
    private readonly preferenceRepository: Repository<UserPreference>,
  ) {}

  /**
   * Create default preferences for a new user
   */
  async createDefaultPreferences(userId: string): Promise<UserPreference> {
    const preference = this.preferenceRepository.create({
      userId,
      emailNotifications: true,
      smsNotifications: false,
      smsEmergencyAlerts: true,
      smsReminderAlerts: false,
      pushNotifications: false,
      dataShareConsent: false,
      profilePublic: true,
      marketingEmails: false,
      activityEmails: true,
    });
    return await this.preferenceRepository.save(preference);
  }

  /**
   * Get user preferences
   */
  async getPreferences(userId: string): Promise<UserPreference> {
    const preference = await this.preferenceRepository.findOne({
      where: { userId },
    });
    if (!preference) {
      throw new NotFoundException(
        `Preferences not found for user ${userId}`,
      );
    }
    return preference;
  }

  /**
   * Update user preferences
   */
  async updatePreferences(
    userId: string,
    updateDto: UpdateUserPreferencesDto,
  ): Promise<UserPreference> {
    const preference = await this.getPreferences(userId);
    Object.assign(preference, updateDto);
    return await this.preferenceRepository.save(preference);
  }

  /**
   * Update notification settings
   */
  async updateNotificationSettings(
    userId: string,
    settings: {
      emailNotifications?: boolean;
      smsNotifications?: boolean;
      smsEmergencyAlerts?: boolean;
      smsReminderAlerts?: boolean;
      pushNotifications?: boolean;
    },
  ): Promise<UserPreference> {
    const preference = await this.getPreferences(userId);
    Object.assign(preference, settings);
    return await this.preferenceRepository.save(preference);
  }

  /**
   * Update privacy settings
   */
  async updatePrivacySettings(
    userId: string,
    settings: {
      showEmail?: boolean;
      showPhone?: boolean;
      showActivity?: boolean;
    },
  ): Promise<UserPreference> {
    const preference = await this.getPreferences(userId);
    preference.privacySettings = {
      ...preference.privacySettings,
      ...settings,
    };
    return await this.preferenceRepository.save(preference);
  }

  /**
   * Get notification preferences
   */
  async getNotificationPreferences(userId: string) {
    const preference = await this.getPreferences(userId);
    return {
      emailNotifications: preference.emailNotifications,
      smsNotifications: preference.smsNotifications,
      smsEmergencyAlerts: preference.smsEmergencyAlerts,
      smsReminderAlerts: preference.smsReminderAlerts,
      pushNotifications: preference.pushNotifications,
      marketingEmails: preference.marketingEmails,
      activityEmails: preference.activityEmails,
    };
  }

  /**
   * Get privacy settings
   */
  async getPrivacySettings(userId: string) {
    const preference = await this.getPreferences(userId);
    return preference.privacySettings || {};
  }
}
