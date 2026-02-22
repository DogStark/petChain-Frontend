import { IsEnum, IsOptional } from 'class-validator';
import type { StellarWalletNetwork } from '../entities/stellar-wallet.entity';

export class GetBalanceQueryDto {
  @IsOptional()
  @IsEnum(['PUBLIC', 'TESTNET'])
  network?: StellarWalletNetwork;
}
