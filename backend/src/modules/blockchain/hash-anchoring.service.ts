import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as crypto from 'crypto';
import * as StellarSdk from '@stellar/stellar-sdk';
import { ConfigService } from '@nestjs/config';
import {
  MedicalRecordAnchor,
  AnchorStatus,
} from './entities/medical-record-anchor.entity';
import { MedicalRecord } from '../medical-records/entities/medical-record.entity';

const MAX_OPS_PER_TX = 100; // Stellar max operations per transaction
const MAX_RETRIES = 3;
const MEMO_PREFIX = 'MR:'; // memo prefix to identify medical record batches

@Injectable()
export class HashAnchoringService {
  private readonly logger = new Logger(HashAnchoringService.name);
  private server: StellarSdk.Horizon.Server;
  private keypair: StellarSdk.Keypair;
  private networkPassphrase: string;

  constructor(
    @InjectRepository(MedicalRecordAnchor)
    private readonly anchorRepo: Repository<MedicalRecordAnchor>,
    @InjectRepository(MedicalRecord)
    private readonly recordRepo: Repository<MedicalRecord>,
    private readonly configService: ConfigService,
  ) {
    const horizonUrl =
      this.configService.get<string>('STELLAR_TESTNET_HORIZON_URL') ||
      'https://horizon-testnet.stellar.org';
    this.server = new StellarSdk.Horizon.Server(horizonUrl);

    const network =
      this.configService.get<string>('STELLAR_DEFAULT_NETWORK') || 'TESTNET';
    this.networkPassphrase =
      network === 'PUBLIC'
        ? StellarSdk.Networks.PUBLIC
        : StellarSdk.Networks.TESTNET;

    const secret = this.configService.get<string>('STELLAR_ANCHOR_SECRET_KEY');
    if (secret) {
      this.keypair = StellarSdk.Keypair.fromSecret(secret);
      this.logger.log(
        `HashAnchoringService ready — account: ${this.keypair.publicKey()}`,
      );
    } else {
      this.logger.warn(
        'STELLAR_ANCHOR_SECRET_KEY not set — anchoring disabled',
      );
    }
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /** Queue a single medical record for anchoring */
  async queueAnchor(recordId: string): Promise<MedicalRecordAnchor> {
    const existing = await this.anchorRepo.findOne({
      where: {
        recordId,
        status: In([
          AnchorStatus.PENDING,
          AnchorStatus.QUEUED,
          AnchorStatus.ANCHORED,
        ]),
      },
    });
    if (existing) return existing;

    const record = await this.recordRepo.findOne({ where: { id: recordId } });
    if (!record) throw new Error(`Medical record ${recordId} not found`);

    const recordHash = this.hashRecord(record);
    const anchor = this.anchorRepo.create({
      recordId,
      recordHash,
      status: AnchorStatus.QUEUED,
    });
    return this.anchorRepo.save(anchor);
  }

  /** Queue multiple records — returns immediately, processing is async */
  async queueBatch(
    recordIds: string[],
  ): Promise<{ queued: number; batchId: string }> {
    const batchId = crypto.randomUUID();
    const records = await this.recordRepo.findBy({ id: In(recordIds) });

    const anchors = records.map((r) =>
      this.anchorRepo.create({
        recordId: r.id,
        recordHash: this.hashRecord(r),
        status: AnchorStatus.QUEUED,
        batchId,
      }),
    );

    await this.anchorRepo.save(anchors);
    return { queued: anchors.length, batchId };
  }

  /** Get anchor status for a record */
  async getAnchorStatus(recordId: string): Promise<MedicalRecordAnchor | null> {
    return this.anchorRepo.findOne({
      where: { recordId },
      order: { createdAt: 'DESC' },
    });
  }

  /** Verify a record's current hash matches what's on-chain */
  async verifyAnchor(recordId: string): Promise<{
    verified: boolean;
    currentHash: string;
    anchoredHash: string;
    txHash: string;
    confirmedAt: Date;
  }> {
    const anchor = await this.anchorRepo.findOne({
      where: { recordId, status: AnchorStatus.CONFIRMED },
      order: { createdAt: 'DESC' },
    });

    if (!anchor)
      throw new Error(`No confirmed anchor found for record ${recordId}`);

    const record = await this.recordRepo.findOne({ where: { id: recordId } });
    const currentHash = this.hashRecord(record);

    return {
      verified: currentHash === anchor.recordHash,
      currentHash,
      anchoredHash: anchor.recordHash,
      txHash: anchor.txHash,
      confirmedAt: anchor.confirmedAt,
    };
  }

  // ─── Batch Processing (cron every 5 min) ───────────────────────────────────

  @Cron(CronExpression.EVERY_5_MINUTES)
  async processPendingQueue(): Promise<void> {
    if (!this.keypair) return;

    const pending = await this.anchorRepo.find({
      where: { status: AnchorStatus.QUEUED },
      order: { createdAt: 'ASC' },
      take: MAX_OPS_PER_TX,
    });

    if (!pending.length) return;

    this.logger.log(`Processing batch of ${pending.length} anchors`);
    await this.anchorBatch(pending);
  }

  /** Poll ANCHORED records to confirm ledger inclusion */
  @Cron(CronExpression.EVERY_MINUTE)
  async confirmPendingTransactions(): Promise<void> {
    if (!this.keypair) return;

    const anchored = await this.anchorRepo.find({
      where: { status: AnchorStatus.ANCHORED },
    });

    for (const anchor of anchored) {
      await this.confirmTransaction(anchor);
    }
  }

  // ─── Core Anchoring Logic ──────────────────────────────────────────────────

  private async anchorBatch(anchors: MedicalRecordAnchor[]): Promise<void> {
    // Group by batchId (or treat as one batch if mixed)
    const batchId = anchors[0].batchId || crypto.randomUUID();

    try {
      const account = await this.server.loadAccount(this.keypair.publicKey());

      // Cost optimisation: pack up to MAX_OPS_PER_TX manageData ops in one tx
      const builder = new StellarSdk.TransactionBuilder(account, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: this.networkPassphrase,
      }).setTimeout(60);

      for (const anchor of anchors) {
        // manageData key max 64 bytes — use first 28 chars of hash (hex) + prefix
        const key = `MR:${anchor.recordHash.substring(0, 28)}`;
        // value: full 64-char hex hash (32 bytes)
        builder.addOperation(
          StellarSdk.Operation.manageData({
            name: key,
            value: Buffer.from(anchor.recordHash, 'hex'),
          }),
        );
      }

      const tx = builder.build();
      tx.sign(this.keypair);

      const result = await this.server.submitTransaction(tx);
      const txHash = result.hash;

      // Mark all as ANCHORED
      await this.anchorRepo.save(
        anchors.map((a) => ({
          ...a,
          txHash,
          batchId,
          status: AnchorStatus.ANCHORED,
          anchoredAt: new Date(),
          lastError: null,
        })),
      );

      this.logger.log(
        `Batch anchored — txHash: ${txHash}, records: ${anchors.length}`,
      );
    } catch (error) {
      this.logger.error(`Batch anchor failed: ${error.message}`);
      await this.anchorRepo.save(
        anchors.map((a) => ({
          ...a,
          status:
            a.retryCount >= MAX_RETRIES
              ? AnchorStatus.FAILED
              : AnchorStatus.QUEUED,
          retryCount: a.retryCount + 1,
          lastError: error.message,
        })),
      );
    }
  }

