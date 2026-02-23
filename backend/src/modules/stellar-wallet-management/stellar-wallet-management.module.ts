import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StellarWallet } from './entities/stellar-wallet.entity';
import { StellarWalletAuditLog } from './entities/stellar-wallet-audit-log.entity';
import { StellarWalletManagementService } from './stellar-wallet-management.service';
import { StellarWalletManagementController } from './stellar-wallet-management.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([StellarWallet, StellarWalletAuditLog]),
  ],
  controllers: [StellarWalletManagementController],
  providers: [StellarWalletManagementService],
  exports: [StellarWalletManagementService],
})
export class StellarWalletManagementModule {}
