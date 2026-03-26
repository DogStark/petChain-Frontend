import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import type { WalletNetwork } from '../entities/wallet.entity';

export class SignTransactionDto {
  @IsUUID()
  walletId: string;

  /**
   * Unsigned XDR previously prepared by the server.
   * The client should verify this matches what they are about to sign.
   */
  @IsString()
  unsignedXdr: string;

  /**
   * Signed XDR produced client-side using the user's private key,
   * or by an attached hardware wallet / passkey.
   */
  @IsString()
  signedXdr: string;

  @IsEnum(['PUBLIC', 'TESTNET'])
  network: WalletNetwork;

  /**
   * Optional human-readable consent string that was displayed to the user.
   * Useful for audit trails and dispute resolution.
   */
  @IsOptional()
  @IsString()
  consentText?: string;
}
