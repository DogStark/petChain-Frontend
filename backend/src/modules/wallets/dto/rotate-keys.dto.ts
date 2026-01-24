import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import type { WalletKeyDerivation } from '../entities/wallet.entity';

export class RotateKeysDto {
  /**
   * New encrypted secret key (if rotating the encryption).
   */
  @IsOptional()
  @IsString()
  encryptedSecretKey?: string;

  /**
   * New encryption IV for the rotated key.
   */
  @IsNotEmpty()
  @IsString()
  encryptionIv: string;

  /**
   * New encryption salt for the rotated key.
   */
  @IsNotEmpty()
  @IsString()
  encryptionSalt: string;

  /**
   * Key derivation method (PBKDF2 or ARGON2).
   */
  @IsNotEmpty()
  @IsString()
  keyDerivation: WalletKeyDerivation;

  /**
   * Optional HSM key ID if rotating to HSM-based storage.
   */
  @IsOptional()
  @IsString()
  hsmKeyId?: string;
}
