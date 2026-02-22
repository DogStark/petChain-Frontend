import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Body,
    Param,
    Query,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import {
    CreateNotificationDto,
    NotificationQueryDto,
    BulkActionDto,
    UpdateNotificationSettingDto,
} from './dto/notifications.dto';

/**
 * NotificationsController
 * -----------------------
 * All routes are prefixed /notifications
 *
 * In production, guard these with your JwtAuthGuard and derive
 * userId from req.user.id rather than a route param.
 *
 * REST API:
 *   POST   /notifications                         → create
 *   GET    /notifications/:userId                 → list (filtered, paginated)
 *   PATCH  /notifications/:userId/bulk            → bulk action
 *   PATCH  /notifications/:userId/read-all        → mark all read
 *   GET    /notifications/:userId/settings        → get settings
 *   PATCH  /notifications/:userId/settings        → update settings
 *   GET    /notifications/:userId/:id             → get single
 *   PATCH  /notifications/:userId/:id/read        → mark read
 *   PATCH  /notifications/:userId/:id/unread      → mark unread
 *   DELETE /notifications/:userId/:id             → delete one
 */
@Controller('notifications')
export class NotificationsController {
    constructor(private readonly notificationsService: NotificationsService) { }

    // ── Create ──────────────────────────────────────────────────────────────────

    @Post()
    create(@Body() dto: CreateNotificationDto) {
        return this.notificationsService.create(dto);
    }

    // ── List ────────────────────────────────────────────────────────────────────

    @Get(':userId')
    findAll(
        @Param('userId') userId: string,
        @Query() query: NotificationQueryDto,
    ) {
        return this.notificationsService.findAll(userId, query);
    }

    // ── Bulk actions ────────────────────────────────────────────────────────────

    @Patch(':userId/bulk')
    @HttpCode(HttpStatus.OK)
    bulkAction(
        @Param('userId') userId: string,
        @Body() dto: BulkActionDto,
    ) {
        return this.notificationsService.bulkAction(userId, dto);
    }

    // ── Mark all read ───────────────────────────────────────────────────────────

    @Patch(':userId/read-all')
    @HttpCode(HttpStatus.OK)
    markAllAsRead(@Param('userId') userId: string) {
        return this.notificationsService.markAllAsRead(userId);
    }

    // ── Settings ────────────────────────────────────────────────────────────────

    @Get(':userId/settings')
    getSettings(@Param('userId') userId: string) {
        return this.notificationsService.getSettings(userId);
    }

    @Patch(':userId/settings')
    updateSettings(
        @Param('userId') userId: string,
        @Body() dto: UpdateNotificationSettingDto,
    ) {
        return this.notificationsService.updateSettings(userId, dto);
    }

    // ── Single notification ──────────────────────────────────────────────────────

    @Get(':userId/:id')
    findOne(@Param('id') id: string, @Param('userId') userId: string) {
        return this.notificationsService.findOne(id, userId);
    }

    @Patch(':userId/:id/read')
    markAsRead(@Param('id') id: string, @Param('userId') userId: string) {
        return this.notificationsService.markAsRead(id, userId);
    }

    @Patch(':userId/:id/unread')
    markAsUnread(@Param('id') id: string, @Param('userId') userId: string) {
        return this.notificationsService.markAsUnread(id, userId);
    }

    @Delete(':userId/:id')
    @HttpCode(HttpStatus.NO_CONTENT)
    remove(@Param('id') id: string, @Param('userId') userId: string) {
        return this.notificationsService.remove(id, userId);
    }
}
