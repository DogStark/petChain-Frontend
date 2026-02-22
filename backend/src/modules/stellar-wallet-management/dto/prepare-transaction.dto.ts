import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import type { StellarWalletNetwork } from '../entities/stellar-wallet.entity';

export class PrepareTransactionDto {
  @IsEnum(['PUBLIC', 'TESTNET'])
  network: StellarWalletNetwork;

  @IsArray()
  operations: Array<{
    type: string;
    destination?: string;
    amount?: string;
    assetCode?: string;
    assetIssuer?: string;
    [key: string]: unknown;
  }>;

  @IsOptional()
  @IsString()
  @MaxLength(28)
  memo?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxFeeStroops?: number;
}
