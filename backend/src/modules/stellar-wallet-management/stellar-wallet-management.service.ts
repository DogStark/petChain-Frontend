import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { ConfigType } from '@nestjs/config';
import {
  Horizon,
  Keypair,
  Transaction,
  TransactionBuilder,
  Operation,
  Asset,
  Memo,
  BASE_FEE,
} from '@stellar/stellar-sdk';
import { stellarConfig } from '../../config/stellar.config';
import { StellarWallet } from './entities/stellar-wallet.entity';
import {
  StellarWalletAuditLog,
  StellarWalletOperationType,
} from './entities/stellar-wallet-audit-log.entity';
import { AesEncryption } from './utils/aes-encryption.util';
import type { StellarWalletNetwork } from './entities/stellar-wallet.entity';
import type { PrepareTransactionDto } from './dto/prepare-transaction.dto';

@Injectable()
export class StellarWalletManagementService {
  constructor(
    @InjectRepository(StellarWallet)
    private readonly walletRepository: Repository<StellarWallet>,
    @InjectRepository(StellarWalletAuditLog)
    private readonly auditRepository: Repository<StellarWalletAuditLog>,
    @Inject(stellarConfig.KEY)
    private readonly stellarCfg: ConfigType<typeof stellarConfig>,
  ) {}

  private getMasterKey(): Buffer {
    const key = this.stellarCfg.walletMasterKey;
    if (!key || key.length < 32) {
      throw new BadRequestException(
        'STELLAR_WALLET_MASTER_KEY must be set (base64-encoded 32-byte key) for wallet encryption',
      );
    }
    return AesEncryption.getKey(key);
  }

  private getServer(network: StellarWalletNetwork): Horizon.Server {
    const config = this.stellarCfg.networks[network];
    return new Horizon.Server(config.horizonUrl);
  }

  /**
   * Auto wallet creation: ensure user has a wallet for the given network.
   * Creates one if none exists.
   */
  async ensureWalletForUser(
    userId: string,
    network: StellarWalletNetwork = 'TESTNET',
  ): Promise<StellarWallet> {
    let wallet = await this.walletRepository.findOne({
      where: { userId, network },
    });

    if (wallet) {
      return wallet;
    }

    const keypair = Keypair.random();
    const secretKey = keypair.secret();
    const masterKey = this.getMasterKey();
    const { ciphertext, iv, authTag } = AesEncryption.encrypt(secretKey, masterKey);

    wallet = this.walletRepository.create({
      userId,
      publicKey: keypair.publicKey(),
      encryptedSecretKey: ciphertext,
      encryptionIv: iv,
      encryptionAuthTag: authTag,
      network,
      isMultiSig: false,
      multisigConfig: null,
    });

    const saved = await this.walletRepository.save(wallet);
    await this.recordAudit(saved, userId, 'AUTO_CREATE', { network });
    return saved;
  }

  async findByUser(userId: string): Promise<StellarWallet[]> {
    return this.walletRepository.find({ where: { userId } });
  }

  async findOneForUser(id: string, userId: string): Promise<StellarWallet> {
    const wallet = await this.walletRepository.findOne({
      where: { id, userId },
    });
    if (!wallet) {
      throw new NotFoundException(`Stellar wallet ${id} not found`);
    }
    return wallet;
  }

  async findForUserAndNetwork(
    userId: string,
    network: StellarWalletNetwork,
  ): Promise<StellarWallet | null> {
    return this.walletRepository.findOne({
      where: { userId, network },
    });
  }

  /**
   * Create wallet explicitly (alternative to auto-create).
   */
  async createWallet(
    userId: string,
    network: StellarWalletNetwork,
    multisigConfig?: { threshold: number; signers: { key: string; weight: number }[] },
  ): Promise<StellarWallet> {
    const existing = await this.findForUserAndNetwork(userId, network);
    if (existing) {
      throw new BadRequestException(`Wallet already exists for network ${network}`);
    }

    const keypair = Keypair.random();
    const masterKey = this.getMasterKey();
    const { ciphertext, iv, authTag } = AesEncryption.encrypt(
      keypair.secret(),
      masterKey,
    );

    const wallet = this.walletRepository.create({
      userId,
      publicKey: keypair.publicKey(),
      encryptedSecretKey: ciphertext,
      encryptionIv: iv,
      encryptionAuthTag: authTag,
      network,
      isMultiSig: !!multisigConfig,
      multisigConfig: multisigConfig
        ? {
            threshold: multisigConfig.threshold,
            signers: multisigConfig.signers,
          }
        : null,
    });

    const saved = await this.walletRepository.save(wallet);
    await this.recordAudit(saved, userId, 'CREATE', { network });
    return saved;
  }

