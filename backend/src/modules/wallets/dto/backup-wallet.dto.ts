import { IsOptional, IsString } from 'class-validator';

export class BackupWalletDto {
  /**
   * Optional additional password for backup encryption.
   * If provided, the backup will be encrypted with this password
   * in addition to the existing wallet encryption.
   */
  @IsOptional()
  @IsString()
  backupPassword?: string;
}
