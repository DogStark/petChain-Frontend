import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { VaccinationsModule } from './modules/vaccinations/vaccinations.module';

@Module({
  imports: [VaccinationsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
