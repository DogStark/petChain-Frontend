/**
 * WalletManagementAPI (walletAPI)
 *
 * Responsibility: HTTP transport layer between the frontend and the PetChain
 * backend /wallets endpoints. Handles only server-side wallet registration
 * metadata — it never transmits or stores secret keys.
 *
 * Boundary contract:
 *   ✅ Register a wallet public key with the backend after creation/import.
 *   ✅ Update a wallet label on the server.
 *   ✅ Delete a wallet registration from the server.
 *   ✅ Store / retrieve an encrypted backup payload on the server.
 *        (The backup contains only the encrypted key blob — server never sees
 *        the plaintext secret.)
 *   ✅ Fetch server-proxied on-chain transaction history for a given wallet.
 *
 *   ❌ NOT responsible for reading the local wallet list — that lives in
 *      walletService (src/lib/wallet/walletService.ts), which reads from
 *      localStorage under 'petchain_wallets'.
 *   ❌ NOT responsible for key generation, encryption, or signing — walletService
 *      and walletCrypto own those concerns.
 *   ❌ NOT responsible for live Horizon balance polling — that belongs to
 *      walletBalanceService (src/services/walletBalance.ts).
 *
 * Authentication: reads the access token from localStorage.  Supports the
 * legacy 'authToken' key for backward compatibility, falling back to the
 * current 'auth_tokens' JSON structure.
 */

import axios from 'axios';
import type { AxiosInstance } from 'axios';

import { getApiBaseUrl } from './apiBaseUrl';
import type { BackupData } from '../../types/wallet';

/** Server-side wallet registration record returned by the backend. */
export interface ServerWallet {
  id: string;
  userId: string;
  publicKey: string;
  label: string;
  network: string;
  type: 'standard' | 'multisig';
  createdAt: string;
}

/** On-chain transaction record as returned by the backend proxy. */
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
      baseURL: `${getApiBaseUrl()}/wallets`,
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
        // no token — request will proceed unauthenticated
      }
      return config;
    });
  }

  /**
   * Register a wallet's public key on the server.
   * Called as a fire-and-forget side-effect from walletService.createWallet()
   * and walletService.importBackup(). The secret key is never sent.
   */
  async registerWallet(publicKey: string, label: string, network: string): Promise<ServerWallet> {
    const response = await this.api.post('/', { publicKey, label, network });
    return response.data;
  }

  /**
   * Update the human-readable label of a registered wallet.
   * Used when the user renames a wallet via the UI after it has been registered.
   */
  async updateWallet(id: string, label: string): Promise<ServerWallet> {
    const response = await this.api.patch(`/${id}`, { label });
    return response.data;
  }

  /**
   * Remove a wallet registration from the server.
   * Should be called alongside walletService.deleteWallet() when the user
   * removes a wallet entirely.
   */
  async deleteWallet(id: string): Promise<void> {
    await this.api.delete(`/${id}`);
  }

  /**
   * Store an encrypted backup blob on the server for cloud recovery.
   * The backup payload contains only the AES-GCM ciphertext — the server
   * never sees the plaintext secret key.
   *
   * This is an optional secondary backup channel. The primary backup is a
   * local file export via walletService.exportBackup().
   */
  async storeBackup(walletId: string, backup: BackupData): Promise<void> {
    await this.api.post(`/${walletId}/backup`, backup);
  }

  /**
   * Retrieve an encrypted backup blob previously stored on the server.
   * The caller must provide the correct PIN to decrypt the returned payload.
   */
  async getBackup(walletId: string): Promise<BackupData> {
    const response = await this.api.get(`/${walletId}/backup`);
    return response.data;
  }

  /**
   * Fetch on-chain transaction history for a given wallet, proxied through the
   * backend. The backend may enrich or cache Horizon data.
   *
   * For live Horizon queries without backend mediation, use
   * walletService.fetchAccountData() instead.
   */
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
