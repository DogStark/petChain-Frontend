import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { SmsService } from './sms.service';
import { SmsController } from './sms.controller';
import { SmsTemplateService } from './sms-template.service';
import { SmsCostService } from './sms-cost.service';
import { SmsLog } from './entities/sms-log.entity';
import { SmsTemplate } from './entities/sms-template.entity';
import { SmsCost } from './entities/sms-cost.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([SmsLog, SmsTemplate, SmsCost]),
    ConfigModule,
  ],
  controllers: [SmsController],
  providers: [SmsService, SmsTemplateService, SmsCostService],
  exports: [SmsService, SmsTemplateService, SmsCostService],
})
export class SmsModule {}
