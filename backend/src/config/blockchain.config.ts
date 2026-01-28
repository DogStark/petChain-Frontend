import { registerAs } from '@nestjs/config';

export const blockchainConfig = registerAs('blockchain', () => ({
  stellar: {
    network: process.env.STELLAR_NETWORK || 'TESTNET',
    secretKey: process.env.STELLAR_SECRET_KEY,
    publicKey: process.env.STELLAR_PUBLIC_KEY,
    rpcUrl: process.env.STELLAR_RPC_URL || 'https://horizon-testnet.stellar.org',
  },
  ipfs: {
    url: process.env.IPFS_URL || 'http://localhost:5001',
    gateway: process.env.IPFS_GATEWAY || 'https://ipfs.io/ipfs/',
  },
}));
