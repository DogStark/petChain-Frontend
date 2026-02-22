import axios, { AxiosInstance } from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

export type OnboardingStepId = 'welcome' | 'profile_setup' | 'add_pet' | 'notifications' | 'explore';

export interface OnboardingStep {
  id: OnboardingStepId;
  title: string;
  completed: boolean;
  skipped: boolean;
  completedAt?: string;
}

export interface OnboardingStatus {
  userId: string;
  isCompleted: boolean;
  isSkipped: boolean;
  currentStep: OnboardingStepId;
  completedSteps: OnboardingStepId[];
  skippedSteps: OnboardingStepId[];
  progressPercent: number;
  steps: OnboardingStep[];
  startedAt: string;
  completedAt?: string;
}

export interface OnboardingAnalytics {
  totalStarted: number;
  totalCompleted: number;
  totalSkipped: number;
  completionRate: number;
  averageTimeToCompleteMs: number;
  stepDropoffRates: Partial<Record<OnboardingStepId, number>>;
  mostSkippedStep?: OnboardingStepId;
}

export interface UpdateUserProfileDto {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  avatarUrl?: string;
  dateOfBirth?: string;
  address?: string;
  city?: string;
  country?: string;
}

export interface UpdateUserPreferencesDto {
  emailNotifications?: boolean;
  smsNotifications?: boolean;
  pushNotifications?: boolean;
  dataShareConsent?: boolean;
  profilePublic?: boolean;
  preferredLanguage?: string;
  timezone?: string;
  marketingEmails?: boolean;
  activityEmails?: boolean;
  privacySettings?: {
    showEmail?: boolean;
    showPhone?: boolean;
    showActivity?: boolean;
  };
}

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  avatarUrl?: string;
  dateOfBirth?: string;
  address?: string;
  city?: string;
  country?: string;
  createdAt: string;
  updatedAt: string;
  profileCompletion?: {
    completionScore: number;
    isComplete: boolean;
    missingFields: string[];
  };
}

export interface UserSession {
  id: string;
  userId: string;
  deviceId: string;
  deviceName?: string;
  ipAddress: string;
  userAgent: string;
  expiresAt: string;
  lastActivityAt?: string;
  isActive: boolean;
  createdAt: string;
}

export interface ActivityLog {
  id: string;
  userId: string;
  activityType: string;
  description?: string;
  ipAddress?: string;
  userAgent?: string;
  deviceId?: string;
  metadata?: Record<string, any>;
  isSuspicious: boolean;
  createdAt: string;
}

class UserManagementAPI {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: `${API_BASE_URL}/users`,
      withCredentials: true,
    });

    // Add token to requests
    this.api.interceptors.request.use((config) => {
      const token = localStorage.getItem('authToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
  }

  // Profile endpoints
  async getCurrentProfile(): Promise<UserProfile> {
    const response = await this.api.get('/me/profile');
    return response.data;
  }

  async getUserProfile(userId: string): Promise<UserProfile> {
    const response = await this.api.get(`/${userId}/profile`);
    return response.data;
  }

  async updateProfile(
    data: UpdateUserProfileDto,
  ): Promise<UserProfile> {
    const response = await this.api.patch('/me/profile', data);
    return response.data;
  }

  async updateAvatar(avatarUrl: string): Promise<UserProfile> {
    const response = await this.api.patch('/me/avatar', { avatarUrl });
    return response.data;
  }

  async uploadAvatar(file: File): Promise<{ avatarUrl: string; user: UserProfile }> {
    const formData = new FormData();
    formData.append('file', file);

    // hit new users/avatar route
    const uploadsApi = axios.create({
      baseURL: `${API_BASE_URL}/users`,
      withCredentials: true,
    });

    const token = localStorage.getItem('authToken');
    if (token) {
      uploadsApi.defaults.headers.common.Authorization = `Bearer ${token}`;
    }

    const response = await uploadsApi.post('/avatar', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  async getProfileCompletion(): Promise<{
    completionScore: number;
    isComplete: boolean;
    missingFields: string[];
  }> {
    const response = await this.api.get('/me/profile-completion');
    return response.data;
  }

  // Preferences endpoints
  async getPreferences() {
    const response = await this.api.get('/me/preferences');
    return response.data;
  }

  async updatePreferences(
    data: UpdateUserPreferencesDto,
  ) {
    const response = await this.api.patch('/me/preferences', data);
    return response.data;
  }

  async getNotificationPreferences() {
    const response = await this.api.get('/me/preferences/notifications');
    return response.data;
  }

  async updateNotificationPreferences(settings: {
    emailNotifications?: boolean;
    smsNotifications?: boolean;
    pushNotifications?: boolean;
  }) {
    const response = await this.api.patch(
      '/me/preferences/notifications',
      settings,
    );
    return response.data;
  }

  async getPrivacySettings() {
    const response = await this.api.get('/me/preferences/privacy');
    return response.data;
  }

  async updatePrivacySettings(settings: {
    showEmail?: boolean;
    showPhone?: boolean;
    showActivity?: boolean;
  }) {
    const response = await this.api.patch(
      '/me/preferences/privacy',
      settings,
    );
    return response.data;
  }

  // Session endpoints
  async getActiveSessions(): Promise<UserSession[]> {
    const response = await this.api.get('/me/sessions');
    return response.data;
  }

  async getAllSessions(): Promise<UserSession[]> {
    const response = await this.api.get('/me/sessions/all');
    return response.data;
  }

  async revokeSession(sessionId: string): Promise<void> {
    await this.api.delete(`/me/sessions/${sessionId}`);
  }

  async revokeOtherSessions(currentSessionId: string): Promise<void> {
    await this.api.post('/me/sessions/revoke-others', {
      currentSessionId,
    });
  }

  // Activity endpoints
  async getActivity(limit: number = 50, offset: number = 0): Promise<ActivityLog[]> {
    const response = await this.api.get('/me/activity', {
      params: { limit, offset },
    });
    return response.data;
  }

  async getActivitySummary(): Promise<{
    totalLogins: number;
    lastActivity: string;
    suspiciousActivities: number;
  }> {
    const response = await this.api.get('/me/activity/summary');
    return response.data;
  }

  async getSuspiciousActivities(): Promise<ActivityLog[]> {
    const response = await this.api.get('/me/activity/suspicious');
    return response.data;
  }

  // Account endpoints
  async deactivateAccount(): Promise<void> {
    await this.api.post('/me/deactivate');
  }

  async reactivateAccount(): Promise<void> {
    await this.api.post('/me/reactivate');
  }

  async deleteAccount(): Promise<void> {
    await this.api.delete('/me');
  }

  async exportData(): Promise<any> {
    const response = await this.api.get('/me/export');
    return response.data;
  }

  // Onboarding endpoints
  async getOnboardingStatus(): Promise<OnboardingStatus> {
    const response = await this.api.get('/me/onboarding');
    return response.data;
  }

  async completeOnboardingStep(stepId: OnboardingStepId): Promise<OnboardingStatus> {
    const response = await this.api.post(`/me/onboarding/steps/${stepId}/complete`);
    return response.data;
  }

  async skipOnboarding(): Promise<void> {
    await this.api.post('/me/onboarding/skip');
  }

  async getOnboardingAnalytics(): Promise<OnboardingAnalytics> {
    const response = await this.api.get('/me/onboarding/analytics');
    return response.data;
  }
}

export const userAPI = new UserManagementAPI();
