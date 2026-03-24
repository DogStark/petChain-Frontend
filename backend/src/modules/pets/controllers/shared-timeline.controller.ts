import {
  Controller,
  Get,
  Param,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import PDFDocument from 'pdfkit';
import { PetTimelineService } from '../services/pet-timeline.service';
import {
  GetTimelineQueryDto,
  TimelineExportFormat,
  PetTimelineResponseDto,
} from '../dto/pet-timeline.dto';

/**
 * Public controller for accessing shared timelines
 * Routes are not protected by authentication - accessible via share token
 */
@Controller('shared/timeline')
export class SharedTimelineController {
  constructor(private readonly timelineService: PetTimelineService) {}

  /**
   * GET /shared/timeline/:token
   * Access a shared timeline by share token
   */
  @Get(':token')
  async getSharedTimeline(
    @Param('token') token: string,
    @Query() query: GetTimelineQueryDto,
  ): Promise<PetTimelineResponseDto> {
    return this.timelineService.getTimelineByShareToken(token, query);
  }

  /**
   * GET /shared/timeline/:token/export
   * Export a shared timeline to PDF or JSON
   */
  @Get(':token/export')
  async exportSharedTimeline(
    @Param('token') token: string,
    @Query() query: GetTimelineQueryDto & { format?: string },
    @Res() res: Response,
  ): Promise<void> {
    const timeline = await this.timelineService.getTimelineByShareToken(token, {
      ...query,
      limit: 1000,
      offset: 0,
    });

    if (query.format === TimelineExportFormat.JSON) {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="shared-timeline-${Date.now()}.json"`,
      );
      res.send(JSON.stringify(timeline, null, 2));
      return;
    }

    // Default: PDF export
    const pdfBuffer = await this.generateTimelinePdf(timeline);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="shared-timeline-${Date.now()}.pdf"`,
    );
    res.send(pdfBuffer);
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
      doc.text(`(Shared Timeline)`, { align: 'center' });
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
