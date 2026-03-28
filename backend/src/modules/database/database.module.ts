import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatabasePerformanceService } from './database-performance.service';
import { DatabaseHealthController } from './database-health.controller';

@Global()
@Module({
  imports: [TypeOrmModule],
  providers: [DatabasePerformanceService],
  exports: [DatabasePerformanceService],
  controllers: [DatabaseHealthController],
})
export class DatabaseModule {}
