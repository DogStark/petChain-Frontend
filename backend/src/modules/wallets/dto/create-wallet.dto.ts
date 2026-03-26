import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import type {
  WalletKeyDerivation,
  WalletNetwork,
} from '../entities/wallet.entity';

export class CreateWalletDto {
  @IsUUID()
  userId: string;

  @IsString()
  @MaxLength(64)
  publicKey: string;

  /**
   * Encrypted secret key blob produced client-side using the user's password.
   * The API must NEVER accept plaintext private keys.
   */
  @IsString()
  encryptedSecretKey: string;

  @IsString()
  @MaxLength(64)
  encryptionSalt: string;

  @IsString()
  @MaxLength(16)
  encryptionIv: string;

  @IsEnum(['PBKDF2', 'ARGON2'])
  keyDerivation: WalletKeyDerivation;

  @IsEnum(['PUBLIC', 'TESTNET'])
  network: WalletNetwork;

  @IsBoolean()
  @IsOptional()
  isMultiSig?: boolean;

  @IsOptional()
  multisigConfig?: Record<string, unknown>;

  /**
   * Optional HSM key reference. When present, encryptedSecretKey may be null
   * and signing operations should be routed through the HSM.
   */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  hsmKeyId?: string;
}
