import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as StellarSdk from '@stellar/stellar-sdk';
import { Contract, SorobanRpc, xdr } from '@stellar/stellar-sdk';

@Injectable()
export class StellarService implements OnModuleInit {
  private readonly logger = new Logger(StellarService.name);
  private server: StellarSdk.Horizon.Server;
  private sorobanServer: SorobanRpc.Server;
  private keypair: StellarSdk.Keypair;
  private networkPassphrase: string;

  constructor(private configService: ConfigService) {
    const rpcUrl = this.configService.get<string>('blockchain.stellar.rpcUrl') || 'https://horizon-testnet.stellar.org';
    const sorobanUrl = this.configService.get<string>('blockchain.stellar.sorobanRpcUrl') || 'https://soroban-testnet.stellar.org';
    this.server = new StellarSdk.Horizon.Server(rpcUrl);
    this.sorobanServer = new SorobanRpc.Server(sorobanUrl, { allowHttp: sorobanUrl.startsWith('http://') });
    this.networkPassphrase = StellarSdk.Networks.TESTNET;
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
    if (!this.keypair) throw new Error('Stellar keypair not initialized');

    try {
      const account = await this.server.loadAccount(this.keypair.publicKey());
      const transaction = new StellarSdk.TransactionBuilder(account, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: this.networkPassphrase,
      })
        .addOperation(StellarSdk.Operation.manageData({
          name: `MR_${recordHash.substring(0, 10)}`,
          value: ipfsHash,
        }))
        .setTimeout(30)
        .build();

      transaction.sign(this.keypair);
      const result = await this.server.submitTransaction(transaction);
      return result.hash;
    } catch (error) {
      this.handleError('anchoring', error);
    }
  }

  async verifyOnChain(recordHash: string): Promise<string | null> {
    try {
      const account = await this.server.loadAccount(this.keypair.publicKey());
      const dataValue = account.data_attr[`MR_${recordHash.substring(0, 10)}`];
      return dataValue ? Buffer.from(dataValue, 'base64').toString() : null;
    } catch (error) {
      this.logger.error(`Verification failed: ${error.message}`);
      return null;
    }
  }

  async deployContract(wasmHash: string): Promise<{ contractId: string; txHash: string }> {
    const account = await this.sorobanServer.getAccount(this.keypair.publicKey());
    const tx = new StellarSdk.TransactionBuilder(account, { fee: '1000', networkPassphrase: this.networkPassphrase })
      .addOperation(StellarSdk.Operation.createCustomContract({ address: this.keypair.publicKey(), wasmHash }))
      .setTimeout(30)
      .build();

    tx.sign(this.keypair);
    const result = await this.submitSorobanTx(tx);
    return { contractId: result.returnValue?.toString() || '', txHash: result.hash };
  }

  async invokeContract(contractId: string, method: string, params: xdr.ScVal[] = []): Promise<any> {
    const account = await this.sorobanServer.getAccount(this.keypair.publicKey());
    const contract = new Contract(contractId);
    const tx = new StellarSdk.TransactionBuilder(account, { fee: '1000', networkPassphrase: this.networkPassphrase })
      .addOperation(contract.call(method, ...params))
      .setTimeout(30)
      .build();

    const prepared = await this.sorobanServer.prepareTransaction(tx);
    prepared.sign(this.keypair);
    const result = await this.submitSorobanTx(prepared);
    return result.returnValue ? StellarSdk.scValToNative(result.returnValue) : null;
  }

  async listenToEvents(contractId: string, callback: (event: any) => void, startLedger?: number) {
    const cursor = startLedger || (await this.sorobanServer.getLatestLedger()).sequence;
    const stream = this.sorobanServer.getEvents({ startLedger: cursor, filters: [{ type: 'contract', contractIds: [contractId] }] });
    for await (const event of stream) callback(event);
  }

  async upgradeContract(contractId: string, newWasmHash: string): Promise<string> {
    const account = await this.sorobanServer.getAccount(this.keypair.publicKey());
    const contract = new Contract(contractId);
    const tx = new StellarSdk.TransactionBuilder(account, { fee: '1000', networkPassphrase: this.networkPassphrase })
      .addOperation(contract.call('upgrade', xdr.ScVal.scvBytes(Buffer.from(newWasmHash, 'hex'))))
      .setTimeout(30)
      .build();

    const prepared = await this.sorobanServer.prepareTransaction(tx);
    prepared.sign(this.keypair);
    const result = await this.submitSorobanTx(prepared);
    return result.hash;
  }

  async estimateGas(contractId: string, method: string, params: xdr.ScVal[] = []): Promise<{ fee: string; resourceFee: string }> {
    const account = await this.sorobanServer.getAccount(this.keypair.publicKey());
    const contract = new Contract(contractId);
    const tx = new StellarSdk.TransactionBuilder(account, { fee: '100', networkPassphrase: this.networkPassphrase })
      .addOperation(contract.call(method, ...params))
      .setTimeout(30)
      .build();

    const simulated = await this.sorobanServer.simulateTransaction(tx);
    if (SorobanRpc.Api.isSimulationError(simulated)) throw new Error(`Simulation failed: ${simulated.error}`);
    return { fee: tx.fee, resourceFee: simulated.minResourceFee || '0' };
  }

  private async submitSorobanTx(tx: StellarSdk.Transaction): Promise<SorobanRpc.Api.GetTransactionResponse> {
    try {
      const response = await this.sorobanServer.sendTransaction(tx);
      if (response.status === 'ERROR') throw new Error(`Transaction failed: ${response.errorResult}`);

      let result = await this.sorobanServer.getTransaction(response.hash);
      while (result.status === 'NOT_FOUND') {
        await new Promise(resolve => setTimeout(resolve, 1000));
        result = await this.sorobanServer.getTransaction(response.hash);
      }
      if (result.status === 'FAILED') throw new Error(`Transaction failed: ${result.resultXdr}`);
      return result;
    } catch (error) {
      this.handleError('transaction', error);
    }
  }

  private handleError(operation: string, error: any): never {
    this.logger.error(`${operation} failed: ${error.message}`);
    if (error.response?.data?.extras?.result_codes) {
      this.logger.error(`Codes: ${JSON.stringify(error.response.data.extras.result_codes)}`);
    }
    throw error;
  }
}
