import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as StellarSdk from 'stellar-sdk';

@Injectable()
export class StellarService implements OnModuleInit {
  private readonly logger = new Logger(StellarService.name);
  private server: StellarSdk.Horizon.Server;
  private keypair: StellarSdk.Keypair;

  constructor(private configService: ConfigService) {
    const rpcUrl = this.configService.get<string>('blockchain.stellar.rpcUrl') || 'https://horizon-testnet.stellar.org';
    this.server = new StellarSdk.Horizon.Server(rpcUrl);
  }

  async onModuleInit() {
    const secretKey = this.configService.get<string>('blockchain.stellar.secretKey');
    if (secretKey) {
      this.keypair = StellarSdk.Keypair.fromSecret(secretKey);
      this.logger.log(`Stellar initialized with account: ${this.keypair.publicKey()}`);
    } else {
      this.logger.warn('Stellar secret key not provided. Running in limited mode.');
    }
  }

  async anchorRecord(recordHash: string, ipfsHash: string): Promise<string> {
    if (!this.keypair) {
      throw new Error('Stellar keypair not initialized');
    }

    try {
      const account = await this.server.loadAccount(this.keypair.publicKey());
      
      // Using ManageData operation to anchor metadata
      // Key: PH (PetHash), Value: IPFS hash
      const transaction = new StellarSdk.TransactionBuilder(account, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: StellarSdk.Networks.TESTNET,
      })
        .addOperation(StellarSdk.Operation.manageData({
          name: `MR_${recordHash.substring(0, 10)}`, // MR: Medical Record
          value: ipfsHash,
        }))
        .setTimeout(30)
        .build();

      transaction.sign(this.keypair);
      const result = await this.server.submitTransaction(transaction);
      return result.hash;
    } catch (error) {
      this.logger.error(`Stellar anchoring failed: ${error.message}`);
      if (error.response?.data) {
        this.logger.error(`Details: ${JSON.stringify(error.response.data.extras.result_codes)}`);
      }
      throw error;
    }
  }

  async verifyOnChain(recordHash: string): Promise<string | null> {
    try {
      const account = await this.server.loadAccount(this.keypair.publicKey());
      const key = `MR_${recordHash.substring(0, 10)}`;
      const dataValue = account.data_attr[key];
      
      if (dataValue) {
        return Buffer.from(dataValue, 'base64').toString();
      }
      return null;
    } catch (error) {
      this.logger.error(`Stellar verification failed: ${error.message}`);
      return null;
    }
  }
}
