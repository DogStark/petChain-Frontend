import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  Res,
  HttpCode,
  HttpStatus,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import type { Response } from 'express';
import PDFDocument from 'pdfkit';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { PetTimelineService } from '../services/pet-timeline.service';
import { TimelineShare } from '../entities/timeline-share.entity';
import {
  GetTimelineQueryDto,
  ExportTimelineQueryDto,
  ShareTimelineDto,
  TimelineExportFormat,
  TimelineEventDto,
  PetTimelineResponseDto,
} from '../dto/pet-timeline.dto';

interface AuthUser {
  id: string;
  email: string;
}

/**
 * Controller for Pet Medical History Timeline
 * Provides endpoints for retrieving, exporting, and sharing pet timelines
 */
@Controller('pets/:petId/timeline')
@UseGuards(JwtAuthGuard)
export class PetTimelineController {
  constructor(private readonly timelineService: PetTimelineService) {}

  /**
   * GET /pets/:petId/timeline
   * Retrieve chronological timeline of all medical events for a pet
   */
  @Get()
  async getTimeline(
    @Param('petId', ParseUUIDPipe) petId: string,
    @Query() query: GetTimelineQueryDto,
  ): Promise<PetTimelineResponseDto> {
    return this.timelineService.getTimeline(petId, query);
  }

  /**
   * GET /pets/:petId/timeline/summary
   * Get summary statistics for pet's medical history
   */
  @Get('summary')
  async getTimelineSummary(
    @Param('petId', ParseUUIDPipe) petId: string,
  ): Promise<{
    totalEvents: number;
    byType: Record<string, number>;
    lastEvent?: TimelineEventDto;
    upcomingAppointments: number;
  }> {
    return this.timelineService.getTimelineSummary(petId);
  }

  /**
   * GET /pets/:petId/timeline/export
   * Export timeline to PDF or JSON format
   */
  @Get('export')
  async exportTimeline(
    @Param('petId', ParseUUIDPipe) petId: string,
    @Query() query: ExportTimelineQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const timeline = await this.timelineService.getTimeline(petId, {
      eventType: query.eventType,
      startDate: query.startDate,
      endDate: query.endDate,
      sortOrder: query.sortOrder,
      limit: 1000, // Export all events (no pagination limit)
      offset: 0,
    });

    if (query.format === TimelineExportFormat.JSON) {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="timeline-${petId}-${Date.now()}.json"`,
      );
      res.send(JSON.stringify(timeline, null, 2));
      return;
    }

    // Default: PDF export
    const pdfBuffer = await this.generateTimelinePdf(timeline);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="timeline-${petId}-${Date.now()}.pdf"`,
    );
    res.send(pdfBuffer);
  }

  /**
   * POST /pets/:petId/timeline/share
   * Create a shareable link for the pet's timeline
   */
  @Post('share')
  @HttpCode(HttpStatus.CREATED)
  async shareTimeline(
    @Param('petId', ParseUUIDPipe) petId: string,
    @Body() shareDto: ShareTimelineDto,
    @CurrentUser() user: AuthUser,
  ): Promise<{
    shareToken: string;
    shareUrl: string;
    expiresAt: Date;
    eventCount: number;
  }> {
    // Get timeline to count events
    const timeline = await this.timelineService.getTimeline(petId, {
      eventType: shareDto.eventType,
      startDate: shareDto.startDate,
      endDate: shareDto.endDate,
      limit: 1000,
      offset: 0,
    });

    // Create share with persistent storage
    const share = await this.timelineService.createTimelineShare(petId, user.id, shareDto);

    const baseUrl = process.env.APP_URL || 'http://localhost:3000';
    const shareUrl = `${baseUrl}/shared/timeline/${share.shareToken}`;

    return {
      shareToken: share.shareToken,
      shareUrl,
      expiresAt: share.expiresAt,
      eventCount: timeline.totalEvents,
    };
  }

  /**
   * GET /pets/:petId/timeline/shares
   * List all timeline shares for a pet
   */
  @Get('shares')
  async getTimelineShares(
    @Param('petId', ParseUUIDPipe) petId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<TimelineShare[]> {
    return this.timelineService.getTimelineShares(petId, user.id);
  }

  /**
   * DELETE /pets/:petId/timeline/shares/:shareId
   * Revoke a timeline share
   */
  @Delete('shares/:shareId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeTimelineShare(
    @Param('shareId', ParseUUIDPipe) shareId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    return this.timelineService.revokeTimelineShare(shareId, user.id);
  }

  /**
   * Generate PDF document from timeline data
   */
  private generateTimelinePdf(timeline: PetTimelineResponseDto): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({ margin: 50 });

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Title
      doc
        .fontSize(20)
        .text(`Pet Medical History Timeline`, { align: 'center' });
      doc.moveDown(0.5);
      doc
        .fontSize(14)
        .text(`${timeline.petName}`, { align: 'center' });
      doc.moveDown();

      // Filter info
      doc.fontSize(10).fillColor('#666666');
      if (timeline.filters.startDate || timeline.filters.endDate) {
        const dateRange = [
          timeline.filters.startDate ? `From: ${timeline.filters.startDate}` : '',
          timeline.filters.endDate ? `To: ${timeline.filters.endDate}` : '',
        ]
          .filter(Boolean)
          .join(' | ');
        doc.text(dateRange, { align: 'center' });
      }
      doc.text(`Total Events: ${timeline.totalEvents}`, { align: 'center' });
      doc.moveDown();
      doc.fillColor('#000000');

      // Timeline events
      const eventTypeColors: Record<string, string> = {
        vaccination: '#4CAF50',
        medical_record: '#2196F3',
        prescription: '#FF9800',
        appointment: '#9C27B0',
        allergy: '#F44336',
      };

      let currentYear = '';

      for (const event of timeline.events) {
        const eventDate = new Date(event.date);
        const year = eventDate.getFullYear().toString();

        // Year header
        if (year !== currentYear) {
          currentYear = year;
          doc.moveDown(0.5);
          doc.fontSize(14).fillColor('#333333').text(year, { underline: true });
          doc.moveDown(0.3);
        }

        // Event entry
        const color = eventTypeColors[event.type] || '#666666';
        const dateStr = eventDate.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        });

        // Check if we need a new page
        if (doc.y > 700) {
          doc.addPage();
        }

        // Date column
        doc.fontSize(10).fillColor('#666666').text(dateStr, 50, doc.y, { continued: true, width: 60 });

        // Event type badge
        doc.fillColor(color).text(` [${event.type.toUpperCase()}] `, { continued: true });

        // Event title
        doc.fillColor('#000000').text(event.title);

        // Description
        if (event.description) {
          doc.fontSize(9).fillColor('#666666').text(`    ${event.description}`, { indent: 70 });
        }

        doc.moveDown(0.5);
      }

      // Footer
      doc.moveDown();
      doc
        .fontSize(8)
        .fillColor('#999999')
        .text(`Generated on ${new Date().toLocaleString()}`, { align: 'center' });

      doc.end();
    });
  }
}
