import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';
import type { WalletNetwork } from '../entities/wallet.entity';

export class RecoverWalletDto {
  /**
   * The encrypted backup data exported from a previous wallet.
   */
  @IsNotEmpty()
  @IsObject()
  backupData: {
    publicKey: string;
    encryptedSecretKey: string;
    encryptionIv: string;
    encryptionSalt: string;
    keyDerivation: string;
    network: WalletNetwork;
    isMultiSig?: boolean;
    multisigConfig?: Record<string, unknown>;
  };

  /**
   * Password used to decrypt the backup (if additional encryption was applied).
   */
  @IsOptional()
  @IsString()
  backupPassword?: string;
}
