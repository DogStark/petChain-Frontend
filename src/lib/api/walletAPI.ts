import axios, { AxiosInstance } from 'axios';
import type { BackupData } from '../../types/wallet';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

export interface ServerWallet {
  id: string;
  userId: string;
  publicKey: string;
  label: string;
  network: string;
  type: 'standard' | 'multisig';
  createdAt: string;
}

export interface WalletTransactionRecord {
  id: string;
  hash: string;
  type: string;
  status: 'pending' | 'confirmed' | 'failed';
  amount?: string;
  asset?: string;
  destination?: string;
  fee: string;
  timestamp: string;
  ledger?: number;
}

class WalletManagementAPI {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: `${API_BASE_URL}/wallets`,
      withCredentials: true,
    });

    this.api.interceptors.request.use((config) => {
      // Support both legacy and current token storage
      const legacy = localStorage.getItem('authToken');
      if (legacy) {
        config.headers.Authorization = `Bearer ${legacy}`;
        return config;
      }
      try {
        const stored = localStorage.getItem('auth_tokens');
        const { accessToken } = stored ? JSON.parse(stored) : {};
        if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
      } catch {
        // no token
      }
      return config;
    });
  }

  /** Register a wallet's public key on the server (no secret key is ever sent). */
  async registerWallet(publicKey: string, label: string, network: string): Promise<ServerWallet> {
    const response = await this.api.post('/', { publicKey, label, network });
    return response.data;
  }

  /** Fetch all wallets registered for the current user. */
  async getWallets(): Promise<ServerWallet[]> {
    const response = await this.api.get('/');
    return response.data;
  }

  /** Update wallet label. */
  async updateWallet(id: string, label: string): Promise<ServerWallet> {
    const response = await this.api.patch(`/${id}`, { label });
    return response.data;
  }

  /** Remove a wallet registration from the server. */
  async deleteWallet(id: string): Promise<void> {
    await this.api.delete(`/${id}`);
  }

  /**
   * Store an encrypted backup on the server.
   * The backup payload contains only the encrypted key — the server never sees the plaintext.
   */
  async storeBackup(walletId: string, backup: BackupData): Promise<void> {
    await this.api.post(`/${walletId}/backup`, backup);
  }

  /** Retrieve an encrypted backup stored on the server. */
  async getBackup(walletId: string): Promise<BackupData> {
    const response = await this.api.get(`/${walletId}/backup`);
    return response.data;
  }

  /** Get on-chain transaction history for a given wallet public key. */
  async getWalletTransactions(
    walletId: string,
    params?: { limit?: number; cursor?: string }
  ): Promise<WalletTransactionRecord[]> {
    const response = await this.api.get(`/${walletId}/transactions`, { params });
    return response.data;
  }
}

export const walletAPI = new WalletManagementAPI();
export default walletAPI;