  /**
   * Balance checking.
   */
  async getBalance(
    walletId: string,
    userId: string,
    network?: StellarWalletNetwork,
  ): Promise<{
    publicKey: string;
    network: StellarWalletNetwork;
    balances: Array<{
      asset_type: string;
      asset_code?: string;
      asset_issuer?: string;
      balance: string;
    }>;
    sequence: string;
  }> {
    const wallet = await this.findOneForUser(walletId, userId);
    const net = network || wallet.network;
    const server = this.getServer(net);

    try {
      const account = await server.loadAccount(wallet.publicKey);
      await this.recordAudit(wallet, userId, 'BALANCE_CHECK', { network: net });

      return {
        publicKey: wallet.publicKey,
        network: net,
        balances: account.balances,
        sequence: account.sequenceNumber(),
      };
    } catch {
      throw new NotFoundException(
        `Account ${wallet.publicKey} not found on ${net} network`,
      );
    }
  }

  /**
   * Testnet/Mainnet switching.
   */
  async switchNetwork(
    walletId: string,
    userId: string,
    network: StellarWalletNetwork,
  ): Promise<StellarWallet> {
    const wallet = await this.findOneForUser(walletId, userId);
    const existing = await this.findForUserAndNetwork(userId, network);
    if (existing && existing.id !== walletId) {
      throw new BadRequestException(
        `You already have a wallet for ${network}. Use that wallet or create with different network.`,
      );
    }

    wallet.network = network;
    const saved = await this.walletRepository.save(wallet);
    await this.recordAudit(saved, userId, 'SWITCH_NETWORK', { network });
    return saved;
  }

  /**
   * Prepare unsigned transaction.
   */
  async prepareTransaction(
    walletId: string,
    userId: string,
    dto: PrepareTransactionDto,
  ): Promise<{
    unsignedXdr: string;
    feeStroops: number;
    networkPassphrase: string;
  }> {
    const wallet = await this.findOneForUser(walletId, userId);
    const netConfig = this.stellarCfg.networks[dto.network];
    const server = this.getServer(dto.network);

    const account = await server.loadAccount(wallet.publicKey);
    const baseFee = await server.fetchBaseFee().catch(() => BASE_FEE);
    const fee = dto.maxFeeStroops ?? baseFee;

    const txBuilder = new TransactionBuilder(account, {
      fee: fee.toString(),
      networkPassphrase: netConfig.networkPassphrase,
    });

    for (const op of dto.operations) {
      if (op.type === 'payment' && op.destination && op.amount) {
        const asset =
          op.assetCode && op.assetIssuer
            ? new Asset(op.assetCode, op.assetIssuer)
            : Asset.native();
        txBuilder.addOperation(
          Operation.payment({
            destination: op.destination,
            asset,
            amount: op.amount,
          }),
        );
      }
    }

    if (dto.memo) {
      txBuilder.addMemo(Memo.text(dto.memo));
    }

    const tx = txBuilder.setTimeout(300).build();

    await this.recordAudit(wallet, userId, 'PREPARE_TRANSACTION', {
      network: dto.network,
      operationCount: dto.operations.length,
    });

    return {
      unsignedXdr: tx.toXDR(),
      feeStroops: parseInt(tx.fee, 10),
      networkPassphrase: netConfig.networkPassphrase,
    };
  }

  /**
   * Transaction signing using server-held encrypted key.
   */
  async signTransaction(
    walletId: string,
    userId: string,
    unsignedXdr: string,
    network: StellarWalletNetwork,
  ): Promise<{ signedXdr: string }> {
    const wallet = await this.findOneForUser(walletId, userId);
    const masterKey = this.getMasterKey();
    const secretKey = AesEncryption.decrypt(
      wallet.encryptedSecretKey,
      wallet.encryptionIv,
      wallet.encryptionAuthTag,
      masterKey,
    );

    const netConfig = this.stellarCfg.networks[network];
    const transaction = new Transaction(unsignedXdr, netConfig.networkPassphrase);
    const keypair = Keypair.fromSecret(secretKey);
    transaction.sign(keypair);

    await this.recordAudit(wallet, userId, 'SIGN_TRANSACTION', { network });

    return { signedXdr: transaction.toXDR() };
  }

