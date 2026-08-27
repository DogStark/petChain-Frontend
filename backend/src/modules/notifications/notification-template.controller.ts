import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { NotificationTemplateService } from './notification-template.service';
import { NotificationDispatchService } from './notification-dispatch.service';
import { CreateTemplateDto, UpdateTemplateDto, RenderTemplateDto } from './dto/template.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@Controller('notification-templates')
@UseGuards(JwtAuthGuard)
export class NotificationTemplateController {
  constructor(
    private readonly templateService: NotificationTemplateService,
    private readonly dispatchService: NotificationDispatchService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateTemplateDto) {
    return this.templateService.create(dto);
  }

  @Get()
  findAll() {
    return this.templateService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.templateService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTemplateDto) {
    return this.templateService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.templateService.remove(id);
  }

  @Post('preview')
  preview(@Body() dto: RenderTemplateDto) {
    return this.templateService.render(dto.name, dto.channel, dto.variables ?? {});
  }

  @Get('analytics/:userId')
  analytics(@Param('userId') userId: string) {
    return this.dispatchService.getAnalytics(userId);
  }

  @Get('delivery/:notificationId')
  deliveryStats(@Param('notificationId') notificationId: string) {
    return this.dispatchService.getDeliveryStats(notificationId);
  }
}