  private async confirmTransaction(anchor: MedicalRecordAnchor): Promise<void> {
    try {
      const tx = await this.server
        .transactions()
        .transaction(anchor.txHash)
        .call();
      if (tx.successful) {
        anchor.status = AnchorStatus.CONFIRMED;
        anchor.ledgerSequence = Number((tx as any).ledger ?? 0);
        anchor.feePaid = String((tx as any).fee_charged ?? '0');
        anchor.confirmedAt = new Date();
        await this.anchorRepo.save(anchor);
        this.logger.log(
          `Confirmed anchor for record ${anchor.recordId} at ledger ${tx.ledger}`,
        );
      }
    } catch {
      // Transaction not yet in ledger — will retry next cron tick
    }
  }

  // ─── Hash Generation ───────────────────────────────────────────────────────

  /** Canonical SHA-256 hash of a medical record's immutable fields */
  hashRecord(record: Partial<MedicalRecord>): string {
    const payload = JSON.stringify({
      id: record.id,
      petId: record.petId,
      vetId: record.vetId,
      recordType: record.recordType,
      visitDate: record.visitDate,
      diagnosis: record.diagnosis,
      treatment: record.treatment,
      notes: record.notes,
      version: record.version,
    });
    return crypto.createHash('sha256').update(payload).digest('hex');
  }
}
