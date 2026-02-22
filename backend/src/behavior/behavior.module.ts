import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BehaviorLog } from './entities/behavior-log.entity';
import { BehaviorService } from './behavior.service';
import { BehaviorController } from './behavior.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([BehaviorLog]),
        AuthModule,
    ],
    controllers: [BehaviorController],
    providers: [BehaviorService],
    exports: [BehaviorService],
})
export class BehaviorModule { }
