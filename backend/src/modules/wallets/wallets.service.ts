import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { ConfigType } from '@nestjs/config';
import { Wallet } from './entities/wallet.entity';
import {
  WalletAuditLog,
  WalletOperationType,
} from './entities/wallet-audit-log.entity';
import { CreateWalletDto } from './dto/create-wallet.dto';
import { PrepareTransactionDto } from './dto/prepare-transaction.dto';
import { SignTransactionDto } from './dto/sign-transaction.dto';
import { BackupWalletDto } from './dto/backup-wallet.dto';
import { RecoverWalletDto } from './dto/recover-wallet.dto';
import { stellarConfig } from '../../config/stellar.config';
import {
  Horizon,
  TransactionBuilder,
  BASE_FEE,
  Operation,
  Memo,
  Asset,
  Transaction,
} from '@stellar/stellar-sdk';

@Injectable()
export class WalletsService {
  constructor(
    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,
    @InjectRepository(WalletAuditLog)
    private readonly auditRepository: Repository<WalletAuditLog>,
    @Inject(stellarConfig.KEY)
    private readonly stellarCfg: ConfigType<typeof stellarConfig>,
  ) {}

  /**
   * Create a new wallet for a user.
   * This assumes the client has already generated the keypair and encrypted
   * the secret key with a key derived from the user's password.
   */
  async createForUser(dto: CreateWalletDto): Promise<Wallet> {
    const wallet = this.walletRepository.create({
      ...dto,
      userId: dto.userId,
      isMultiSig: dto.isMultiSig ?? false,
      multisigConfig: dto.multisigConfig ?? null,
      hsmKeyId: dto.hsmKeyId ?? null,
    });
    const saved = await this.walletRepository.save(wallet);

    await this.recordAudit(saved, dto.userId, 'CREATE', {
      network: dto.network,
      isMultiSig: saved.isMultiSig,
      hasHsmKey: !!saved.hsmKeyId,
    });

    return saved;
  }

  async findByUser(userId: string): Promise<Wallet[]> {
    return this.walletRepository.find({ where: { userId } });
  }

  async findOneForUser(id: string, userId: string): Promise<Wallet> {
    const wallet = await this.walletRepository.findOne({
      where: { id, userId },
    });
    if (!wallet) {
      throw new NotFoundException(`Wallet with ID ${id} not found for user`);
    }
    return wallet;
  }

  /**
   * Get account details from Stellar network (balances, sequence, signers, etc.)
   */
  async getAccountDetails(
    publicKey: string,
    network: Wallet['network'],
  ): Promise<{
    publicKey: string;
    balances: Array<{
      asset_type: string;
      asset_code?: string;
      asset_issuer?: string;
      balance: string;
    }>;
    sequence: string;
    subentryCount: number;
    signers: Array<{
      key: string;
      weight: number;
      type: string;
    }>;
  }> {
    const networkConfig = this.stellarCfg.networks[network];
    const server = new Horizon.Server(networkConfig.horizonUrl);

    try {
      const account = await server.loadAccount(publicKey);

      return {
        publicKey,
        balances: account.balances,
        sequence: account.sequenceNumber(),
        subentryCount: account.subentry_count,
        signers: account.signers,
      };
    } catch {
      throw new NotFoundException(
        `Account ${publicKey} not found on ${network} network`,
      );
    }
  }

