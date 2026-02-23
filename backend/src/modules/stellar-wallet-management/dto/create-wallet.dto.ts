import { IsEnum, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import type { StellarWalletNetwork } from '../entities/stellar-wallet.entity';

export class MultisigSignerDto {
  @IsOptional()
  key?: string;

  @IsOptional()
  weight?: number;
}

export class MultisigConfigDto {
  @IsOptional()
  threshold?: number;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => MultisigSignerDto)
  signers?: MultisigSignerDto[];
}

export class CreateStellarWalletDto {
  @IsEnum(['PUBLIC', 'TESTNET'])
  network: StellarWalletNetwork = 'TESTNET';

  @IsOptional()
  @ValidateNested()
  @Type(() => MultisigConfigDto)
  multisigConfig?: MultisigConfigDto;
}
