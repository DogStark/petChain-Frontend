import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import type { WalletNetwork } from '../entities/wallet.entity';

export class PrepareTransactionDto {
  @IsString()
  @MaxLength(64)
  sourcePublicKey: string;

  /**
   * Horizon server URL override. Normally derived from network + server config.
   */
  @IsOptional()
  @IsString()
  horizonUrl?: string;

  @IsEnum(['PUBLIC', 'TESTNET'])
  network: WalletNetwork;

  @IsOptional()
  @IsString()
  @MaxLength(28)
  memo?: string;

  /**
   * Array of operations to perform.
   * These are passed through to the client as part of the unsigned XDR,
   * so the client can inspect them before signing.
   */
  @IsArray()
  operations: unknown[];

  /**
   * Optional client-specified upper bound for fees (in stroops).
   * Server will respect this maximum when estimating fees.
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  maxFeeStroops?: number;
}
