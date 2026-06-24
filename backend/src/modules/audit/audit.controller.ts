import {
  Controller,
  Get,
  Param,
  Query,
  Res,
  UseGuards,
  Request,
} from '@nestjs/common';
import { Response } from 'express';
import { AuditService } from './audit.service';
import { AuditQueryDto } from './dto/audit-query.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RoleName } from '../../auth/constants/roles.enum';

@Controller('audit')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  /** GET /audit — admin: query all logs with filters */
  @Get()
  @Roles(RoleName.Admin)
  findAll(@Query() query: AuditQueryDto) {
    return this.auditService.findAll(query);
  }

  /** GET /audit/me — authenticated user: own audit trail */
  @Get('me')
  findMine(@Request() req: { user: { id: string } }) {
    return this.auditService.findByUser(req.user.id);
  }

  /** GET /audit/entity/:entityType/:entityId — admin: logs for a specific entity */
  @Get('entity/:entityType/:entityId')
  @Roles(RoleName.Admin)
  findByEntity(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
  ) {
    return this.auditService.findByEntity(entityType, entityId);
  }

  /** GET /audit/export — admin: stream CSV download */
  @Get('export')
  @Roles(RoleName.Admin)
  async exportCsv(@Query() query: AuditQueryDto, @Res() res: Response) {
    const csv = await this.auditService.exportCsv(query);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="audit-logs.csv"');
    res.send(csv);
  }
}
