import { IsEnum } from 'class-validator';
import type { StellarWalletNetwork } from '../entities/stellar-wallet.entity';

export class SwitchNetworkDto {
  @IsEnum(['PUBLIC', 'TESTNET'])
  network: StellarWalletNetwork;
}
