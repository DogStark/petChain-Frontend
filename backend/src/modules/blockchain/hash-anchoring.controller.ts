import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { HashAnchoringService } from './hash-anchoring.service';

@Controller('medical-records/anchor')
export class HashAnchoringController {
  constructor(private readonly anchoringService: HashAnchoringService) {}

  @Post(':recordId')
  queue(@Param('recordId') recordId: string) {
    return this.anchoringService.queueAnchor(recordId);
  }

  @Post('batch')
  queueBatch(@Body('recordIds') recordIds: string[]) {
    return this.anchoringService.queueBatch(recordIds);
  }

  @Get(':recordId/status')
  status(@Param('recordId') recordId: string) {
    return this.anchoringService.getAnchorStatus(recordId);
  }

  @Get(':recordId/verify')
  verify(@Param('recordId') recordId: string) {
    return this.anchoringService.verifyAnchor(recordId);
  }
}
