import type { WalletNetwork } from '../../types/wallet';

export function getStellarNetwork(): WalletNetwork {
  return typeof process !== 'undefined' && process.env.NEXT_PUBLIC_STELLAR_NETWORK === 'public'
    ? 'PUBLIC'
    : 'TESTNET';
}

export function isTestnetNetwork(): boolean {
  return getStellarNetwork() === 'TESTNET';
}
