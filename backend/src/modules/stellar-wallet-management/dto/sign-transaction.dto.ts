import { IsEnum, IsString } from 'class-validator';
import type { StellarWalletNetwork } from '../entities/stellar-wallet.entity';

export class SignTransactionDto {
  @IsString()
  unsignedXdr: string;

  @IsEnum(['PUBLIC', 'TESTNET'])
  network: StellarWalletNetwork;
}
