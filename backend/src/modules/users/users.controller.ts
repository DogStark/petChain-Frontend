import {
  Controller,
  Get,
  Query,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
  Header,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { UserPreferenceService } from './services/user-preference.service';
import { UserSessionService } from './services/user-session.service';
import { UserActivityLogService } from './services/user-activity-log.service';
import { UserSearchService } from './services/user-search.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { SearchUsersDto } from './dto/search-users.dto';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';
import { UpdateUserPreferencesDto } from './dto/update-user-preferences.dto';
import { User } from './entities/user.entity';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RoleName } from '../../auth/constants/roles.enum';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly preferenceService: UserPreferenceService,
    private readonly sessionService: UserSessionService,
    private readonly activityLogService: UserActivityLogService,
    private readonly searchService: UserSearchService,
  ) {}

  /**
   * Create a new user
   * POST /users
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createUserDto: CreateUserDto): Promise<User> {
    const user = await this.usersService.create(createUserDto);
    // Create default preferences for new user
    await this.preferenceService.createDefaultPreferences(user.id);
    return user;
  }

  /**
   * Get all users
   * GET /users
   */
  @Get()
  async findAll(): Promise<User[]> {
    return await this.usersService.findAll();
  }

  /**
   * Search users with filters, sorting, and pagination (admin only)
   * GET /users/search?q=john&role=Admin&status=active&sort=createdAt_desc
   * ⚠️ MUST come before @Get(':id')
   */
  @Get('search')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.Admin)
  async searchUsers(@Query() query: SearchUsersDto) {
    return await this.searchService.searchUsers(query);
  }

  /**
   * Export search results to CSV (admin only)
   * GET /users/export?q=john&role=Admin
   * ⚠️ MUST come before @Get(':id')
   */
  @Get('export')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.Admin)
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="users-export.csv"')
  async exportUsers(@Query() query: SearchUsersDto): Promise<StreamableFile> {
    const csv = await this.searchService.exportUsers(query);
    const buffer = Buffer.from(csv, 'utf-8');
    return new StreamableFile(buffer);
  }

  /**
   * Get current user profile
   * GET /users/me/profile
   */
  @Get('me/profile')
  @UseGuards(JwtAuthGuard)
  async getCurrentProfile(@CurrentUser() user: User) {
    const userProfile = await this.usersService.findOne(user.id);
    const completion = await this.usersService.getProfileCompletion(user.id);

    return {
      ...userProfile,
      profileCompletion: completion,
    };
  }

  /**
   * Get user profile by ID
   * GET /users/:id/profile
   */
  @Get(':id/profile')
  async getUserProfile(@Param('id') id: string) {
    return await this.usersService.getPublicProfile(id);
  }

  /**
   * Update current user profile
   * PATCH /users/me/profile
   */
  @Patch('me/profile')
  @UseGuards(JwtAuthGuard)
  async updateProfile(
    @CurrentUser() user: User,
    @Body() updateProfileDto: UpdateUserProfileDto,
  ): Promise<User> {
    const updated = await this.usersService.updateProfile(
      user.id,
      updateProfileDto,
    );

    // Log activity
    await this.activityLogService.logActivity({
      userId: user.id,
      activityType: 'PROFILE_UPDATE' as any,
      description: 'Profile updated',
    });

    return updated;
  }

  /**
   * Update user avatar
   * PATCH /users/me/avatar
   */
  @Patch('me/avatar')
  @UseGuards(JwtAuthGuard)
  async updateAvatar(
    @CurrentUser() user: User,
    @Body() body: { avatarUrl: string },
  ): Promise<User> {
    const updated = await this.usersService.updateAvatar(
      user.id,
      body.avatarUrl,
    );

    // Log activity
    await this.activityLogService.logActivity({
      userId: user.id,
      activityType: 'AVATAR_UPLOAD' as any,
      description: 'Avatar uploaded',
    });

    return updated;
  }

  /**
   * Get profile completion score
   * GET /users/me/profile-completion
   */
  @Get('me/profile-completion')
  @UseGuards(JwtAuthGuard)
  async getProfileCompletion(@CurrentUser() user: User) {
    return await this.usersService.getProfileCompletion(user.id);
  }

  /**
   * Get user preferences
   * GET /users/me/preferences
   */
  @Get('me/preferences')
  @UseGuards(JwtAuthGuard)
  async getPreferences(@CurrentUser() user: User) {
    return await this.preferenceService.getPreferences(user.id);
  }

  /**
   * Update user preferences
   * PATCH /users/me/preferences
   */
  @Patch('me/preferences')
  @UseGuards(JwtAuthGuard)
  async updatePreferences(
    @CurrentUser() user: User,
    @Body() updatePreferencesDto: UpdateUserPreferencesDto,
  ) {
    const updated = await this.preferenceService.updatePreferences(
      user.id,
      updatePreferencesDto,
    );

    // Log activity
    await this.activityLogService.logActivity({
      userId: user.id,
      activityType: 'SETTINGS_UPDATE' as any,
      description: 'Preferences updated',
    });

    return updated;
  }

  /**
   * Get notification preferences
   * GET /users/me/preferences/notifications
   */
  @Get('me/preferences/notifications')
  @UseGuards(JwtAuthGuard)
  async getNotificationPreferences(@CurrentUser() user: User) {
    return await this.preferenceService.getNotificationPreferences(user.id);
  }

  /**
   * Update notification preferences
   * PATCH /users/me/preferences/notifications
   */
  @Patch('me/preferences/notifications')
  @UseGuards(JwtAuthGuard)
  async updateNotificationPreferences(
    @CurrentUser() user: User,
    @Body() settings: any,
  ) {
    return await this.preferenceService.updateNotificationSettings(
      user.id,
      settings,
    );
  }

  /**
   * Get privacy settings
   * GET /users/me/preferences/privacy
   */
  @Get('me/preferences/privacy')
  @UseGuards(JwtAuthGuard)
  async getPrivacySettings(@CurrentUser() user: User) {
    return await this.preferenceService.getPrivacySettings(user.id);
  }

  /**
   * Update privacy settings
   * PATCH /users/me/preferences/privacy
   */
  @Patch('me/preferences/privacy')
  @UseGuards(JwtAuthGuard)
  async updatePrivacySettings(
    @CurrentUser() user: User,
    @Body() settings: any,
  ) {
    return await this.preferenceService.updatePrivacySettings(
      user.id,
      settings,
    );
  }

  /**
   * Get active sessions
   * GET /users/me/sessions
   */
  @Get('me/sessions')
  @UseGuards(JwtAuthGuard)
  async getActiveSessions(@CurrentUser() user: User) {
    return await this.sessionService.getActiveSessions(user.id);
  }

  /**
   * Get all sessions
   * GET /users/me/sessions/all
   */
  @Get('me/sessions/all')
  @UseGuards(JwtAuthGuard)
  async getAllSessions(@CurrentUser() user: User) {
    return await this.sessionService.getAllSessions(user.id);
  }

  /**
   * Revoke a session
   * DELETE /users/me/sessions/:sessionId
   */
  @Delete('me/sessions/:sessionId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeSession(
    @CurrentUser() user: User,
    @Param('sessionId') sessionId: string,
  ): Promise<void> {
    await this.sessionService.revokeSession(sessionId);

    // Log activity
    await this.activityLogService.logActivity({
      userId: user.id,
      activityType: 'SESSION_REVOKED' as any,
      description: `Session ${sessionId} revoked`,
      metadata: { sessionId },
    });
  }

  /**
   * Revoke all other sessions
   * POST /users/me/sessions/revoke-others
   */
  @Post('me/sessions/revoke-others')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeOtherSessions(
    @CurrentUser() user: User,
    @Body() body: { currentSessionId: string },
  ): Promise<void> {
    await this.sessionService.revokeOtherSessions(
      user.id,
      body.currentSessionId,
    );

    // Log activity
    await this.activityLogService.logActivity({
      userId: user.id,
      activityType: 'SESSION_REVOKED' as any,
      description: 'All other sessions revoked',
    });
  }

  /**
   * Get activity logs
   * GET /users/me/activity
   */
  @Get('me/activity')
  @UseGuards(JwtAuthGuard)
  async getActivity(
    @CurrentUser() user: User,
    @Query('limit') limit: number = 50,
    @Query('offset') offset: number = 0,
  ) {
    return await this.activityLogService.getUserActivity(
      user.id,
      limit,
      offset,
    );
  }

  /**
   * Get activity summary
   * GET /users/me/activity/summary
   */
  @Get('me/activity/summary')
  @UseGuards(JwtAuthGuard)
  async getActivitySummary(@CurrentUser() user: User) {
    return await this.activityLogService.getActivitySummary(user.id);
  }

  /**
   * Get suspicious activities
   * GET /users/me/activity/suspicious
   */
  @Get('me/activity/suspicious')
  @UseGuards(JwtAuthGuard)
  async getSuspiciousActivities(@CurrentUser() user: User) {
    return await this.activityLogService.getSuspiciousActivities(user.id);
  }

  /**
   * Deactivate account
   * POST /users/me/deactivate
   */
  @Post('me/deactivate')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deactivateAccount(@CurrentUser() user: User): Promise<void> {
    await this.usersService.deactivateAccount(user.id);

    // Log activity
    await this.activityLogService.logActivity({
      userId: user.id,
      activityType: 'ACCOUNT_DEACTIVATED' as any,
      description: 'Account deactivated',
    });

    // Revoke all sessions
    await this.sessionService.revokeAllSessions(user.id);
  }

  /**
   * Reactivate account
   * POST /users/me/reactivate
   */
  @Post('me/reactivate')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async reactivateAccount(@CurrentUser() user: User): Promise<void> {
    await this.usersService.reactivateAccount(user.id);

    // Log activity
    await this.activityLogService.logActivity({
      userId: user.id,
      activityType: 'ACCOUNT_REACTIVATED' as any,
      description: 'Account reactivated',
    });
  }

  /**
   * Delete account (soft delete - data retention)
   * DELETE /users/me
   */
  @Delete('me')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAccount(@CurrentUser() user: User): Promise<void> {
    // Log activity before deletion
    await this.activityLogService.logActivity({
      userId: user.id,
      activityType: 'DATA_DELETION' as any,
      description: 'Account deleted (data retained for 30 days as per policy)',
    });

    // Soft delete user
    await this.usersService.softDeleteUser(user.id);

    // Revoke all sessions
    await this.sessionService.revokeAllSessions(user.id);
  }

  /**
   * Export user data
   * GET /users/me/export
   */
  @Get('me/export')
  @UseGuards(JwtAuthGuard)
  async exportUserData(@CurrentUser() user: User) {
    const userData = await this.usersService.findOne(user.id);
    const preferences = await this.preferenceService.getPreferences(user.id);
    const sessions = await this.sessionService.getAllSessions(user.id);
    const activity = await this.activityLogService.getUserActivity(user.id);

    // Log activity
    await this.activityLogService.logActivity({
      userId: user.id,
      activityType: 'DATA_EXPORT' as any,
      description: 'User data exported',
    });

    return {
      user: userData,
      preferences,
      sessions,
      activityLogs: activity,
      exportedAt: new Date(),
    };
  }

  /**
   * Get current user onboarding status
   * GET /users/me/onboarding
   */
  @Get('me/onboarding')
  @UseGuards(JwtAuthGuard)
  async getOnboardingStatus(@CurrentUser() user: User) {
    return this.onboardingService.getOrCreate(user.id);
  }

  /**
   * Mark an onboarding step as complete
   * POST /users/me/onboarding/steps/:stepId/complete
   */
  @Post('me/onboarding/steps/:stepId/complete')
  @UseGuards(JwtAuthGuard)
  async completeOnboardingStep(
    @CurrentUser() user: User,
    @Param('stepId') stepId: OnboardingStepId,
  ) {
    return this.onboardingService.completeStep(user.id, stepId);
  }

  /**
   * Skip onboarding entirely
   * POST /users/me/onboarding/skip
   */
  @Post('me/onboarding/skip')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async skipOnboarding(@CurrentUser() user: User): Promise<void> {
    await this.onboardingService.skip(user.id);
  }

  /**
   * Get onboarding analytics (aggregate across all users)
   * GET /users/me/onboarding/analytics
   */
  @Get('me/onboarding/analytics')
  @UseGuards(JwtAuthGuard)
  async getOnboardingAnalytics() {
    return this.onboardingService.getAnalytics();
  }

  /**
   * Get a single user by ID
   * GET /users/:id
   * ⚠️ MUST come after specific routes like /search and /export
   */
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<User> {
    return await this.usersService.findOne(id);
  }

  /**
   * Update a user
   * PATCH /users/:id
   */
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<User> {
    return await this.usersService.update(id, updateUserDto);
  }

  /**
   * Delete a user
   * DELETE /users/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    return await this.usersService.remove(id);
  }
}
