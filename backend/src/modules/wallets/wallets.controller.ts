import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { WalletsService } from './wallets.service';
import { CreateWalletDto } from './dto/create-wallet.dto';
import { PrepareTransactionDto } from './dto/prepare-transaction.dto';
import { SignTransactionDto } from './dto/sign-transaction.dto';
import { BackupWalletDto } from './dto/backup-wallet.dto';
import { RecoverWalletDto } from './dto/recover-wallet.dto';
import { RotateKeysDto } from './dto/rotate-keys.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user: { sub: string };
}

@Controller('wallets')
@UseGuards(JwtAuthGuard)
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  /**
   * Create a wallet for the authenticated user.
   * The client MUST generate the keypair and perform encryption locally.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: Omit<CreateWalletDto, 'userId'>,
  ) {
    const userId = req.user.sub;
    return this.walletsService.createForUser({ ...dto, userId });
  }

  /**
   * List all wallets for the authenticated user.
   */
  @Get()
  async list(@Req() req: AuthenticatedRequest) {
    const userId = req.user.sub;
    return this.walletsService.findByUser(userId);
  }

  /**
   * Prepare an unsigned transaction for a given wallet.
   */
  @Post(':id/transactions/prepare')
  async prepareTransaction(
    @Req() req: AuthenticatedRequest,
    @Param('id') walletId: string,
    @Body() dto: PrepareTransactionDto,
  ) {
    const userId = req.user.sub;
    return this.walletsService.prepareTransaction(walletId, userId, dto);
  }

  /**
   * Record a signed transaction and user consent.
   * The server never sees plaintext private keys; only signed XDRs.
   */
  @Post(':id/transactions/sign')
  async signTransaction(
    @Req() req: AuthenticatedRequest,
    @Param('id') walletId: string,
    @Body() dto: Omit<SignTransactionDto, 'walletId'>,
  ) {
    const userId = req.user.sub;
    return this.walletsService.recordSignedTransaction(userId, {
      ...dto,
      walletId,
    });
  }

  /**
   * Get account details from Stellar network (balances, sequence, signers).
   */
  @Get(':id/account')
  async getAccountDetails(
    @Req() req: AuthenticatedRequest,
    @Param('id') walletId: string,
    @Query('network') network?: 'PUBLIC' | 'TESTNET',
  ) {
    const userId = req.user.sub;
    const wallet = await this.walletsService.findOneForUser(walletId, userId);
    return this.walletsService.getAccountDetails(
      wallet.publicKey,
      network || wallet.network,
    );
  }

  /**
   * Fund a testnet account using Friendbot.
   * Only works for TESTNET wallets.
   */
  @Post(':id/fund-testnet')
  async fundTestnetAccount(
    @Req() req: AuthenticatedRequest,
    @Param('id') walletId: string,
  ) {
    const userId = req.user.sub;
    const wallet = await this.walletsService.findOneForUser(walletId, userId);

    if (wallet.network !== 'TESTNET') {
      throw new BadRequestException('Friendbot funding only works on TESTNET');
    }

    return this.walletsService.fundTestnetAccount(wallet.publicKey);
  }

  /**
   * Submit a signed transaction to the Stellar network.
   */
  @Post(':id/transactions/submit')
  async submitTransaction(
    @Req() req: AuthenticatedRequest,
    @Param('id') walletId: string,
    @Body() body: { signedXdr: string; network?: 'PUBLIC' | 'TESTNET' },
  ) {
    const userId = req.user.sub;
    const wallet = await this.walletsService.findOneForUser(walletId, userId);
    return this.walletsService.submitTransaction(
      body.signedXdr,
      body.network || wallet.network,
    );
  }

  /**
   * Export wallet backup data for secure offline storage.
   */
  @Post(':id/backup')
  async exportBackup(
    @Req() req: AuthenticatedRequest,
    @Param('id') walletId: string,
    @Body() dto: BackupWalletDto,
  ) {
    const userId = req.user.sub;
    return this.walletsService.exportBackup(walletId, userId, dto);
  }

  /**
   * Recover a wallet from backup data.
   */
  @Post('recover')
  @HttpCode(HttpStatus.CREATED)
  async recoverWallet(
    @Req() req: AuthenticatedRequest,
    @Body() dto: RecoverWalletDto,
  ) {
    const userId = req.user.sub;
    return this.walletsService.recoverWallet(userId, dto);
  }

  /**
   * Rotate encryption keys for a wallet.
   */
  @Post(':id/rotate-keys')
  async rotateKeys(
    @Req() req: AuthenticatedRequest,
    @Param('id') walletId: string,
    @Body() dto: RotateKeysDto,
  ) {
    const userId = req.user.sub;
    return this.walletsService.rotateKeys(walletId, userId, dto);
  }
}
