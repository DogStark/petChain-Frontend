import {
  Injectable,
  NestMiddleware,
  BadRequestException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ThreatDetectionService } from '../services/threat-detection.service';

@Injectable()
export class SqlInjectionDetectionMiddleware implements NestMiddleware {
  constructor(private threatDetectionService: ThreatDetectionService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const analysis = await this.threatDetectionService.analyzeRequest(req);

    if (analysis.shouldBlock) {
      throw new BadRequestException('Request blocked due to security policy');
    }

    next();
  }
}