  /**
   * Multi-signature: signTransaction can be called multiple times with different
   * wallets (each holding a signer key). Pass the output of each call as the
   * next unsignedXdr until all required signatures are collected.
   */

  /**
   * Submit signed transaction.
   */
  async submitTransaction(
    walletId: string,
    userId: string,
    signedXdr: string,
    network?: StellarWalletNetwork,
  ): Promise<{
    successful: boolean;
    hash: string;
    ledger: number;
    resultXdr: string;
  }> {
    const wallet = await this.findOneForUser(walletId, userId);
    const net = network || wallet.network;
    const netConfig = this.stellarCfg.networks[net];
    const server = this.getServer(net);

    try {
      const transaction = new Transaction(signedXdr, netConfig.networkPassphrase);
      const result = await server.submitTransaction(transaction);

      await this.recordAudit(wallet, userId, 'SUBMIT_TRANSACTION', {
        network: net,
        hash: result.hash,
      });

      return {
        successful: result.successful,
        hash: result.hash,
        ledger: result.ledger,
        resultXdr: result.result_xdr,
      };
    } catch (error: any) {
      throw new BadRequestException(
        `Transaction submission failed: ${error?.message || 'Unknown error'}`,
      );
    }
  }

  /**
   * Wallet backup export.
   */
  async exportBackup(
    walletId: string,
    userId: string,
  ): Promise<{
    backupData: {
      publicKey: string;
      encryptedSecretKey: string;
      encryptionIv: string;
      encryptionAuthTag: string;
      network: string;
      isMultiSig: boolean;
      multisigConfig: Record<string, unknown> | null;
      exportedAt: string;
    };
  }> {
    const wallet = await this.findOneForUser(walletId, userId);
    await this.recordAudit(wallet, userId, 'BACKUP_EXPORT', {});

    return {
      backupData: {
        publicKey: wallet.publicKey,
        encryptedSecretKey: wallet.encryptedSecretKey,
        encryptionIv: wallet.encryptionIv,
        encryptionAuthTag: wallet.encryptionAuthTag,
        network: wallet.network,
        isMultiSig: wallet.isMultiSig,
        multisigConfig: wallet.multisigConfig as Record<string, unknown> | null,
        exportedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Wallet recovery from backup.
   */
  async recoverWallet(
    userId: string,
    backupData: {
      publicKey: string;
      encryptedSecretKey: string;
      encryptionIv: string;
      encryptionAuthTag: string;
      network: StellarWalletNetwork;
      isMultiSig?: boolean;
      multisigConfig?: Record<string, unknown> | null;
    },
  ): Promise<StellarWallet> {
    const existing = await this.walletRepository.findOne({
      where: { userId, publicKey: backupData.publicKey },
    });
    if (existing) {
      throw new BadRequestException('Wallet with this public key already exists');
    }

    const wallet = this.walletRepository.create({
      userId,
      publicKey: backupData.publicKey,
      encryptedSecretKey: backupData.encryptedSecretKey,
      encryptionIv: backupData.encryptionIv,
      encryptionAuthTag: backupData.encryptionAuthTag,
      network: backupData.network,
      isMultiSig: backupData.isMultiSig ?? false,
      multisigConfig: backupData.multisigConfig ?? null,
    });

    const saved = await this.walletRepository.save(wallet);
    await this.recordAudit(saved, userId, 'RECOVERY', { network: saved.network });
    return saved;
  }

  /**
   * Fund testnet account via Friendbot.
   */
  async fundTestnet(publicKey: string): Promise<{ success: boolean }> {
    const response = await fetch(
      `https://friendbot.stellar.org?addr=${publicKey}`,
    );
    if (!response.ok) {
      const text = await response.text();
      throw new BadRequestException(`Friendbot failed: ${text}`);
    }
    return { success: true };
  }

  private async recordAudit(
    wallet: StellarWallet,
    userId: string,
    operation: StellarWalletOperationType,
    details?: Record<string, unknown>,
  ): Promise<void> {
    const log = this.auditRepository.create({
      walletId: wallet.id,
      wallet,
      userId,
      user: { id: userId } as any,
      operation,
      details: details ?? null,
    });
    await this.auditRepository.save(log);
  }
}
