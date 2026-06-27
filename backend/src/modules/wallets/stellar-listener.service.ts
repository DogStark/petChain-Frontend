import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as https from 'https';
import * as http from 'http';
import { Wallet } from './entities/wallet.entity';
import { WalletAuditLog } from './entities/wallet-audit-log.entity';
import { NotificationsGateway } from '../../websocket/gateways/notifications.gateway';

interface HorizonTransaction {
  hash: string;
  ledger: number;
  fee_charged: string;
  successful: boolean;
  source_account: string;
}

@Injectable()
export class StellarListenerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StellarListenerService.name);
  private readonly activeStreams = new Map<string, () => void>();
  private readonly backoffState = new Map<string, number>();

  constructor(
    @InjectRepository(Wallet)
    private readonly walletRepo: Repository<Wallet>,
    @InjectRepository(WalletAuditLog)
    private readonly auditLogRepo: Repository<WalletAuditLog>,
    private readonly configService: ConfigService,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  async onModuleInit() {
    const wallets = await this.walletRepo.find({ relations: ['user'] });
    for (const wallet of wallets) {
      this.subscribeToAccount(wallet.publicKey, wallet.id, wallet.userId);
    }
  }

  onModuleDestroy() {
    for (const [, cancel] of this.activeStreams) {
      cancel();
    }
    this.activeStreams.clear();
  }

  subscribeToAccount(publicKey: string, walletId: string, userId: string) {
    if (this.activeStreams.has(publicKey)) return;

    const horizonUrl =
      this.configService.get<string>('blockchain.stellar.rpcUrl') ||
      'https://horizon-testnet.stellar.org';

    const url = `${horizonUrl}/accounts/${publicKey}/transactions?cursor=now`;
    let cancelled = false;
    let req: http.ClientRequest | null = null;

    const cancel = () => {
      cancelled = true;
      req?.destroy();
    };

    this.activeStreams.set(publicKey, cancel);

    const connect = () => {
      if (cancelled) return;

      const parsedUrl = new URL(url);
      const proto = parsedUrl.protocol === 'https:' ? https : http;

      req = proto.get(
        url,
        {
          headers: { Accept: 'text/event-stream' },
        },
        (res) => {
          this.backoffState.set(publicKey, 0);
          let buffer = '';

          res.on('data', (chunk: Buffer) => {
            buffer += chunk.toString();
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';

            let eventData = '';
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                eventData = line.slice(6).trim();
              } else if (line === '' && eventData && eventData !== '"hello"' && eventData !== '"byebye"') {
                try {
                  const tx: HorizonTransaction = JSON.parse(eventData);
                  this.handleConfirmedTransaction(tx, walletId, userId).catch(
                    (err) => this.logger.error(`Tx handler error: ${err.message}`),
                  );
                } catch {
                  // non-JSON SSE frames (heartbeat etc.)
                }
                eventData = '';
              }
            }
          });

          res.on('end', () => {
            if (!cancelled) this.reconnect(publicKey, walletId, userId, connect);
          });

          res.on('error', () => {
            if (!cancelled) this.reconnect(publicKey, walletId, userId, connect);
          });
        },
      );

      req.on('error', () => {
        if (!cancelled) this.reconnect(publicKey, walletId, userId, connect);
      });
    };

    connect();
  }

  private reconnect(
    publicKey: string,
    walletId: string,
    userId: string,
    connectFn: () => void,
  ) {
    const attempt = (this.backoffState.get(publicKey) ?? 0) + 1;
    this.backoffState.set(publicKey, attempt);
    const delay = Math.min(1000 * Math.pow(2, attempt), 60000);
    this.logger.warn(`Reconnecting ${publicKey} in ${delay}ms (attempt ${attempt})`);
    setTimeout(connectFn, delay);
  }

  async handleConfirmedTransaction(
    tx: HorizonTransaction,
    walletId: string,
    userId: string,
  ): Promise<void> {
    this.logger.log(`Confirmed tx ${tx.hash} for wallet ${walletId}`);

    const log = this.auditLogRepo.create({
      walletId,
      userId,
      operation: 'SUBMIT_TRANSACTION',
      confirmedAt: new Date(),
      ledger: tx.ledger,
      feeCharged: tx.fee_charged,
      details: {
        txHash: tx.hash,
        ledger: tx.ledger,
        fee: tx.fee_charged,
        status: tx.successful ? 'confirmed' : 'failed',
        sourceAccount: tx.source_account,
      },
    } as Partial<WalletAuditLog> as WalletAuditLog);

    await this.auditLogRepo.save(log);

    await this.notificationsGateway.sendNotification(userId, {
      id: log.id,
      userId,
      title: 'Transaction Confirmed',
      message: `Your Stellar transaction ${tx.hash.slice(0, 12)}… was confirmed on ledger ${tx.ledger}.`,
      isRead: false,
      createdAt: new Date(),
    } as any);
  }
}
