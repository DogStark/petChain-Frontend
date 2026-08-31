/**
 * Centralised explorer helpers — derived from configured Stellar network.
 * Do not hard-code explorer hosts in components.
 */
export function isTestnet(): boolean {
  const network = (process.env.NEXT_PUBLIC_STELLAR_NETWORK || '').toLowerCase().trim();
  // Default to testnet in local/dev; only public/mainnet opts out.
  return network !== 'public' && network !== 'mainnet';
}

export function getExplorerTxUrl(hash: string): string {
  const base = isTestnet()
    ? 'https://stellar.expert/explorer/testnet/tx'
    : 'https://stellar.expert/explorer/public/tx';
  return `${base}/${encodeURIComponent(hash)}`;
}

export function getExplorerAccountUrl(account: string): string {
  const base = isTestnet()
    ? 'https://stellar.expert/explorer/testnet/account'
    : 'https://stellar.expert/explorer/public/account';
  return `${base}/${encodeURIComponent(account)}`;
}
