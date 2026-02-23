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
import { StellarWalletManagementService } from './stellar-wallet-management.service';
import { CreateStellarWalletDto } from './dto/create-wallet.dto';
import { PrepareTransactionDto } from './dto/prepare-transaction.dto';
import { SignTransactionDto } from './dto/sign-transaction.dto';
import { RecoverWalletDto } from './dto/backup.dto';
import { SwitchNetworkDto } from './dto/switch-network.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user: { sub: string };
}

@Controller('stellar-wallet-management')
@UseGuards(JwtAuthGuard)
export class StellarWalletManagementController {
  constructor(
    private readonly service: StellarWalletManagementService,
  ) {}

  /**
   * Auto wallet creation: get or create wallet for user.
   * Creates a new wallet if none exists for the given network.
   */
  @Get('wallet')
  async getOrCreateWallet(
    @Req() req: AuthenticatedRequest,
    @Query('network') network?: 'PUBLIC' | 'TESTNET',
  ) {
    const userId = req.user.sub;
    return this.service.ensureWalletForUser(
      userId,
      network || 'TESTNET',
    );
  }

  /**
   * Create wallet explicitly for a specific network.
   */
  @Post('wallet')
  @HttpCode(HttpStatus.CREATED)
  async createWallet(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateStellarWalletDto,
  ) {
    const userId = req.user.sub;
    return this.service.createWallet(
      userId,
      dto.network,
      dto.multisigConfig as { threshold: number; signers: { key: string; weight: number }[] } | undefined,
    );
  }

  /**
   * List all stellar wallets for the authenticated user.
   */
  @Get('wallets')
  async listWallets(@Req() req: AuthenticatedRequest) {
    const userId = req.user.sub;
    return this.service.findByUser(userId);
  }

  /**
   * Balance checking.
   */
  @Get('wallets/:id/balance')
  async getBalance(
    @Req() req: AuthenticatedRequest,
    @Param('id') walletId: string,
    @Query('network') network?: 'PUBLIC' | 'TESTNET',
  ) {
    const userId = req.user.sub;
    return this.service.getBalance(walletId, userId, network);
  }

  /**
   * Testnet/Mainnet switching.
   */
  @Post('wallets/:id/switch-network')
  async switchNetwork(
    @Req() req: AuthenticatedRequest,
    @Param('id') walletId: string,
    @Body() dto: SwitchNetworkDto,
  ) {
    const userId = req.user.sub;
    return this.service.switchNetwork(walletId, userId, dto.network);
  }

  /**
   * Prepare unsigned transaction.
   */
  @Post('wallets/:id/transactions/prepare')
  async prepareTransaction(
    @Req() req: AuthenticatedRequest,
    @Param('id') walletId: string,
    @Body() dto: PrepareTransactionDto,
  ) {
    const userId = req.user.sub;
    return this.service.prepareTransaction(walletId, userId, dto);
  }

  /**
   * Transaction signing. For multisig, call repeatedly with output of previous
   * call until all required signatures are collected.
   */
  @Post('wallets/:id/transactions/sign')
  async signTransaction(
    @Req() req: AuthenticatedRequest,
    @Param('id') walletId: string,
    @Body() dto: SignTransactionDto,
  ) {
    const userId = req.user.sub;
    return this.service.signTransaction(
      walletId,
      userId,
      dto.unsignedXdr,
      dto.network,
    );
  }

  /**
   * Submit signed transaction.
   */
  @Post('wallets/:id/transactions/submit')
  async submitTransaction(
    @Req() req: AuthenticatedRequest,
    @Param('id') walletId: string,
    @Body() body: { signedXdr: string; network?: 'PUBLIC' | 'TESTNET' },
  ) {
    const userId = req.user.sub;
    return this.service.submitTransaction(
      walletId,
      userId,
      body.signedXdr,
      body.network,
    );
  }

  /**
   * Wallet backup export.
   */
  @Post('wallets/:id/backup')
  async exportBackup(
    @Req() req: AuthenticatedRequest,
    @Param('id') walletId: string,
  ) {
    const userId = req.user.sub;
    return this.service.exportBackup(walletId, userId);
  }

  /**
   * Wallet recovery from backup.
   */
  @Post('recover')
  @HttpCode(HttpStatus.CREATED)
  async recoverWallet(
    @Req() req: AuthenticatedRequest,
    @Body() dto: RecoverWalletDto,
  ) {
    const userId = req.user.sub;
    return this.service.recoverWallet(userId, dto.backupData);
  }

  /**
   * Fund testnet account via Friendbot (TESTNET only).
   */
  @Post('wallets/:id/fund-testnet')
  async fundTestnet(
    @Req() req: AuthenticatedRequest,
    @Param('id') walletId: string,
  ) {
    const userId = req.user.sub;
    const wallet = await this.service.findOneForUser(walletId, userId);
    if (wallet.network !== 'TESTNET') {
      throw new BadRequestException('Friendbot funding only works on TESTNET');
    }
    return this.service.fundTestnet(wallet.publicKey);
  }
}