  /**
   * Fund a testnet account using Friendbot.
   * Only works on TESTNET - returns error for PUBLIC network.
   */
  async fundTestnetAccount(publicKey: string): Promise<{ success: boolean }> {
    try {
      const response = await fetch(
        `https://friendbot.stellar.org?addr=${publicKey}`,
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new BadRequestException(`Friendbot funding failed: ${errorText}`);
      }

      return { success: true };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to fund testnet account: ${error.message}`,
      );
    }
  }

  /**
   * Submit a signed transaction to the Stellar network.
   * The transaction must be signed client-side before submission.
   */
  async submitTransaction(
    signedXdr: string,
    network: Wallet['network'],
  ): Promise<{
    successful: boolean;
    hash: string;
    ledger: number;
    resultXdr: string;
  }> {
    const networkConfig = this.stellarCfg.networks[network];

    const server = new Horizon.Server(networkConfig.horizonUrl);

    try {
      const transaction = new Transaction(
        signedXdr,
        networkConfig.networkPassphrase,
      );
      const result = await server.submitTransaction(transaction);

      return {
        successful: result.successful,
        hash: result.hash,
        ledger: result.ledger,
        resultXdr: result.result_xdr,
      };
    } catch (error: any) {
      throw new BadRequestException(
        `Transaction submission failed: ${error.message || 'Unknown error'}`,
      );
    }
  }

  /**
   * Estimate fees and build an unsigned transaction XDR.
   * The resulting XDR is returned to the client for signing.
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

    const network = this.stellarCfg.networks[dto.network];
    const horizonUrl = dto.horizonUrl || network.horizonUrl;

    const server = new Horizon.Server(horizonUrl);
    const account = await server.loadAccount(dto.sourcePublicKey);

    const baseFee = await server.fetchBaseFee().catch(() => BASE_FEE);

    const txBuilder = new TransactionBuilder(account, {
      fee: (dto.maxFeeStroops || baseFee).toString(),
      networkPassphrase: network.networkPassphrase,
    });

    // Build operations from DTO
    // Operations can be:
    // 1. Pre-built Operation objects (from Operation.payment(), etc.)
    // 2. XDR strings that need parsing
    // 3. Operation-like objects with type and params
    for (const op of dto.operations) {
      if (typeof op === 'string') {
        // If it's an XDR string, parse it
        txBuilder.addOperation(Operation.fromXDRObject(op));
      } else if (op && typeof op === 'object') {
        // If it's an operation object, try to build it
        // Common case: payment operation
        if ('type' in op && op.type === 'payment') {
          const paymentOp = op as {
            destination: string;
            amount: string;
            assetCode?: string;
            assetIssuer?: string;
          };
          const asset =
            paymentOp.assetCode && paymentOp.assetIssuer
              ? new Asset(paymentOp.assetCode, paymentOp.assetIssuer)
              : Asset.native();

          txBuilder.addOperation(
            Operation.payment({
              destination: paymentOp.destination,
              asset: asset,
              amount: paymentOp.amount,
            }),
          );
        } else {
          // Fallback: try to parse as XDR object
          txBuilder.addOperation(Operation.fromXDRObject(op as any));
        }
      }
    }

    if (dto.memo) {
      txBuilder.addMemo(Memo.text(dto.memo));
    }

    const tx = txBuilder.setTimeout(300).build();

    await this.recordAudit(wallet, userId, 'PREPARE_TRANSACTION', {
      sourcePublicKey: dto.sourcePublicKey,
      operationCount: dto.operations.length,
      feeStroops: tx.fee,
      network: dto.network,
    });

    return {
      unsignedXdr: tx.toXDR(),
      feeStroops: parseInt(tx.fee, 10),
      networkPassphrase: network.networkPassphrase,
    };
  }

  /**
   * Record that a client has signed (and optionally submitted) a transaction.
   * The server never sees the private key – only the signed XDR.
   */
  async recordSignedTransaction(
    userId: string,
    dto: SignTransactionDto,
  ): Promise<{ signedXdr: string }> {
    const wallet = await this.findOneForUser(dto.walletId, userId);

    await this.recordAudit(wallet, userId, 'SIGN_TRANSACTION', {
      network: dto.network,
      consentText: dto.consentText,
    });

    // In institutional deployments, this is where you would route the
    // transaction to an HSM for signing / co-signing instead of relying
    // solely on client-side signatures.

    return { signedXdr: dto.signedXdr };
  }

  /**
   * Key rotation: bump rotationVersion and optionally swap to a new
   * encryptedSecretKey / HSM reference provided by the client or key ceremony.
   */
  async rotateKeys(
    walletId: string,
    userId: string,
    payload: {
      encryptedSecretKey?: string | null;
      encryptionSalt?: string;
      encryptionIv?: string;
      keyDerivation?: Wallet['keyDerivation'];
      hsmKeyId?: string | null;
    },
  ): Promise<Wallet> {
    const wallet = await this.findOneForUser(walletId, userId);

    Object.assign(wallet, {
      encryptedSecretKey:
        payload.encryptedSecretKey ?? wallet.encryptedSecretKey,
      encryptionSalt: payload.encryptionSalt ?? wallet.encryptionSalt,
      encryptionIv: payload.encryptionIv ?? wallet.encryptionIv,
      keyDerivation: payload.keyDerivation ?? wallet.keyDerivation,
      hsmKeyId: payload.hsmKeyId ?? wallet.hsmKeyId,
      rotationVersion: wallet.rotationVersion + 1,
    });

    const saved = await this.walletRepository.save(wallet);

    await this.recordAudit(saved, userId, 'ROTATE_KEY', {
      hasHsmKey: !!saved.hsmKeyId,
      hasEncryptedSecretKey: !!saved.encryptedSecretKey,
      rotationVersion: saved.rotationVersion,
    });

    return saved;
  }

  /**
   * Export wallet backup data for secure storage by the user.
   * Returns encrypted wallet data that can be used for recovery.
   */
  async exportBackup(
    walletId: string,
    userId: string,
    dto: BackupWalletDto,
  ): Promise<{
    backupData: {
      publicKey: string;
      encryptedSecretKey: string | null;
      encryptionIv: string;
      encryptionSalt: string;
      keyDerivation: string;
      network: string;
      isMultiSig: boolean;
      multisigConfig: Record<string, unknown> | null;
      exportedAt: string;
    };
  }> {
    const wallet = await this.findOneForUser(walletId, userId);

    await this.recordAudit(wallet, userId, 'BACKUP_EXPORT', {
      hasBackupPassword: !!dto.backupPassword,
    });

    // Note: If backupPassword is provided, the client should apply
    // additional encryption layer on top of this data before storage.
    return {
      backupData: {
        publicKey: wallet.publicKey,
        encryptedSecretKey: wallet.encryptedSecretKey,
        encryptionIv: wallet.encryptionIv,
        encryptionSalt: wallet.encryptionSalt,
        keyDerivation: wallet.keyDerivation,
        network: wallet.network,
        isMultiSig: wallet.isMultiSig,
        multisigConfig: wallet.multisigConfig,
        exportedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Recover a wallet from backup data.
   * Creates a new wallet entry from previously exported backup.
   */
  async recoverWallet(userId: string, dto: RecoverWalletDto): Promise<Wallet> {
    const { backupData } = dto;

    // Check if wallet with this public key already exists
    const existing = await this.walletRepository.findOne({
      where: { publicKey: backupData.publicKey },
    });

    if (existing) {
      throw new BadRequestException(
        'A wallet with this public key already exists',
      );
    }

    // Create wallet from backup data
    const wallet = this.walletRepository.create({
      userId,
      publicKey: backupData.publicKey,
      encryptedSecretKey: backupData.encryptedSecretKey,
      encryptionIv: backupData.encryptionIv,
      encryptionSalt: backupData.encryptionSalt,
      keyDerivation: backupData.keyDerivation as Wallet['keyDerivation'],
      network: backupData.network,
      isMultiSig: backupData.isMultiSig ?? false,
      multisigConfig: backupData.multisigConfig ?? null,
      hsmKeyId: null,
      rotationVersion: 1,
    });

    const saved = await this.walletRepository.save(wallet);

    await this.recordAudit(saved, userId, 'RECOVERY_REQUEST', {
      network: saved.network,
      isMultiSig: saved.isMultiSig,
    });

    return saved;
  }

  private async recordAudit(
    wallet: Wallet,
    userId: string,
    operation: WalletOperationType,
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
