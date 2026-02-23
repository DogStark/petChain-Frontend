import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';
import type { StellarWalletNetwork } from '../entities/stellar-wallet.entity';

export class BackupDataDto {
  @IsNotEmpty()
  @IsString()
  publicKey: string;

  @IsNotEmpty()
  @IsString()
  encryptedSecretKey: string;

  @IsNotEmpty()
  @IsString()
  encryptionIv: string;

  @IsNotEmpty()
  @IsString()
  encryptionAuthTag: string;

  @IsNotEmpty()
  @IsString()
  network: 'PUBLIC' | 'TESTNET';

  @IsOptional()
  isMultiSig?: boolean;

  @IsOptional()
  multisigConfig?: Record<string, unknown>;
}

export class RecoverWalletDto {
  @IsNotEmpty()
  @IsObject()
  backupData: BackupDataDto;
}
