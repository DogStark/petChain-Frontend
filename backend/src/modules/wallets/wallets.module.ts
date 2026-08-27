import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Wallet } from './entities/wallet.entity';
import { WalletAuditLog } from './entities/wallet-audit-log.entity';
import { WalletsService } from './wallets.service';
import { WalletsController } from './wallets.controller';
import { StellarListenerService } from './stellar-listener.service';
import { WebSocketModule } from '../../websocket/websocket.module';

@Module({
  imports: [TypeOrmModule.forFeature([Wallet, WalletAuditLog]), WebSocketModule],
  controllers: [WalletsController],
  providers: [WalletsService, StellarListenerService],
  exports: [WalletsService, StellarListenerService],
})
export class WalletsModule {}
